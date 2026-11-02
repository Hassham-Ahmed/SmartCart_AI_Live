from flask import Blueprint, jsonify, request

from config import get_db
from db_schema import ensure_schema
from security import admin_required, current_user, forbidden, login_required, owns
from services.orders import get_order, place_order as place_order_service, sanitize_payment

products = Blueprint("products", __name__)

PRODUCT_FIELDS = ("name", "brand", "category", "price", "stock", "image", "description")


def _body():
    return request.get_json(silent=True) or {}


def _int(value, default=None, lo=None, hi=None):
    try:
        v = int(value)
    except (TypeError, ValueError):
        return default
    if lo is not None and v < lo:
        return default
    if hi is not None and v > hi:
        return default
    return v


def _invalidate_ai_index():
    """Product data changed -> rebuild the in-memory vector index on next chat."""
    try:
        from ai.vector_store import invalidate
        invalidate()
    except Exception:  # noqa: BLE001
        pass


def _validate_product(data):
    errors = []
    clean = {}
    for f in ("name", "category"):
        clean[f] = str(data.get(f) or "").strip()
        if not clean[f]:
            errors.append(f"{f} is required")
    clean["brand"] = str(data.get("brand") or "").strip()[:100]
    clean["image"] = str(data.get("image") or "").strip()[:500]
    clean["description"] = str(data.get("description") or "").strip()
    try:
        clean["price"] = float(data.get("price"))
        if clean["price"] < 0:
            raise ValueError
    except (TypeError, ValueError):
        errors.append("price must be a positive number")
    clean["stock"] = _int(data.get("stock"), default=None, lo=0)
    if clean["stock"] is None:
        errors.append("stock must be a whole number >= 0")
    return clean, errors


# ---------------- GET PRODUCTS ----------------
@products.route("/", methods=["GET"])
def get_products():
    category = request.args.get("category")
    search = (request.args.get("search") or "").strip()[:100]

    db = get_db()
    cursor = db.cursor(dictionary=True)
    sql = "SELECT * FROM products WHERE 1=1"
    values = []
    if category:
        sql += " AND category=%s"
        values.append(category)
    if search:
        sql += " AND (name LIKE %s OR brand LIKE %s OR category LIKE %s)"
        keyword = f"%{search}%"
        values.extend([keyword, keyword, keyword])
    limit = _int(request.args.get("limit"), lo=1, hi=100)
    if limit:
        # home page "trending": in-stock items first, best stocked first
        sql += " ORDER BY (stock > 0) DESC, id DESC LIMIT %s"
        values.append(limit)
    cursor.execute(sql, tuple(values))
    products_data = cursor.fetchall()
    cursor.close()
    db.close()
    resp = jsonify(products_data)
    resp.headers["Cache-Control"] = "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
    return resp


# ---------------- ADD TO CART ----------------
@products.route("/add-to-cart", methods=["POST"])
@login_required
def add_to_cart():
    data = _body()
    user_id = current_user()["id"]
    product_id = _int(data.get("product_id"))
    quantity = _int(data.get("quantity", 1), default=None, lo=1, hi=50)
    if not product_id or not quantity:
        return {"message": "A valid product and quantity (1-50) are required."}, 400

    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT name, stock FROM products WHERE id=%s", (product_id,))
        product = cursor.fetchone()
        if not product:
            return {"message": "Product not found."}, 404
        cursor.execute("SELECT id, quantity FROM shopping_cart WHERE user_id=%s AND product_id=%s", (user_id, product_id))
        existing = cursor.fetchone()
        new_qty = (existing["quantity"] if existing else 0) + quantity
        if new_qty > int(product["stock"]):
            return {"message": f"Only {product['stock']} unit(s) of {product['name']} available."}, 409
        if existing:
            cursor.execute("UPDATE shopping_cart SET quantity=%s WHERE id=%s", (new_qty, existing["id"]))
        else:
            cursor.execute(
                "INSERT INTO shopping_cart (user_id, product_id, quantity) VALUES (%s, %s, %s)",
                (user_id, product_id, quantity),
            )
        db.commit()
    finally:
        cursor.close()
        db.close()
    return {"message": "Product added to cart successfully!"}


