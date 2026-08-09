from flask import Blueprint, request
from config import db

auth = Blueprint("auth", __name__)

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