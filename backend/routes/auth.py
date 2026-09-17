import os
import tempfile
from werkzeug.utils import secure_filename
from flask import Blueprint, request
from config import get_db

auth = Blueprint("auth", __name__)

# Save directory configuration for Profile Pictures
UPLOAD_FOLDER = os.path.join(tempfile.gettempdir(), "uploads", "profiles")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ---------------- REGISTER ----------------
@auth.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    db = get_db()
    cursor = db.cursor()

    sql = """
    INSERT INTO users
    (full_name, email, password, phone, city)
    VALUES (%s,%s,%s,%s,%s)
    """

    values = (
        data["full_name"],
        data["email"],
        data["password"],
        data["phone"],
        data["city"]
    )

    cursor.execute(sql, values)
    db.commit()

    cursor.close()
    db.close()

    return {"message": "User Registered Successfully!"}


# ---------------- LOGIN ----------------
@auth.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data["email"]
    password = data["password"]

    db = get_db()
    cursor = db.cursor(dictionary=True)

    sql = """
    SELECT *
    FROM users
    WHERE email=%s AND password=%s
    """

    cursor.execute(sql, (email, password))
    user = cursor.fetchone()

    cursor.close()
    db.close()

    if user:
        if user["status"] == "Blocked":
            return {
                "message": "Your account has been blocked. Please contact the administrator."
            }, 403

        return {
            "message": "Login Successful!",
            "user": {
                "id": user["id"],
                "full_name": user["full_name"],
                "email": user["email"],
                "role": user["role"]
            }
        }

    return {"message": "Invalid Email or Password"}, 401


# ---------------- GET ALL USERS (ADMIN) ----------------
@auth.route("/admin/users", methods=["GET"])
def get_all_users():
    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT
            id,
            full_name,
            email,
            phone,
            city,
            role,
            status
        FROM users
        ORDER BY id DESC
    """)

    users = cursor.fetchall()
    cursor.close()
    db.close()

    return users


# ---------------- DELETE USER ----------------
@auth.route("/delete-user/<int:id>", methods=["DELETE"])
def delete_user(id):
    db = get_db()
    cursor = db.cursor()

    cursor.execute("DELETE FROM users WHERE id=%s", (id,))
    db.commit()

    cursor.close()
    db.close()

    return {"message": "User Deleted Successfully!"}

# ---------------- TOGGLE USER STATUS ----------------
@auth.route("/toggle-status/<int:id>", methods=["PUT"])
def toggle_status(id):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute("SELECT status, role FROM users WHERE id=%s", (id,))
    user = cursor.fetchone()

    # Safety Check: Agar user ID na mile
    if not user:
        cursor.close()
        db.close()
        return {"message": "User not found!"}, 404

    if user["role"] == "admin":
        cursor.close()
        db.close()
        return {"message": "Admin account cannot be blocked."}, 403

    new_status = "Blocked" if user["status"] == "Active" else "Active"

    # Reuse existing cursor
    cursor.execute("UPDATE users SET status=%s WHERE id=%s", (new_status, id))
    db.commit()

    cursor.close()
    db.close()

    return {"message": f"User status changed to {new_status}"}


# ---------------- GET PROFILE (SINGLE FUNCTION ONLY) ----------------
@auth.route("/profile/<int:user_id>", methods=["GET"])
def get_profile(user_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT
            id,
            full_name,
            email,
            phone,
            city,
            role,
            status,
            address,
            profile_image
        FROM users
        WHERE id=%s
    """, (user_id,))

    user = cursor.fetchone()

    cursor.close()
    db.close()

    if user:
        return user

    return {"message": "User not found"}, 404


# ---------------- UPLOAD PROFILE IMAGE ----------------
@auth.route("/upload-profile-image", methods=["POST"])
def upload_profile_image():
    if "profile_image" not in request.files:
        return {"message": "No image file provided"}, 400

    file = request.files["profile_image"]
    user_id = request.form.get("user_id")

    if file.filename == "":
        return {"message": "No selected file"}, 400

    if file and user_id:
        filename = secure_filename(f"user_{user_id}_{file.filename}")
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        
        file.save(file_path)

        db = get_db()
        cursor = db.cursor()
        cursor.execute("UPDATE users SET profile_image = %s WHERE id = %s", (relative_path, user_id))
        db.commit()

        cursor.close()
        db.close()

        return {"message": "Profile picture uploaded successfully!", "image_path": relative_path}, 200

    return {"message": "Upload failed"}, 400


# ---------------- UPDATE PROFILE ----------------
@auth.route("/update-profile", methods=["PUT"])
def update_profile():
    data = request.get_json()
    db = get_db()
    cursor = db.cursor()

    cursor.execute("""
        UPDATE users
        SET
            full_name=%s,
            email=%s,
            phone=%s,
            city=%s,
            address=%s
        WHERE id=%s
    """, (
        data["full_name"],
        data["email"],
        data["phone"],
        data["city"],
        data["address"],
        data["id"]
    ))

    db.commit()
    cursor.close()
    db.close()

    return {"message": "Profile Updated Successfully!"}


# ---------------- CHANGE PASSWORD ----------------
@auth.route("/change-password", methods=["PUT"])
def change_password():
    data = request.get_json()
    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute("SELECT password FROM users WHERE id=%s", (data["id"],))
    user = cursor.fetchone()

    if not user:
        cursor.close()
        db.close()
        return {"message": "User not found"}, 404

    if user["password"] != data["current_password"]:
        cursor.close()
        db.close()
        return {"message": "Current Password is incorrect"}, 401

    cursor.execute("""
        UPDATE users
        SET password=%s
        WHERE id=%s
    """, (data["new_password"], data["id"]))

    db.commit()
    cursor.close()
    db.close()

    return {"message": "Password Updated Successfully!"}


# ---------------- CONTACT ----------------
@auth.route("/contact", methods=["POST"])
def contact():
    data = request.get_json()
    db = get_db()
    cursor = db.cursor()

    cursor.execute("""
        INSERT INTO contact_messages
        (full_name, email, subject, message)
        VALUES (%s,%s,%s,%s)
    """, (
        data["full_name"],
        data["email"],
        data["subject"],
        data["message"]
    ))

    db.commit()
    cursor.close()
    db.close()

    return {"message": "Message Sent Successfully!"}


# ---------------- GET CONTACT MESSAGES ----------------
@auth.route("/contact-messages", methods=["GET"])
def get_contact_messages():
    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT *
        FROM contact_messages
        ORDER BY created_at DESC
    """)

    messages = cursor.fetchall()
    cursor.close()
    db.close()

    return messages


# ---------------- DELETE MESSAGE ----------------
@auth.route("/delete-message/<int:id>", methods=["DELETE"])
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
    data = request.get_json()
    email = data.get("email")

    if not email:
        return {"message": "Email is required!"}, 400

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute("SELECT id FROM subscribers WHERE email = %s", (email,))
        existing = cursor.fetchone()

        if existing:
            cursor.close()
            db.close()
            return {"message": "Aap pehle se subscribed hain!"}, 400

        cursor.execute("INSERT INTO subscribers (email) VALUES (%s)", (email,))
        db.commit()

        cursor.close()
        db.close()

        return {"message": "Newsletter subscribe ho gaya hai!"}, 200

    except Exception as e:
        return {"message": f"Error: {str(e)}"}, 500