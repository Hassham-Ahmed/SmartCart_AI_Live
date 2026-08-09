from flask import Blueprint, request
from config import db

auth = Blueprint("auth", __name__)

# ---------------- REGISTER ----------------

@auth.route("/register", methods=["POST"])
def register():

    data = request.get_json()

    full_name = data["full_name"]
    email = data["email"]
    password = data["password"]
    phone = data["phone"]
    city = data["city"]

    cursor = db.cursor()

    sql = """
    INSERT INTO users (full_name, email, password, phone, city)
    VALUES (%s,%s,%s,%s,%s)
    """

    values = (
        full_name,
        email,
        password,
        phone,
        city
    )

    cursor.execute(sql, values)
    db.commit()

    return {
        "message": "User Registered Successfully!"
    }


# ---------------- LOGIN ----------------

@auth.route("/login", methods=["POST"])
def login():

    data = request.get_json()

    email = data["email"]
    password = data["password"]

    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, email, password FROM users")
    print(cursor.fetchall())
    sql = """
    SELECT * FROM users
    WHERE email=%s AND password=%s
    """

    print("Email:", email)
    print("Password:", password)

    cursor.execute(sql, (email, password))

    user = cursor.fetchone()

    print("User:", user)

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