# ---------------- GET CART ----------------
@products.route("/cart/<int:user_id>", methods=["GET"])
@login_required
def get_cart(user_id):
    if not owns(user_id):
        return forbidden()
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT shopping_cart.id, shopping_cart.quantity, products.id AS product_id,
               products.name, products.price, products.image, products.stock
        FROM shopping_cart JOIN products ON shopping_cart.product_id = products.id
        WHERE shopping_cart.user_id=%s
        ORDER BY shopping_cart.id DESC
        """,
        (user_id,),
    )
    cart = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify(cart)


# ---------------- CART COUNT ----------------
@products.route("/cart-count/", defaults={"user_id": 0}, methods=["GET"])
@products.route("/cart-count/<int:user_id>", methods=["GET"])
def cart_count(user_id):
    if not user_id or not owns(user_id):
        return {"count": 0}
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT SUM(quantity) AS total FROM shopping_cart WHERE user_id=%s", (user_id,))
    result = cursor.fetchone()
    cursor.close()
    db.close()
    return {"count": int(result["total"]) if result and result["total"] is not None else 0}


def _update_cart_row(cart_id, sql):
    """Only touch cart rows that belong to the caller (previously any id could be edited)."""
    db = get_db()
    cursor = db.cursor()
    cursor.execute(sql, (cart_id, current_user()["id"]))
    db.commit()
    changed = cursor.rowcount
    cursor.close()
    db.close()
    return changed


# ---------------- INCREASE QUANTITY ----------------
@products.route("/increase/<int:cart_id>", methods=["PUT"])
@login_required
def increase_quantity(cart_id):
    changed = _update_cart_row(
        cart_id,
        """UPDATE shopping_cart c JOIN products p ON p.id = c.product_id
           SET c.quantity = c.quantity + 1
           WHERE c.id=%s AND c.user_id=%s AND c.quantity < p.stock""",
    )
    if not changed:
        return {"message": "No more stock available for this item."}, 409
    return {"message": "Quantity Increased"}


# ---------------- DECREASE QUANTITY ----------------
@products.route("/decrease/<int:cart_id>", methods=["PUT"])
@login_required
def decrease_quantity(cart_id):
    _update_cart_row(
        cart_id,
        "UPDATE shopping_cart SET quantity = GREATEST(quantity - 1, 1) WHERE id=%s AND user_id=%s",
    )
    return {"message": "Quantity Decreased"}


# ---------------- REMOVE ITEM ----------------
@products.route("/remove/<int:cart_id>", methods=["DELETE"])
@login_required
def remove_item(cart_id):
    _update_cart_row(cart_id, "DELETE FROM shopping_cart WHERE id=%s AND user_id=%s")
    return {"message": "Item Removed"}


# ---------------- PLACE ORDER ----------------
@products.route("/place-order", methods=["POST"])
@login_required
def place_order():
    data = _body()
    user_id = current_user()["id"]
    payment = sanitize_payment(data.get("payment_method"), data.get("payment_details", ""))
    res = place_order_service(
        user_id,
        data.get("shipping_address"),
        payment,
        product_id=_int(data.get("product_id")),
        quantity=_int(data.get("quantity", 1), default=1, lo=1, hi=50),
    )
    if not res.get("success"):
        return {"error": res["message"], "message": res["message"]}, 400
    return {"message": "Order Placed Successfully!", "order_id": res["order_id"], "total_amount": res["total_amount"]}


# ---------------- MY ORDERS ----------------
@products.route("/my-orders/<int:user_id>", methods=["GET"])
@login_required
def my_orders(user_id):
    if not owns(user_id):
        return forbidden()
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT id, total_amount, status, payment_method, shipping_address, created_at
           FROM orders WHERE user_id=%s ORDER BY created_at DESC""",
        (user_id,),
    )
    orders = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify(orders)


# ---------------- ORDER DETAILS / TRACKING ----------------
@products.route("/orders/<int:order_id>", methods=["GET"])
@login_required
def order_details(order_id):
    user = current_user()
    res = get_order(user["id"], order_id, is_admin=user["role"] == "admin")
    if not res.get("success"):
        return {"message": res["message"]}, 404
    return res["order"]


# ---------------- ADMIN DASHBOARD ----------------
@products.route("/admin/dashboard", methods=["GET"])
@admin_required
def admin_dashboard():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT COUNT(*) AS total_users FROM users")
    total_users = cursor.fetchone()["total_users"]
    cursor.execute("SELECT COUNT(*) AS total_products FROM products")
    total_products = cursor.fetchone()["total_products"]
    cursor.execute("SELECT COUNT(*) AS total_orders FROM orders")
    total_orders = cursor.fetchone()["total_orders"]
    cursor.execute("SELECT IFNULL(SUM(total_amount),0) AS revenue FROM orders WHERE status <> 'Cancelled'")
    revenue = cursor.fetchone()["revenue"]
    cursor.close()
    db.close()
    return {"users": total_users, "products": total_products, "orders": total_orders, "revenue": float(revenue)}


