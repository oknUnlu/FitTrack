import requests
from bs4 import BeautifulSoup
import sqlite3
import json
import time
import re
import os
import argparse

BASE_URL = "https://www.diyetkolik.com"

CATEGORIES = {
    "ekmek": {"slug": "ekmek-ve-tahillar", "name": "Ekmekler ve Tahıllar"},
    "et": {"slug": "et-tavuk-balik", "name": "Et, Tavuk, Balık"},
    "sut": {"slug": "sut-urunleri-ve-kahvaltiliklar", "name": "Süt Ürünleri ve Kahvaltılıklar"},
    "meyve": {"slug": "meyve-sebzeler", "name": "Meyveler ve Sebzeler"},
    "protein": {"slug": "protein-kaynaklari", "name": "Protein Kaynakları"},
}

CATEGORY_KEYS = list(CATEGORIES.keys())

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
}

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "foods.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            total_pages INTEGER DEFAULT 0
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS foods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT UNIQUE NOT NULL,
            category_id INTEGER,
            serving_size TEXT,
            calories REAL,
            carbohydrate REAL,
            protein REAL,
            fat REAL,
            fiber REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS progress (
            category_slug TEXT PRIMARY KEY,
            last_page INTEGER DEFAULT 0,
            total_pages INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0
        )
    """)
    conn.commit()
    return conn


def insert_categories(conn):
    cursor = conn.cursor()
    for cat in CATEGORIES.values():
        cursor.execute(
            "INSERT OR IGNORE INTO categories (slug, name) VALUES (?, ?)",
            (cat["slug"], cat["name"]),
        )
        cursor.execute(
            "INSERT OR IGNORE INTO progress (category_slug, last_page, total_pages, completed) VALUES (?, 0, 0, 0)",
            (cat["slug"],),
        )
    conn.commit()


def get_category_id(conn, slug):
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM categories WHERE slug = ?", (slug,))
    row = cursor.fetchone()
    return row[0] if row else None


def food_exists(conn, url):
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM foods WHERE url = ?", (url,))
    return cursor.fetchone() is not None


def get_progress(conn, slug):
    cursor = conn.cursor()
    cursor.execute("SELECT last_page, total_pages, completed FROM progress WHERE category_slug = ?", (slug,))
    row = cursor.fetchone()
    return row if row else (0, 0, 0)


def update_progress(conn, slug, last_page, total_pages, completed=0):
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE progress SET last_page = ?, total_pages = ?, completed = ? WHERE category_slug = ?",
        (last_page, total_pages, completed, slug),
    )
    conn.commit()


def parse_number(text):
    if not text:
        return None
    match = re.search(r"([\d.]+)", str(text))
    return float(match.group(1)) if match else None


def fetch_page(url, max_retries=3):
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=20)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as e:
            if attempt < max_retries - 1:
                wait = (attempt + 1) * 3
                print(f"    Hata, {wait}sn sonra tekrar deneniyor... ({e})")
                time.sleep(wait)
            else:
                print(f"    [HATA] Sayfa alinamadi: {url} -> {e}")
                return None


def get_total_pages(category_slug):
    html = fetch_page(f"{BASE_URL}/kac-kalori/kategori/{category_slug}")
    if not html:
        return 0
    page_numbers = [int(p) for p in re.findall(r'"text":"(\d+)"', html) if p.isdigit()]
    if not page_numbers:
        page_numbers = [int(p) for p in re.findall(r">(\d+)</", html) if p.isdigit()]
    return max(page_numbers) if page_numbers else 1


def get_food_slugs_from_category_page(category_slug, page):
    url = f"{BASE_URL}/kac-kalori/kategori/{category_slug}?p={page}"
    html = fetch_page(url)
    if not html:
        return []

    slugs = re.findall(r'"/kac-kalori/([a-z0-9][a-z0-9-]+)"', html)
    seen = set()
    food_slugs = []
    skip_prefixes = ("kategori",)
    for slug in slugs:
        if slug in seen or any(slug.startswith(p) for p in skip_prefixes):
            continue
        seen.add(slug)
        food_slugs.append(slug)
    return food_slugs


def extract_from_rsc_payload(html):
    json_match = re.search(
        r'\n\d+:(\{[^}]*"calories"\s*:\s*"[^"]*"[^}]*\})',
        html,
    )
    if not json_match:
        return None
    try:
        data = json.loads(json_match.group(1))
        return {
            "calories": parse_number(data.get("calories")),
            "fat": parse_number(data.get("fatContent")),
            "fiber": parse_number(data.get("fiberContent")),
            "carbohydrate": parse_number(data.get("carbohydrateContent")),
            "protein": parse_number(data.get("proteinContent")),
            "serving_size": data.get("servingSize"),
        }
    except (json.JSONDecodeError, AttributeError):
        return None


def extract_from_html_table(soup):
    result = {}
    carb = soup.find("span", {"itemprop": "carbohydrateContent"})
    if not carb:
        carb = soup.find("span", class_="lbl_carb100")
    result["carbohydrate"] = parse_number(carb.get_text()) if carb else None

    prot = soup.find("span", {"itemprop": "proteinContent"})
    if not prot:
        prot = soup.find("span", class_="lbl_prot100")
    result["protein"] = parse_number(prot.get_text()) if prot else None

    fat = soup.find("span", {"itemprop": "fatContent"})
    if not fat:
        fat = soup.find("span", class_="lbl_fat100")
    result["fat"] = parse_number(fat.get_text()) if fat else None

    return result


def extract_food_name(html, soup, slug):
    name_match = re.search(r'"name":"([^"]+)"[^}]*"author"', html)
    if name_match:
        return name_match.group(1)
    h1 = soup.find("h1")
    if h1:
        name = h1.get_text(strip=True)
        return re.sub(r"\s*Kaç Kalori\??$", "", name).strip()
    return slug.replace("-kac-kalori", "").replace("-", " ").title()


def extract_serving_size(html, soup):
    serving_match = re.search(r'"servingSize"\s*:\s*"([^"]+)"', html)
    if serving_match:
        return serving_match.group(1)
    header = soup.find("th", class_="food_detail_header")
    if header:
        return header.get_text(strip=True)
    return None


def scrape_food_detail(slug):
    url = f"{BASE_URL}/kac-kalori/{slug}"
    html = fetch_page(url)
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")

    food = {
        "name": extract_food_name(html, soup, slug),
        "url": url,
        "serving_size": extract_serving_size(html, soup),
        "calories": None,
        "carbohydrate": None,
        "protein": None,
        "fat": None,
        "fiber": None,
    }

    rsc_data = extract_from_rsc_payload(html)
    if rsc_data:
        food.update({k: v for k, v in rsc_data.items() if v is not None})

    if food["carbohydrate"] is None or food["protein"] is None or food["fat"] is None:
        html_data = extract_from_html_table(soup)
        for key in ("carbohydrate", "protein", "fat"):
            if food[key] is None and html_data.get(key) is not None:
                food[key] = html_data[key]

    if food["calories"] is None:
        kcal_match = re.search(r'(\d+)\s*kcal', html)
        if kcal_match:
            food["calories"] = float(kcal_match.group(1))

    return food


def save_food(conn, food_data, category_id):
    cursor = conn.cursor()
    try:
        cursor.execute(
            """INSERT OR IGNORE INTO foods
               (name, url, category_id, serving_size, calories, carbohydrate, protein, fat, fiber)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                food_data["name"],
                food_data["url"],
                category_id,
                food_data["serving_size"],
                food_data["calories"],
                food_data["carbohydrate"],
                food_data["protein"],
                food_data["fat"],
                food_data["fiber"],
            ),
        )
        conn.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        print(f"    [HATA] DB kayit hatasi: {e}")
        return False


