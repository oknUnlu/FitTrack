"""
SQLite foods.db -> Firestore food_library yükleyici.

seedFoods.js ile aynı doküman formatını üretir:
  id, name, name_tr, calories, protein, carbs, fat, fiber,
  serving_size, serving_unit, category, cuisine, source,
  search_tokens, verified, updated_at

Kullanım:
  python3 upload_to_firestore.py              # dry-run (varsayılan)
  python3 upload_to_firestore.py --upload      # Firestore'a yaz
  python3 upload_to_firestore.py --upload -c et  # sadece et kategorisi
  python3 upload_to_firestore.py --limit 5     # ilk 5 kaydı göster
"""

import sqlite3
import re
import os
import time
import argparse
import unicodedata

SERVICE_ACCOUNT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "node_modules", "key",
    "fittrack-a958c-firebase-adminsdk-fbsvc-2050c55546.json",
)
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "foods.db")
PROJECT_ID = "fittrack-a958c"
COLLECTION = "food_library"

CATEGORY_MAP = {
    "Ekmekler ve Tahıllar": "bread",
    "Et, Tavuk, Balık": "meat",
    "Süt Ürünleri ve Kahvaltılıklar": "dairy",
    "Meyveler ve Sebzeler": "fruits_vegetables",
    "Protein Kaynakları": "protein",
}

CATEGORY_FILTER_MAP = {
    "ekmek": "Ekmekler ve Tahıllar",
    "et": "Et, Tavuk, Balık",
    "sut": "Süt Ürünleri ve Kahvaltılıklar",
    "meyve": "Meyveler ve Sebzeler",
    "protein": "Protein Kaynakları",
}


def normalize(s):
    """seedFoods.js'deki normalize() ile birebir aynı."""
    text = str(s or "").lower().strip()
    replacements = {"ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u"}
    for tr_char, en_char in replacements.items():
        text = text.replace(tr_char, en_char)
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def build_search_tokens(name, name_tr, cuisine=None, category=None):
    """seedFoods.js'deki buildSearchTokens() ile birebir aynı."""
    seen = set()
    sources = [s for s in [name, name_tr, cuisine, category] if s]
    for src in sources:
        stripped = re.sub(r"\(.*?\)", " ", str(src))
        words = normalize(stripped).split()
        for w in words:
            if len(w) < 3:
                continue
            for i in range(2, min(len(w), 24) + 1):
                seen.add(w[:i])
            seen.add(w)
    return sorted(seen)


def make_slug(name):
    """Türkçe yiyecek adından Firestore doküman ID'si üretir."""
    text = normalize(name)
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text[:80]


def parse_serving_grams(serving_size):
    """Porsiyon bilgisinden gram değerini çıkarır."""
    if not serving_size:
        return None
    match = re.search(r"(\d+(?:\.\d+)?)\s*(?:g|gr)\b", serving_size, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return None


def to_per_100g(value, serving_grams):
    """Porsiyon başına değeri 100g'a çevirir."""
    if value is None or serving_grams is None or serving_grams <= 0:
        return None
    return round(value / serving_grams * 100, 1)


def load_foods(category_filter=None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = """
        SELECT f.name, f.calories, f.protein, f.carbohydrate, f.fat, f.fiber,
               f.serving_size, f.url, c.name as category_name
        FROM foods f
        LEFT JOIN categories c ON f.category_id = c.id
    """
    params = []

    if category_filter:
        cat_names = []
        for key in category_filter.split(","):
            key = key.strip()
            if key in CATEGORY_FILTER_MAP:
                cat_names.append(CATEGORY_FILTER_MAP[key])
        if cat_names:
            placeholders = ",".join("?" * len(cat_names))
            query += f" WHERE c.name IN ({placeholders})"
            params = cat_names

    query += " ORDER BY f.name"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return rows


def transform_food(row):
    """SQLite satırını Firestore dokümanına dönüştürür."""
    name = row["name"]
    slug = make_slug(name)

    if not slug:
        return None

    serving_grams = parse_serving_grams(row["serving_size"])

    # Makrolar HTML tablosundan gelir (per 100g)
    carbs = row["carbohydrate"]
    protein = row["protein"]
    fat = row["fat"]
    fiber = row["fiber"]

    # Kalori per-serving olarak geliyor, per-100g'a çevir
    calories = row["calories"]
    if calories and serving_grams and serving_grams != 100:
        calories = round(calories / serving_grams * 100, 1)
    elif calories is None and carbs is not None and protein is not None and fat is not None:
        calories = round(carbs * 4 + protein * 4 + fat * 9, 1)

    # 100g'da 900 kcal üst limit kontrolü (saf yağ = 900)
    if calories and calories > 900:
        if serving_grams:
            pass  # Dönüşüm hatası olabilir, yine de kaydet
        else:
            calories = round(carbs * 4 + protein * 4 + fat * 9, 1) if carbs and protein and fat else calories

    category_tr = row["category_name"]
    category_en = CATEGORY_MAP.get(category_tr)

    doc = {
        "id": slug,
        "name": name,
        "name_tr": name,
        "calories": round(calories) if calories else 0,
        "protein": round(protein, 1) if protein else 0,
        "carbs": round(carbs, 1) if carbs else 0,
        "fat": round(fat, 1) if fat else 0,
        "fiber": round(fiber, 1) if fiber else None,
        "sugar": None,
        "serving_size": 100,
        "serving_unit": "g",
        "category": category_en,
        "cuisine": "turkish",
        "source": "diyetkolik",
        "source_ref": row["url"],
        "search_tokens": build_search_tokens(name, name, "turkish", category_en),
        "verified": False,
        "updated_at": int(time.time() * 1000),
    }
    return doc


def upload_to_firestore(docs, batch_size=400):
    import firebase_admin
    from firebase_admin import credentials, firestore

    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        print(f"[HATA] Service account bulunamadi: {SERVICE_ACCOUNT_PATH}")
        return 0

    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})
    db = firestore.client()

    uploaded = 0
    for i in range(0, len(docs), batch_size):
        batch_docs = docs[i:i + batch_size]
        batch = db.batch()
        for doc in batch_docs:
            ref = db.collection(COLLECTION).document(doc["id"])
            batch.set(ref, doc, merge=False)
        batch.commit()
        uploaded += len(batch_docs)
        print(f"  Yuklendi: {uploaded}/{len(docs)}")

    return uploaded


