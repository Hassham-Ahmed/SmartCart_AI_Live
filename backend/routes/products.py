from flask import Blueprint
from config import db

products = Blueprint("products", __name__)

@products.route("/", methods=["GET"])
def get_products():

    cursor = db.cursor(dictionary=True)

    cursor.execute("SELECT * FROM products")

    all_products = cursor.fetchall()
    print(all_products)
    return all_products