# ---------------- ADD PRODUCT (ADMIN) ----------------
@products.route("/add-product", methods=["POST"])
@admin_required
def add_product():
    clean, errors = _validate_product(_body())
    if errors:
        return {"message": "; ".join(errors)}, 400
    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO products (name, brand, category, price, stock, image, description) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        tuple(clean[f] for f in PRODUCT_FIELDS),
    )
    db.commit()
    cursor.close()
    db.close()
    _invalidate_ai_index()
    return {"message": "Product Added Successfully!"}


# ---------------- DELETE PRODUCT (ADMIN) ----------------
@products.route("/delete-product/<int:id>", methods=["DELETE"])
@admin_required
def delete_product(id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("DELETE FROM products WHERE id=%s", (id,))
    db.commit()
    cursor.close()
    db.close()
    _invalidate_ai_index()
    return {"message": "Product Deleted Successfully!"}


# ---------------- GET SINGLE PRODUCT ----------------
@products.route("/<int:id>", methods=["GET"])
def get_single_product(id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM products WHERE id=%s", (id,))
    product = cursor.fetchone()
    cursor.close()
    db.close()
    if not product:
        return {"message": "Product not found"}, 404
    return product


# ---------------- RECORD PRODUCT VIEW (personalisation) ----------------
@products.route("/<int:id>/view", methods=["POST"])
def record_view(id):
    user = current_user()
    if not user:
        return {"ok": True}  # anonymous views are not stored
    try:
        ensure_schema()
        db = get_db()
        cursor = db.cursor()
        cursor.execute("INSERT INTO product_views (user_id, product_id) VALUES (%s, %s)", (user["id"], id))
        db.commit()
        cursor.close()
        db.close()
    except Exception as e:  # noqa: BLE001
        print("view log failed:", e)
    return {"ok": True}


# ---------------- UPDATE PRODUCT (ADMIN) ----------------
@products.route("/update-product/<int:id>", methods=["PUT"])
@admin_required
def update_product(id):
    clean, errors = _validate_product(_body())
    if errors:
        return {"message": "; ".join(errors)}, 400
    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        "UPDATE products SET name=%s, brand=%s, category=%s, price=%s, stock=%s, image=%s, description=%s WHERE id=%s",
        tuple(clean[f] for f in PRODUCT_FIELDS) + (id,),
    )
    db.commit()
    cursor.close()
    db.close()
    _invalidate_ai_index()
    return {"message": "Product Updated Successfully!"}


# ---------------- GET ALL ORDERS (ADMIN) ----------------
@products.route("/admin/orders", methods=["GET"])
@admin_required
def admin_orders():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT orders.id, users.full_name, orders.total_amount, orders.payment_method,
               orders.shipping_address, orders.status, orders.created_at
        FROM orders JOIN users ON orders.user_id = users.id
        ORDER BY orders.created_at DESC
        """
    )
    orders = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify(orders)


# ---------------- UPDATE ORDER STATUS (ADMIN) ----------------
ORDER_STATUSES = {"Pending", "Processing", "Shipped", "Delivered", "Cancelled"}


@products.route("/update-order-status/<int:id>", methods=["PUT"])
@admin_required
def update_order_status(id):
    status = str(_body().get("status") or "")
    if status not in ORDER_STATUSES:
        return {"message": f"Status must be one of: {', '.join(sorted(ORDER_STATUSES))}"}, 400
    db = get_db()
    cursor = db.cursor()
    cursor.execute("UPDATE orders SET status=%s WHERE id=%s", (status, id))
    db.commit()
    cursor.close()
    db.close()
    return {"message": "Order Status Updated Successfully!"}


# ---------------- ADD TO WISHLIST ----------------
@products.route("/add-to-wishlist", methods=["POST"])
@login_required
def add_to_wishlist():
    data = _body()
    user_id = current_user()["id"]
    product_id = _int(data.get("product_id"))
    if not product_id:
        return jsonify({"message": "Product ID is required."}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM wishlist WHERE user_id=%s AND product_id=%s", (user_id, product_id))
        if cursor.fetchone():
            return jsonify({"message": "This product is already in your wishlist."}), 200
        cursor.execute("INSERT INTO wishlist (user_id, product_id) VALUES (%s, %s)", (user_id, product_id))
        db.commit()
        return jsonify({"message": "Added to your wishlist! ❤️"}), 200
    except Exception as e:  # noqa: BLE001
        print("Wishlist Error:", str(e))
        return jsonify({"message": "Could not update wishlist right now."}), 500
    finally:
        cursor.close()
        db.close()


# ---------------- GET WISHLIST ----------------
@products.route("/wishlist/<int:user_id>", methods=["GET"])
@login_required
def get_wishlist(user_id):
    if not owns(user_id):
        return forbidden()
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT wishlist.id, products.id AS product_id, products.name, products.price, products.image, products.category
        FROM wishlist JOIN products ON wishlist.product_id = products.id
        WHERE wishlist.user_id=%s ORDER BY wishlist.id DESC
        """,
        (user_id,),
    )
    wishlist = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify(wishlist)