def get_active_categories(category_filter=None):
    if category_filter:
        keys = [k.strip() for k in category_filter.split(",")]
        result = {}
        for key in keys:
            if key in CATEGORIES:
                result[key] = CATEGORIES[key]
            else:
                print(f"[UYARI] Bilinmeyen kategori: '{key}'")
                print(f"  Gecerli kategoriler: {', '.join(CATEGORY_KEYS)}")
        return result
    return CATEGORIES


def print_status(conn, category_filter=None):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM foods")
    total_foods = cursor.fetchone()[0]

    cats = get_active_categories(category_filter)

    print(f"\n--- Ilerleme Durumu ---")
    print(f"Toplam kayitli yiyecek: {total_foods}\n")
    print(f"  {'Kategori':<35} {'Kisa':>6} {'Taranan':>8} {'Toplam':>8} {'Durum':>10}")
    print(f"  {'-'*35} {'-'*6} {'-'*8} {'-'*8} {'-'*10}")

    all_done = True
    for key, cat in CATEGORIES.items():
        slug, cat_name = cat["slug"], cat["name"]
        last_page, total_pages, completed = get_progress(conn, slug)
        if completed:
            status = "Tamamlandi"
        elif last_page == 0:
            status = "Baslamadi"
            all_done = False
        else:
            status = f"%{int(last_page/total_pages*100) if total_pages else 0}"
            all_done = False
        marker = " *" if cats and key in cats else "  "
        print(f"{marker}{cat_name:<35} {key:>6} {last_page:>8} {total_pages:>8} {status:>10}")

    if all_done:
        print(f"\n  Tum kategoriler tamamlandi!")
    print()


