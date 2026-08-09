from flask import Blueprint, request
from config import db

products = Blueprint("products", __name__)


# ---------------- GET PRODUCTS ----------------

@products.route("/", methods=["GET"])
def get_products():

    cursor = db.cursor(dictionary=True)

    cursor.execute("SELECT * FROM products")

    all_products = cursor.fetchall()

    return all_products


# ---------------- ADD TO CART ----------------

@products.route("/add-to-cart", methods=["POST"])
def add_to_cart():

    data = request.get_json()

    user_id = data["user_id"]
    product_id = data["product_id"]
    quantity = data.get("quantity", 1)

    cursor = db.cursor()

    sql = """
    INSERT INTO shopping_cart (user_id, product_id, quantity)
    VALUES (%s, %s, %s)
    """

    cursor.execute(sql, (user_id, product_id, quantity))
    db.commit()

    return {
        "message": "Product added to cart successfully!"
    }