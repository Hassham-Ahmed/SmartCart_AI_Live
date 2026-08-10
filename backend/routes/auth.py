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

        return {
            "message": "Login Successful!",
            "user": {
                "id": user["id"],
                "full_name": user["full_name"],
                "email": user["email"]
            }
        }

    return {
        "message": "Invalid Email or Password"
    }, 401