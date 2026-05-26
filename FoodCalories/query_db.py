import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "foods.db")


def show_stats():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM foods")
    total = cursor.fetchone()[0]
    print(f"Toplam yiyecek sayisi: {total}\n")

    cursor.execute("""
        SELECT c.name, COUNT(f.id) as food_count
        FROM categories c
        LEFT JOIN foods f ON f.category_id = c.id
        GROUP BY c.id
        ORDER BY food_count DESC
    """)
    print("Kategorilere gore dagilim:")
    print(f"  {'Kategori':<40} {'Adet':>6}")
    print(f"  {'-'*40} {'-'*6}")
    for row in cursor.fetchall():
        print(f"  {row[0]:<40} {row[1]:>6}")

    print(f"\nEn yuksek kalorili 10 yiyecek:")
    cursor.execute("""
        SELECT name, calories, protein, carbohydrate, fat, serving_size
        FROM foods
        WHERE calories IS NOT NULL
        ORDER BY calories DESC
        LIMIT 10
    """)
    print(f"  {'Yiyecek':<40} {'Kalori':>8} {'Protein':>8} {'Karb':>8} {'Yag':>8} {'Porsiyon':<20}")
    print(f"  {'-'*40} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*20}")
    for row in cursor.fetchall():
        name = (row[0] or "")[:40]
        cal = f"{row[1]:.0f}" if row[1] else "-"
        prot = f"{row[2]:.1f}" if row[2] else "-"
        carb = f"{row[3]:.1f}" if row[3] else "-"
        fat = f"{row[4]:.1f}" if row[4] else "-"
        serving = (row[5] or "-")[:20]
        print(f"  {name:<40} {cal:>8} {prot:>8} {carb:>8} {fat:>8} {serving:<20}")

    print(f"\nEn dusuk kalorili 10 yiyecek:")
    cursor.execute("""
        SELECT name, calories, protein, carbohydrate, fat, serving_size
        FROM foods
        WHERE calories IS NOT NULL AND calories > 0
        ORDER BY calories ASC
        LIMIT 10
    """)
    print(f"  {'Yiyecek':<40} {'Kalori':>8} {'Protein':>8} {'Karb':>8} {'Yag':>8} {'Porsiyon':<20}")
    print(f"  {'-'*40} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*20}")
    for row in cursor.fetchall():
        name = (row[0] or "")[:40]
        cal = f"{row[1]:.0f}" if row[1] else "-"
        prot = f"{row[2]:.1f}" if row[2] else "-"
        carb = f"{row[3]:.1f}" if row[3] else "-"
        fat = f"{row[4]:.1f}" if row[4] else "-"
        serving = (row[5] or "-")[:20]
        print(f"  {name:<40} {cal:>8} {prot:>8} {carb:>8} {fat:>8} {serving:<20}")

    conn.close()


def search_food(query):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT f.name, f.calories, f.protein, f.carbohydrate, f.fat, f.fiber, f.serving_size, c.name
        FROM foods f
        LEFT JOIN categories c ON f.category_id = c.id
        WHERE f.name LIKE ?
        ORDER BY f.name
        LIMIT 20
    """, (f"%{query}%",))

    results = cursor.fetchall()
    if not results:
        print(f"'{query}' icin sonuc bulunamadi.")
        return

    print(f"'{query}' icin {len(results)} sonuc:\n")
    for row in results:
        print(f"  {row[0]}")
        print(f"    Kategori: {row[7] or '-'}")
        print(f"    Porsiyon: {row[6] or '-'}")
        print(f"    Kalori: {row[1] or '-'} kcal")
        print(f"    Protein: {row[2] or '-'} g | Karbonhidrat: {row[3] or '-'} g | Yag: {row[4] or '-'} g | Lif: {row[5] or '-'} g")
        print()

    conn.close()


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        search_food(" ".join(sys.argv[1:]))
    else:
        show_stats()