def scrape_all(max_pages=1, category_filter=None):
    conn = init_db()
    insert_categories(conn)

    cats = get_active_categories(category_filter)
    if not cats:
        print("Gecerli kategori bulunamadi.")
        conn.close()
        return

    print_status(conn, category_filter)

    pages_processed = 0
    total_saved = 0
    total_skipped = 0
    total_errors = 0

    for key, cat in cats.items():
        slug, cat_name = cat["slug"], cat["name"]

        if pages_processed >= max_pages:
            break

        last_page, total_pages, completed = get_progress(conn, slug)

        if completed:
            print(f"[{cat_name}] Zaten tamamlandi, atlaniyor.")
            continue

        category_id = get_category_id(conn, slug)

        if total_pages == 0:
            print(f"\n[{cat_name}] Toplam sayfa sayisi hesaplaniyor...")
            total_pages = get_total_pages(slug)
            update_progress(conn, slug, last_page, total_pages)
            print(f"  Toplam {total_pages} sayfa bulundu.")
            time.sleep(1)

        start_page = last_page + 1

        if start_page > total_pages:
            update_progress(conn, slug, total_pages, total_pages, completed=1)
            print(f"[{cat_name}] Tum sayfalar tarandi, tamamlandi olarak isaretlendi.")
            continue

        print(f"\n{'='*60}")
        print(f"Kategori: {cat_name}")
        print(f"Sayfa {start_page}/{total_pages} (kalan limit: {max_pages - pages_processed})")
        print(f"{'='*60}")

        for page in range(start_page, total_pages + 1):
            if pages_processed >= max_pages:
                break

            print(f"\n  Sayfa {page}/{total_pages} taraniyor...")
            food_slugs = get_food_slugs_from_category_page(slug, page)
            print(f"  {len(food_slugs)} yiyecek bulundu.")

            if not food_slugs:
                if page == 1:
                    print("  Bu kategoride yiyecek bulunamadi.")
                else:
                    print("  Bos sayfa.")
                update_progress(conn, slug, page, total_pages)
                pages_processed += 1
                continue

            for i, food_slug in enumerate(food_slugs, 1):
                food_url = f"{BASE_URL}/kac-kalori/{food_slug}"

                if food_exists(conn, food_url):
                    total_skipped += 1
                    continue

                food_data = scrape_food_detail(food_slug)

                if food_data and food_data.get("calories") is not None:
                    saved = save_food(conn, food_data, category_id)
                    if saved:
                        total_saved += 1
                        print(f"    [{i}/{len(food_slugs)}] {food_data['name'][:40]} | {food_data['calories']} kcal")
                else:
                    total_errors += 1
                    print(f"    [!] Veri alinamadi: {food_slug[:50]}")

                time.sleep(1.5)

            update_progress(conn, slug, page, total_pages)
            pages_processed += 1

            if page == total_pages:
                update_progress(conn, slug, page, total_pages, completed=1)
                print(f"\n  Kategori tamamlandi!")

            time.sleep(1)

    print(f"\n{'='*60}")
    print(f"Bu seansta:")
    print(f"  Taranan sayfa   : {pages_processed}")
    print(f"  Yeni kaydedilen : {total_saved}")
    print(f"  Atlanan (mevcut): {total_skipped}")
    print(f"  Hatali          : {total_errors}")
    print(f"{'='*60}")

    print_status(conn, category_filter)
    conn.close()


if __name__ == "__main__":
    cat_help = ", ".join(f"{k} ({v['name']})" for k, v in CATEGORIES.items())

    parser = argparse.ArgumentParser(
        description="Diyetkolik.com yiyecek kalori scraper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"Kategori kisa adlari:\n  {cat_help}\n\n"
               "Ornekler:\n"
               "  python3 scraper.py                      # 1 sayfa, tum kategoriler\n"
               "  python3 scraper.py -p 3 -c et           # 3 sayfa, sadece et kategorisi\n"
               "  python3 scraper.py -p 2 -c et,meyve     # 2 sayfa, et ve meyve\n"
               "  python3 scraper.py --status              # ilerleme durumu\n"
               "  python3 scraper.py --reset -c et         # sadece et kategorisini sifirla\n",
    )
    parser.add_argument(
        "--pages", "-p",
        type=int,
        default=1,
        help="Bu seansta taranacak maksimum sayfa sayisi (varsayilan: 1)",
    )
    parser.add_argument(
        "--category", "-c",
        type=str,
        default=None,
        help=f"Taranacak kategori kisa adi. Birden fazla: virgul ile ayir. Secenekler: {', '.join(CATEGORY_KEYS)}",
    )
    parser.add_argument(
        "--status", "-s",
        action="store_true",
        help="Sadece ilerleme durumunu goster",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Ilerleme bilgisini sifirla (veriler silinmez)",
    )
    args = parser.parse_args()

    if args.status:
        conn = init_db()
        insert_categories(conn)
        print_status(conn, args.category)
        conn.close()
    elif args.reset:
        conn = init_db()
        insert_categories(conn)
        cats = get_active_categories(args.category)
        slugs = [c["slug"] for c in cats.values()]
        for s in slugs:
            conn.execute("UPDATE progress SET last_page = 0, total_pages = 0, completed = 0 WHERE category_slug = ?", (s,))
        conn.commit()
        names = ", ".join(c["name"] for c in cats.values())
        print(f"Ilerleme sifirlandi: {names}")
        conn.close()
    else:
        scrape_all(max_pages=args.pages, category_filter=args.category)
