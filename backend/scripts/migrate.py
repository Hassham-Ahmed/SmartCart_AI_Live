"""
One-off, idempotent database migration. Safe to run multiple times.

    cd backend
    python -m scripts.migrate

What it does
  1. Creates the new tables (order_items, product_embeddings, ai_sessions,
     ai_user_profiles, product_views, ai_chat_logs).
  2. Adds a nullable `specs` column to `products` and fills it from the real
     Excel catalog (Copy-of-fyp-products.xlsx): storage, processor, RAM, GPU,
     use type... Those specs were dropped by import_data.py, which is why
     most products only said "No description available.". Specs make both
     the embeddings and get_product_details() far more useful.
  3. Widens users.password to 255 chars so hashed passwords fit.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from config import get_db  # noqa: E402
from db_schema import ensure_schema  # noqa: E402

EXCEL = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Copy-of-fyp-products.xlsx")
NON_SPEC = {"PRODUCT ID", "PRODUCT NAME", "MODEL", "BRAND", "CATEGORY", "PRICE(PKR)", "PRICE", "STOCK",
            "RATING", "IMAGE PATH", "DESCRIPTION"}


def column_exists(cur, table, column):
    cur.execute(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s AND COLUMN_NAME=%s",
        (table, column),
    )
    return cur.fetchone()[0] > 0


def read_specs():
    """{(name, brand, category) lowercased: 'Processor: ...; RAM: ...'}"""
    import openpyxl

    wb = openpyxl.load_workbook(EXCEL, read_only=True)
    specs = {}
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue
        header = [str(h or "").strip() for h in rows[0]]
        upper = [h.upper() for h in header]
        name_col = upper.index("PRODUCT NAME") if "PRODUCT NAME" in upper else upper.index("MODEL")
        for r in rows[1:]:
            name = str(r[name_col] or "").strip()
            if not name:
                continue
            brand = str(r[upper.index("BRAND")] or "Generic").strip()
            cat = str(r[upper.index("CATEGORY")] or ws.title).strip()
            pairs = []
            for h, hu, v in zip(header, upper, r):
                if hu in NON_SPEC or v is None or str(v).strip() == "":
                    continue
                pairs.append(f"{h.title()}: {str(v).strip()}")
            if pairs:
                specs[(name.lower(), brand.lower(), cat.lower())] = "; ".join(pairs)
    return specs


def main():
    print("1/3 creating tables...")
    ensure_schema()

    db = get_db()
    cur = db.cursor()
    try:
        print("2/3 products.specs column...")
        if not column_exists(cur, "products", "specs"):
            cur.execute("ALTER TABLE products ADD COLUMN specs TEXT NULL")
            db.commit()
        if os.path.exists(EXCEL):
            specs = read_specs()
            cur.execute("SELECT id, name, brand, category FROM products")
            updates = []
            for pid, name, brand, cat in cur.fetchall():
                s = specs.get(((name or "").lower().strip(), (brand or "generic").lower().strip(), (cat or "").lower().strip()))
                if s:
                    updates.append((s, pid))
            cur.executemany("UPDATE products SET specs=%s WHERE id=%s", updates)
            db.commit()
            print(f"   specs filled for {len(updates)} products")
        else:
            print("   Excel file not found - skipping specs enrichment")

        print("3/3 users.password width...")
        cur.execute("ALTER TABLE users MODIFY password VARCHAR(255) NOT NULL")
        db.commit()
    finally:
        cur.close()
        db.close()
    print("Done. Next: python -m scripts.embed_products")


if __name__ == "__main__":
    main()
