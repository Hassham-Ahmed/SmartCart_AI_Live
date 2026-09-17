import os
import re
import pandas as pd
from PIL import Image  # Added Pillow for integrity verification
from config import get_db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

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

# Image Map: Stores lowercased names and Product IDs
image_map = {}
if os.path.exists(IMAGE_FOLDER):
    for file in os.listdir(IMAGE_FOLDER):
        if file.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            name_without_ext = os.path.splitext(file)[0].strip().lower()
            image_map[name_without_ext] = f"static/images/{file}"

def is_valid_image(filepath):
    """Check if image file exists and is not corrupted"""
    if not os.path.exists(filepath):
        return False
    try:
        with Image.open(filepath) as img:
            img.verify() # Verify image integrity
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

            # Strict Image Matching & Verification (No Default Fallbacks)
            image_rel_path = image_map.get(product_id_str) or image_map.get(product_name.lower())
            
            if image_rel_path:
                full_img_path = os.path.join(BASE_DIR, image_rel_path)
                if not is_valid_image(full_img_path):
                    skipped_count += 1
                    continue # Corrupt image product skipped
                matched_image = image_rel_path
            else:
                skipped_count += 1
                continue # Missing image product skipped

            price = parse_price(row_dict.get('Price(PKR)', row_dict.get('Price', 0)))
            stock_val = row_dict.get('STOCK', row_dict.get('Stock', 10))
            try:
                stock = int(stock_val) if pd.notna(stock_val) else 10
            except (ValueError, TypeError):
                stock = 10

            brand = str(row_dict.get('BRAND', 'Generic')) if pd.notna(row_dict.get('BRAND')) else 'Generic'
            category = str(row_dict.get('CATEGORY', sheet_name)) if pd.notna(row_dict.get('CATEGORY')) else sheet_name
            desc = str(row_dict.get('DESCRIPTION', 'No description available.')) if pd.notna(row_dict.get('DESCRIPTION')) else 'No description available.'

            sql = """
            INSERT INTO products (name, brand, category, price, stock, image, description)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            values = (product_name, brand, category, price, stock, matched_image, desc)
            
            cursor.execute(sql, values)
            success_count += 1
            sheet_added += 1

        print(f"✔️ Sheet '{sheet_name}': {sheet_added} products imported")

    db.commit()
    print("--------------------------------------------------")
    print(f"🎉 SUCCESS! Total {success_count} valid products imported. ({skipped_count} skipped due to broken/missing images)")

except Exception as e:
    db.rollback()
    print(f"❌ Error: {e}")

finally:
    cursor.close()
    db.close()