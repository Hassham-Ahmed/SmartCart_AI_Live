from flask import Blueprint, request
from config import get_db

auth = Blueprint("auth", __name__)

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

    return {
        "message": "User Registered Successfully!"
    }


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

        # Check if user is blocked
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

    return {
        "message": "Invalid Email or Password"
    }, 401

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

    cursor.execute(

        "DELETE FROM users WHERE id=%s",

        (id,)

    )

    db.commit()

    cursor.close()

    db.close()

    return {

        "message":"User Deleted Successfully!"

    }

    # ---------------- TOGGLE USER STATUS ----------------

@auth.route("/toggle-status/<int:id>", methods=["PUT"])
def toggle_status(id):

    db = get_db()
    cursor = db.cursor(dictionary=True)

    # Get current status
    cursor.execute(
        "SELECT status, role FROM users WHERE id=%s",
        (id,)
    )

    user = cursor.fetchone()

    # Never allow blocking an admin
    if user["role"] == "admin":

        cursor.close()
        db.close()

        return {
            "message": "Admin account cannot be blocked."
        }, 403

    new_status = "Blocked" if user["status"] == "Active" else "Active"

    cursor = db.cursor()

    cursor.execute(
        "UPDATE users SET status=%s WHERE id=%s",
        (new_status, id)
    )

    db.commit()

    cursor.close()
    db.close()

    return {
        "message": f"User status changed to {new_status}"
    }