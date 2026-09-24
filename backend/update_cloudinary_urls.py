"""
Cloudinary se saari images ki list fetch karo aur
products table mein image URLs update karo.

Smart matching:
- Case ignore
- Spaces aur underscores dono handle
- Extension ignore (jpg/png/webp sab same treat)
"""
import os
import re
from dotenv import load_dotenv
import cloudinary
import cloudinary.api
from config import get_db

load_dotenv()

# Cloudinary credentials .env se padho
CLOUD_NAME = os.getenv("CLOUD_NAME")
API_KEY = os.getenv("CLOUD_API_KEY") or os.getenv("API_KEY")
API_SECRET = os.getenv("CLOUD_API_SECRET") or os.getenv("API_SECRET")

if not CLOUD_NAME or not API_KEY or not API_SECRET:
    print("❌ Cloudinary credentials .env mein nahi mile!")
    print("   CLOUD_NAME, CLOUD_API_KEY, CLOUD_API_SECRET set karo.")
    exit()

cloudinary.config(
    cloud_name=CLOUD_NAME,
    api_key=API_KEY,
    api_secret=API_SECRET,
    secure=True,
)

print("--------------------------------------------------")
print("Step 1: Cloudinary se saari images fetch kar rahe hain...")

all_resources = []
next_cursor = None

while True:
    response = cloudinary.api.resources(
        type="upload",
        max_results=500,
        next_cursor=next_cursor,
    )
    all_resources.extend(response.get("resources", []))
    next_cursor = response.get("next_cursor")
    if not next_cursor:
        break

print(f"✅ Total {len(all_resources)} images Cloudinary par mili.")


def normalize_key(name):
    """Filename ko compare karne ke liye normalize karo."""
    if not name:
        return ""
    name = os.path.splitext(name)[0]
    name = name.lower()
    name = re.sub(r'[^a-z0-9]', '', name)
    return name


cloudinary_map = {}
for resource in all_resources:
    public_id = resource["public_id"]
    filename_with_ext = public_id.split("/")[-1]
    secure_url = resource["secure_url"]
    key = normalize_key(filename_with_ext)
    cloudinary_map[key] = secure_url

print(f"✅ {len(cloudinary_map)} unique keys ka map bana.")

print("--------------------------------------------------")
print("Step 2: Database update kar rahe hain...")

db = get_db()
cursor = db.cursor(dictionary=True)

cursor.execute("SELECT id, name, image FROM products")
products = cursor.fetchall()

update_cursor = db.cursor()
updated = 0
already_cloudinary = 0
not_found = 0
missing = []

for p in products:
    if not p["image"]:
        not_found += 1
        continue

    if p["image"].startswith("https://res.cloudinary.com"):
        already_cloudinary += 1
        continue

    old_filename = os.path.basename(p["image"])
    lookup_key = normalize_key(old_filename)

    if lookup_key in cloudinary_map:
        new_url = cloudinary_map[lookup_key]
        update_cursor.execute(
            "UPDATE products SET image=%s WHERE id=%s",
            (new_url, p["id"])
        )
        updated += 1
    else:
        not_found += 1
        missing.append(old_filename)

db.commit()

print("--------------------------------------------------")
print(f"🎉 SUCCESS!")
print(f"✅ {updated} products ki image URLs update ho gayin.")
print(f"ℹ️  {already_cloudinary} products already Cloudinary URLs use kar rahe the.")
print(f"⚠️  {not_found} products ki images Cloudinary par nahi mili.")

if missing:
    print(f"\n❌ Ye filenames Cloudinary par nahi mili (pehli 15):")
    for m in missing[:15]:
        print(f"   - {m}")

cursor.execute("SELECT COUNT(*) AS total FROM products WHERE image LIKE 'https://res.cloudinary.com%'")
result = cursor.fetchone()
print(f"\n📊 Total products with Cloudinary URLs: {result['total']}")

update_cursor.close()
cursor.close()
db.close()