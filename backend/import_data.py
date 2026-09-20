import os
import re
import pandas as pd
from PIL import Image
from config import get_db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ✅ Backend URL — images yahan se serve hongi
BACKEND_URL = "https://smart-cart-ai-live.vercel.app"

EXCEL_FILE = os.path.join(BASE_DIR, "Copy-of-fyp-products.xlsx")
if not os.path.exists(EXCEL_FILE):
    EXCEL_FILE = os.path.join(os.path.dirname(BASE_DIR), "Copy-of-fyp-products.xlsx")

IMAGE_FOLDER = os.path.join(BASE_DIR, "static", "images")

print("--------------------------------------------------")
print(f"Step 1: Reading Excel file: {EXCEL_FILE}")

if not os.path.exists(EXCEL_FILE):
    print("❌ Error: Excel file nahi mili!")
    exit()

xls = pd.ExcelFile(EXCEL_FILE)

# Image Map: full URL save karega
image_map = {}
if os.path.exists(IMAGE_FOLDER):
    for file in os.listdir(IMAGE_FOLDER):
        if file.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            name_without_ext = os.path.splitext(file)[0].strip().lower()
            image_map[name_without_ext] = {
                "rel_path": os.path.join("static", "images", file),
                "full_url": f"{BACKEND_URL}/static/images/{file}",
                matched_image = img_info["full_url"]
            }

def is_valid_image(filepath):
    if not os.path.exists(filepath):
        return False
    try:
        with Image.open(filepath) as img:
            img.verify()
        return True
    except Exception:
        return False

def parse_price(val):
    if pd.isna(val):
        return 0.0
    nums = re.sub(r'[^\d]', '', str(val))
    return float(nums) if nums else 0.0

db = get_db()
cursor = db.cursor()

print("Step 2: Creating all database tables if not exist...")

cursor.execute("""
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    category VARCHAR(100),
    price DECIMAL(10, 2),
    stock INT DEFAULT 10,
    image VARCHAR(500),
    description TEXT
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    city VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(50) DEFAULT 'Active',
    address TEXT,
    profile_image VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS shopping_cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    product_id INT,
    quantity INT DEFAULT 1
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS wishlist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    product_id INT
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    payment_method VARCHAR(255),
    shipping_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT,
    user_id INT,
    rating INT,
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS subscribers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS contact_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255),
    email VARCHAR(255),
    subject VARCHAR(255),
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

db.commit()
print("✅ Tables create/verify ho gayi hain!")

try:
    cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
    cursor.execute("TRUNCATE TABLE products;")
    cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
    db.commit()

    success_count = 0
    skipped_count = 0

    for sheet_name in xls.sheet_names:
        df_sheet = pd.read_excel(xls, sheet_name=sheet_name)
        sheet_added = 0

        for index, row in df_sheet.iterrows():
            row_dict = {str(k).strip(): v for k, v in row.to_dict().items()}

            product_name = str(row_dict.get('PRODUCT NAME', row_dict.get('MODEL', ''))).strip()
            raw_product_id = row_dict.get('PRODUCT ID', '')
            product_id_str = str(raw_product_id).strip().lower() if pd.notna(raw_product_id) else ''

            if not product_name or product_name.lower() == 'nan':
                continue

            img_info = image_map.get(product_id_str) or image_map.get(product_name.lower())

            if img_info:
                full_img_path = os.path.join(BASE_DIR, img_info["rel_path"])
                if not is_valid_image(full_img_path):
                    skipped_count += 1
                    continue
                matched_image = img_info["full_url"]
            else:
                skipped_count += 1
                continue

            price = parse_price(row_dict.get('Price(PKR)', row_dict.get('Price', 0)))
            stock_val = row_dict.get('STOCK', row_dict.get('Stock', 10))
            try:
                stock = int(stock_val) if pd.notna(stock_val) else 10
            except (ValueError, TypeError):
                stock = 10

            brand = str(row_dict.get('BRAND', 'Generic')) if pd.notna(row_dict.get('BRAND')) else 'Generic'
            category = str(row_dict.get('CATEGORY', sheet_name)) if pd.notna(row_dict.get('CATEGORY')) else sheet_name
            desc = str(row_dict.get('DESCRIPTION', 'No description available.')) if pd.notna(row_dict.get('DESCRIPTION')) else 'No description available.'

            cursor.execute("""
                INSERT INTO products (name, brand, category, price, stock, image, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (product_name, brand, category, price, stock, matched_image, desc))

            success_count += 1
            sheet_added += 1

        print(f"✔️ Sheet '{sheet_name}': {sheet_added} products imported")

    db.commit()
    print("--------------------------------------------------")
    print(f"🎉 SUCCESS! Total {success_count} products import ho gaye. ({skipped_count} skipped)")
    print(f"ℹ️  Full image URLs DB mein save ho gayi hain.")

except Exception as e:
    db.rollback()
    print(f"❌ Error: {e}")

finally:
    cursor.close()
    db.close()