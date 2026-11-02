import os
import re
import tempfile
import uuid

from flask import Blueprint, request
from werkzeug.utils import secure_filename

from config import get_db
from security import (
    admin_required, current_user, forbidden, hash_password, issue_token, login_required, owns, verify_password,
)

auth = Blueprint("auth", __name__)

# Vercel's filesystem is read-only except /tmp (and /tmp is wiped between
# invocations) - see "Needs Your Input" about moving avatars to Cloudinary.
UPLOAD_FOLDER = os.path.join(tempfile.gettempdir(), "uploads", "profiles")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_IMAGE_EXT = {"png", "jpg", "jpeg", "webp"}

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _body():
    return request.get_json(silent=True) or {}


def _str(data, key, max_len=255, required=False):
    val = str(data.get(key) or "").strip()
    if required and not val:
        raise ValueError(f"{key.replace('_', ' ').title()} is required.")
    if len(val) > max_len:
        raise ValueError(f"{key.replace('_', ' ').title()} is too long.")
    return val


# ---------------- REGISTER ----------------
@auth.route("/register", methods=["POST"])
def register():
    data = _body()
    try:
        full_name = _str(data, "full_name", 150, required=True)
        email = _str(data, "email", 150, required=True).lower()
        password = str(data.get("password") or "")
        phone = _str(data, "phone", 30)
        city = _str(data, "city", 100)
    except ValueError as e:
        return {"message": str(e)}, 400
    if not EMAIL_RE.match(email):
        return {"message": "Please enter a valid email address."}, 400
    if len(password) < 6:
        return {"message": "Password must be at least 6 characters."}, 400

    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE email=%s", (email,))
        if cursor.fetchone():
            return {"message": "An account with this email already exists."}, 409
        cursor.execute(
            "INSERT INTO users (full_name, email, password, phone, city) VALUES (%s,%s,%s,%s,%s)",
            (full_name, email, hash_password(password), phone, city),
        )
        db.commit()
    finally:
        cursor.close()
        db.close()
    return {"message": "User Registered Successfully!"}


# ---------------- LOGIN ----------------
@auth.route("/login", methods=["POST"])
def login():
    data = _body()
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    if not email or not password:
        return {"message": "Email and password are required."}, 400

    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM users WHERE LOWER(email)=%s", (email,))
        user = cursor.fetchone()
        ok, needs_upgrade = verify_password(user["password"], password) if user else (False, False)
        if not ok:
            return {"message": "Invalid Email or Password"}, 401
        if user["status"] == "Blocked":
            return {"message": "Your account has been blocked. Please contact the administrator."}, 403
        if needs_upgrade:  # transparently migrate legacy plaintext password to a hash
            cursor.execute("UPDATE users SET password=%s WHERE id=%s", (hash_password(password), user["id"]))
            db.commit()
    finally:
        cursor.close()
        db.close()

    return {
        "message": "Login Successful!",
        "token": issue_token(user),
        "user": {"id": user["id"], "full_name": user["full_name"], "email": user["email"], "role": user["role"]},
    }


# ---------------- GET ALL USERS (ADMIN) ----------------
@auth.route("/admin/users", methods=["GET"])
@admin_required
def get_all_users():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, full_name, email, phone, city, role, status FROM users ORDER BY id DESC")
    users = cursor.fetchall()
    cursor.close()
    db.close()
    return users


# ---------------- DELETE USER (ADMIN) ----------------
@auth.route("/delete-user/<int:id>", methods=["DELETE"])
@admin_required
def delete_user(id):
    if id == current_user()["id"]:
        return {"message": "You cannot delete your own admin account."}, 400
    db = get_db()
    cursor = db.cursor()
    cursor.execute("DELETE FROM users WHERE id=%s AND role <> 'admin'", (id,))
    db.commit()
    deleted = cursor.rowcount
    cursor.close()
    db.close()
    if not deleted:
        return {"message": "User not found or is an administrator."}, 404
    return {"message": "User Deleted Successfully!"}


# ---------------- TOGGLE USER STATUS (ADMIN) ----------------
@auth.route("/toggle-status/<int:id>", methods=["PUT"])
@admin_required
def toggle_status(id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT status, role FROM users WHERE id=%s", (id,))
    user = cursor.fetchone()

    if not user:
        cursor.close()
        db.close()
        return {"message": "User not found!"}, 404

    if user["role"] == "admin":
        cursor.close()
        db.close()
        return {"message": "Admin account cannot be blocked."}, 403

    new_status = "Blocked" if user["status"] == "Active" else "Active"
    cursor.execute("UPDATE users SET status=%s WHERE id=%s", (new_status, id))
    db.commit()
    cursor.close()
    db.close()
    return {"message": f"User status changed to {new_status}"}


# ---------------- GET PROFILE ----------------
@auth.route("/profile/<int:user_id>", methods=["GET"])
@login_required
def get_profile(user_id):
    if not owns(user_id):
        return forbidden()
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT id, full_name, email, phone, city, role, status, address, profile_image FROM users WHERE id=%s",
        (user_id,),
    )
    user = cursor.fetchone()
    cursor.close()
    db.close()
    if user:
        return user
    return {"message": "User not found"}, 404


