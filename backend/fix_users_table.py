"""
Users table fix script.
- Agar `name` column hai to use `full_name` rename karega
- Missing columns add karega
- Structure print karega
"""
from config import get_db


def main():
    db = get_db()
    cursor = db.cursor()

    print("=" * 60)
    print("USERS TABLE — CURRENT STRUCTURE")
    print("=" * 60)

    cursor.execute("DESCRIBE users")
    cols = []
    for row in cursor.fetchall():
        print(f"  {row[0]:25} | {row[1]}")
        cols.append(row[0].lower())

    print("\n" + "=" * 60)
    print("APPLYING FIXES...")
    print("=" * 60)

    # 1) name -> full_name rename
    if "name" in cols and "full_name" not in cols:
        try:
            cursor.execute("ALTER TABLE users CHANGE name full_name VARCHAR(255)")
            db.commit()
            print("✅ 'name' -> 'full_name' rename ho gaya")
        except Exception as e:
            print(f"❌ Rename fail: {e}")
    elif "full_name" in cols:
        print("ℹ️  'full_name' already mojood hai")
    else:
        print("⚠️  Na 'name' hai na 'full_name'")

    # 2) Missing columns add karo
    cursor.execute("DESCRIBE users")
    cols = [r[0].lower() for r in cursor.fetchall()]

    required = {
        "phone": "VARCHAR(50)",
        "city": "VARCHAR(100)",
        "role": "VARCHAR(50) DEFAULT 'user'",
        "status": "VARCHAR(50) DEFAULT 'Active'",
        "address": "TEXT",
        "profile_image": "VARCHAR(500)",
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    }

    for col, col_type in required.items():
        if col not in cols:
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {col_type}")
                db.commit()
                print(f"✅ '{col}' column add ho gaya")
            except Exception as e:
                print(f"⚠️  '{col}' add nahi hua: {str(e)[:80]}")
        else:
            print(f"ℹ️  '{col}' already mojood hai")

    # 3) Final structure
    print("\n" + "=" * 60)
    print("USERS TABLE — NAYA STRUCTURE")
    print("=" * 60)
    cursor.execute("DESCRIBE users")
    for row in cursor.fetchall():
        print(f"  {row[0]:25} | {row[1]}")

    # 4) Users count
    cursor.execute("SELECT COUNT(*) FROM users")
    total = cursor.fetchone()[0]
    print(f"\n📊 Total users: {total}")

    if total > 0:
        cursor.execute("SELECT id, full_name, email, role, status FROM users LIMIT 20")
        print("\n👥 Users:")
        for row in cursor.fetchall():
            print(f"   ID: {row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]}")

    cursor.close()
    db.close()
    print("\n🎉 Ho gaya!")


if __name__ == "__main__":
    main()