def main():
    parser = argparse.ArgumentParser(
        description="SQLite foods.db -> Firestore food_library yukleyici",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Ornekler:\n"
               "  python3 upload_to_firestore.py                  # dry-run\n"
               "  python3 upload_to_firestore.py --upload          # tümünü yükle\n"
               "  python3 upload_to_firestore.py --upload -c et    # sadece et\n"
               "  python3 upload_to_firestore.py --limit 3         # 3 örnek göster\n",
    )
    parser.add_argument("--upload", action="store_true", help="Firestore'a yaz (varsayilan: dry-run)")
    parser.add_argument("--category", "-c", type=str, default=None, help="Kategori filtresi (ekmek,et,sut,meyve,protein)")
    parser.add_argument("--limit", "-l", type=int, default=None, help="Islenecek maksimum kayit sayisi")
    args = parser.parse_args()

    if not os.path.exists(DB_PATH):
        print(f"[HATA] Veritabani bulunamadi: {DB_PATH}")
        print("Once scraper.py ile veri toplayin.")
        return

    print(f"Veritabani: {DB_PATH}")
    print(f"Hedef: Firestore/{COLLECTION}")
    print(f"Mod: {'UPLOAD' if args.upload else 'DRY-RUN'}\n")

    rows = load_foods(args.category)
    print(f"SQLite'dan {len(rows)} yiyecek okundu.")

    docs = []
    skipped = 0
    for row in rows:
        doc = transform_food(row)
        if doc:
            docs.append(doc)
        else:
            skipped += 1

    if args.limit:
        docs = docs[:args.limit]

    print(f"Donusturulen: {len(docs)} | Atlanan: {skipped}\n")

    if not docs:
        print("Yuklenecek veri yok.")
        return

    # Slug çakışma kontrolü
    seen_ids = {}
    duplicates = 0
    unique_docs = []
    for doc in docs:
        if doc["id"] in seen_ids:
            duplicates += 1
            existing = seen_ids[doc["id"]]
            if doc["calories"] > existing["calories"]:
                unique_docs = [d for d in unique_docs if d["id"] != doc["id"]]
                unique_docs.append(doc)
                seen_ids[doc["id"]] = doc
        else:
            seen_ids[doc["id"]] = doc
            unique_docs.append(doc)

    if duplicates:
        print(f"[UYARI] {duplicates} slug cakismasi cikarildi.")
    docs = unique_docs

    print(f"\n--- Ornek Dokumanlar ---")
    for doc in docs[:3]:
        print(f"  ID: {doc['id']}")
        print(f"  name_tr: {doc['name_tr']}")
        print(f"  calories: {doc['calories']} | P: {doc['protein']} | C: {doc['carbs']} | F: {doc['fat']}")
        print(f"  category: {doc['category']} | tokens: {len(doc['search_tokens'])}")
        print()

    if not args.upload:
        print(f"DRY-RUN tamamlandi. Yuklemek icin --upload ekleyin.")
        print(f"  python3 upload_to_firestore.py --upload")
        return

    print(f"\nFirestore'a {len(docs)} dokuman yukleniyor...")
    uploaded = upload_to_firestore(docs)
    print(f"\nTamamlandi! {uploaded} dokuman {COLLECTION} koleksiyonuna yazildi.")


if __name__ == "__main__":
    main()