# ---------------- UPLOAD PROFILE IMAGE ----------------
@auth.route("/upload-profile-image", methods=["POST"])
@login_required
def upload_profile_image():
    if "profile_image" not in request.files:
        return {"message": "No image file provided"}, 400
    file = request.files["profile_image"]
    if not file or file.filename == "":
        return {"message": "No selected file"}, 400
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_IMAGE_EXT or not (file.mimetype or "").startswith("image/"):
        return {"message": "Only PNG, JPG or WEBP images are allowed."}, 400

    user_id = current_user()["id"]  # never trust a user_id from the form
    filename = secure_filename(f"user_{user_id}_{uuid.uuid4().hex[:8]}.{ext}")
    file.save(os.path.join(UPLOAD_FOLDER, filename))
    # BUGFIX: `relative_path` was referenced but never defined -> NameError on every upload.
    relative_path = f"uploads/profiles/{filename}"

    db = get_db()
    cursor = db.cursor()
    cursor.execute("UPDATE users SET profile_image = %s WHERE id = %s", (relative_path, user_id))
    db.commit()
    cursor.close()
    db.close()
    return {"message": "Profile picture uploaded successfully!", "image_path": relative_path}, 200


# ---------------- UPDATE PROFILE ----------------
@auth.route("/update-profile", methods=["PUT"])
@login_required
def update_profile():
    data = _body()
    user_id = current_user()["id"]
    try:
        full_name = _str(data, "full_name", 150, required=True)
        email = _str(data, "email", 150, required=True).lower()
        phone = _str(data, "phone", 30)
        city = _str(data, "city", 100)
        address = _str(data, "address", 255)
    except ValueError as e:
        return {"message": str(e)}, 400
    if not EMAIL_RE.match(email):
        return {"message": "Please enter a valid email address."}, 400

    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE email=%s AND id<>%s", (email, user_id))
        if cursor.fetchone():
            return {"message": "That email is already used by another account."}, 409
        cursor.execute(
            "UPDATE users SET full_name=%s, email=%s, phone=%s, city=%s, address=%s WHERE id=%s",
            (full_name, email, phone, city, address, user_id),
        )
        db.commit()
    finally:
        cursor.close()
        db.close()
    return {"message": "Profile Updated Successfully!"}


# ---------------- CHANGE PASSWORD ----------------
@auth.route("/change-password", methods=["PUT"])
@login_required
def change_password():
    data = _body()
    user_id = current_user()["id"]
    new_password = str(data.get("new_password") or "")
    if len(new_password) < 6:
        return {"message": "New password must be at least 6 characters."}, 400

    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT password FROM users WHERE id=%s", (user_id,))
        user = cursor.fetchone()
        if not user:
            return {"message": "User not found"}, 404
        ok, _ = verify_password(user["password"], str(data.get("current_password") or ""))
        if not ok:
            return {"message": "Current Password is incorrect"}, 401
        cursor.execute("UPDATE users SET password=%s WHERE id=%s", (hash_password(new_password), user_id))
        db.commit()
    finally:
        cursor.close()
        db.close()
    return {"message": "Password Updated Successfully!"}


# ---------------- CONTACT ----------------
@auth.route("/contact", methods=["POST"])
def contact():
    data = _body()
    try:
        full_name = _str(data, "full_name", 150, required=True)
        email = _str(data, "email", 150, required=True)
        subject = _str(data, "subject", 200, required=True)
        message = _str(data, "message", 5000, required=True)
    except ValueError as e:
        return {"message": str(e)}, 400
    if not EMAIL_RE.match(email):
        return {"message": "Please enter a valid email address."}, 400

    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO contact_messages (full_name, email, subject, message) VALUES (%s,%s,%s,%s)",
        (full_name, email, subject, message),
    )
    db.commit()
    cursor.close()
    db.close()
    return {"message": "Message Sent Successfully!"}


# ---------------- GET CONTACT MESSAGES (ADMIN) ----------------
@auth.route("/contact-messages", methods=["GET"])
@admin_required
def get_contact_messages():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM contact_messages ORDER BY created_at DESC")
    messages = cursor.fetchall()
    cursor.close()
    db.close()
    return messages


# ---------------- DELETE MESSAGE (ADMIN) ----------------
@auth.route("/delete-message/<int:id>", methods=["DELETE"])
@admin_required
def delete_message(id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("DELETE FROM contact_messages WHERE id=%s", (id,))
    db.commit()
    cursor.close()
    db.close()
    return {"message": "Message Deleted Successfully!"}


# ---------------- SUBSCRIBE TO NEWSLETTER ----------------
@auth.route("/subscribe", methods=["POST"])
def subscribe():
    email = str(_body().get("email") or "").strip().lower()
    if not email or not EMAIL_RE.match(email) or len(email) > 150:
        return {"message": "Please enter a valid email address."}, 400

    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM subscribers WHERE email = %s", (email,))
        if cursor.fetchone():
            return {"message": "You're already subscribed!"}, 400
        cursor.execute("INSERT INTO subscribers (email) VALUES (%s)", (email,))
        db.commit()
        return {"message": "You're subscribed! Watch your inbox for updates."}, 200
    except Exception as e:  # noqa: BLE001
        print("SUBSCRIBE ERROR:", e)
        return {"message": "Could not subscribe right now. Please try again."}, 500
    finally:
        cursor.close()
        db.close()