# ---------------- REMOVE FROM WISHLIST ----------------
@products.route("/remove-wishlist/<int:id>", methods=["DELETE"])
@login_required
def remove_wishlist(id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("DELETE FROM wishlist WHERE id=%s AND user_id=%s", (id, current_user()["id"]))
    db.commit()
    cursor.close()
    db.close()
    return {"message": "Removed from wishlist!"}


# ---------------- ADD REVIEW ----------------
@products.route("/add-review", methods=["POST"])
@login_required
def add_review():
    data = _body()
    user_id = current_user()["id"]
    product_id = _int(data.get("product_id"))
    rating = _int(data.get("rating"), lo=1, hi=5)
    review_text = str(data.get("review") or "").strip()
    if not product_id or not rating or not review_text:
        return jsonify({"message": "Rating (1-5) and review text are required."}), 400
    if len(review_text) > 2000:
        return jsonify({"message": "Review is too long (max 2000 characters)."}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM reviews WHERE user_id=%s AND product_id=%s", (user_id, product_id))
        if cursor.fetchone():
            return jsonify({"message": "You have already reviewed this product."}), 200
        cursor.execute(
            "INSERT INTO reviews (user_id, product_id, rating, review) VALUES (%s, %s, %s, %s)",
            (user_id, product_id, rating, review_text),
        )
        db.commit()
        return jsonify({"message": "Review submitted successfully!"}), 200
    except Exception as e:  # noqa: BLE001
        print("Add review error:", str(e))
        return jsonify({"message": "Could not save your review right now."}), 500
    finally:
        cursor.close()
        db.close()


# ---------------- GET REVIEWS ----------------
@products.route("/reviews/<int:product_id>", methods=["GET"])
def get_reviews(product_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT reviews.id, reviews.rating, reviews.review, reviews.created_at, users.full_name
        FROM reviews JOIN users ON reviews.user_id = users.id
        WHERE reviews.product_id=%s ORDER BY reviews.created_at DESC
        """,
        (product_id,),
    )
    reviews = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify(reviews)


# ---------------- PRODUCT RATING ----------------
@products.route("/rating/<int:product_id>", methods=["GET"])
def product_rating(product_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT ROUND(AVG(rating), 1) AS average_rating, COUNT(*) AS total_reviews FROM reviews WHERE product_id=%s",
        (product_id,),
    )
    result = cursor.fetchone()
    cursor.close()
    db.close()
    return {
        "average_rating": float(result["average_rating"]) if result and result["average_rating"] else 0,
        "total_reviews": result["total_reviews"] if result else 0,
    }


# ---------------- GET CATEGORIES ----------------
@products.route("/categories", methods=["GET"])
def get_categories():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    # sample_image: a real product photo per category (replaces random picsum images)
    cursor.execute(
        """
        SELECT category, COUNT(*) AS total,
               SUBSTRING_INDEX(GROUP_CONCAT(image ORDER BY stock DESC SEPARATOR '\n'), '\n', 1) AS sample_image
        FROM products
        GROUP BY category
        ORDER BY category ASC
        """
    )
    categories = cursor.fetchall()
    cursor.close()
    db.close()
    resp = jsonify(categories)
    resp.headers["Cache-Control"] = "public, max-age=300, s-maxage=600"
    return resp


# ---------------- GET TOP 5-STAR REVIEWS ----------------
@products.route("/reviews/top", methods=["GET"])
def get_top_reviews():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT r.rating, r.review, r.created_at, u.full_name, p.name AS product_name
        FROM reviews r JOIN users u ON r.user_id = u.id LEFT JOIN products p ON p.id = r.product_id
        WHERE r.rating = 5 ORDER BY r.id DESC LIMIT 6
        """
    )
    reviews = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify(reviews)
