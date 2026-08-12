from flask import Blueprint, request
from config import get_db

products = Blueprint("products", __name__)

# ---------------- GET PRODUCTS ----------------

@products.route("/", methods=["GET"])
def get_products():

    category = request.args.get("category")
    search = request.args.get("search")

    db = get_db()
    cursor = db.cursor(dictionary=True)

    sql = "SELECT * FROM products WHERE 1=1"
    values = []

    # Category Filter
    if category:
        sql += " AND category=%s"
        values.append(category)

    # Search Filter
    if search:
        sql += """
        AND (
            name LIKE %s
            OR brand LIKE %s
            OR category LIKE %s
        )
        """

        keyword = f"%{search}%"

        values.extend([keyword, keyword, keyword])

    cursor.execute(sql, tuple(values))

    products_data = cursor.fetchall()

    cursor.close()
    db.close()

    return products_data


# ---------------- ADD TO CART ----------------

@products.route("/add-to-cart", methods=["POST"])
def add_to_cart():
    data = request.get_json()

    db = get_db()
    cursor = db.cursor(dictionary=True)

    user_id = data.get("user_id")
    product_id = data.get("product_id")
    quantity = data.get("quantity", 1)

    # 1. Check if product already exists in cart
    cursor.execute(
        "SELECT id, quantity FROM shopping_cart WHERE user_id=%s AND product_id=%s",
        (user_id, product_id)
    )
    existing_item = cursor.fetchone()

    write_cursor = db.cursor()

    if existing_item:
        # 2. Update quantity if item already in cart
        new_qty = existing_item["quantity"] + quantity
        write_cursor.execute(
            "UPDATE shopping_cart SET quantity=%s WHERE id=%s",
            (new_qty, existing_item["id"])
        )
    else:
        # 3. Insert new row if item not in cart
        write_cursor.execute(
            """
            INSERT INTO shopping_cart (user_id, product_id, quantity)
            VALUES (%s, %s, %s)
            """,
            (user_id, product_id, quantity)
        )

    db.commit()

    cursor.close()
    write_cursor.close()
    db.close()

    return {
        "message": "Product added to cart successfully!"
    }


# ---------------- GET CART ----------------

@products.route("/cart/<int:user_id>", methods=["GET"])
def get_cart(user_id):

    db = get_db()
    cursor = db.cursor(dictionary=True)

    sql = """
    SELECT

        shopping_cart.id,
        shopping_cart.quantity,

        products.id AS product_id,
        products.name,
        products.price,
        products.image

    FROM shopping_cart

    JOIN products

    ON shopping_cart.product_id = products.id

    WHERE shopping_cart.user_id=%s
    """

    cursor.execute(sql, (user_id,))

    cart = cursor.fetchall()

    cursor.close()
    db.close()

    return cart


# ---------------- CART COUNT ----------------

@products.route("/cart-count/<int:user_id>", methods=["GET"])
def cart_count(user_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT SUM(quantity) AS total
        FROM shopping_cart
        WHERE user_id=%s
        """,
        (user_id,)
    )

    result = cursor.fetchone()

    cursor.close()
    db.close()

    # Safe Integer Conversion
    total_count = int(result["total"]) if result and result["total"] is not None else 0

    return {
        "count": total_count
    }

    # ---------------- INCREASE QUANTITY ----------------

@products.route("/increase/<int:cart_id>", methods=["PUT"])
def increase_quantity(cart_id):

    db = get_db()
    cursor = db.cursor()

    cursor.execute(
        "UPDATE shopping_cart SET quantity = quantity + 1 WHERE id=%s",
        (cart_id,)
    )

    db.commit()

    cursor.close()
    db.close()

    return {
        "message": "Quantity Increased"
    }


# ---------------- DECREASE QUANTITY ----------------

@products.route("/decrease/<int:cart_id>", methods=["PUT"])
def decrease_quantity(cart_id):

    db = get_db()
    cursor = db.cursor()

    cursor.execute(
        """
        UPDATE shopping_cart
        SET quantity =
        CASE
            WHEN quantity > 1 THEN quantity - 1
            ELSE 1
        END
        WHERE id=%s
        """,
        (cart_id,)
    )

    db.commit()

    cursor.close()
    db.close()

    return {
        "message": "Quantity Decreased"
    }


# ---------------- REMOVE ITEM ----------------

@products.route("/remove/<int:cart_id>", methods=["DELETE"])
def remove_item(cart_id):

    db = get_db()
    cursor = db.cursor()

    cursor.execute(
        "DELETE FROM shopping_cart WHERE id=%s",
        (cart_id,)
    )

    db.commit()

    cursor.close()
    db.close()

    return {
        "message": "Item Removed"
    }

    # ---------------- PLACE ORDER ----------------

@products.route("/place-order", methods=["POST"])
def place_order():

    data = request.get_json()

    user_id = data["user_id"]
    address = data["shipping_address"]
    payment = data["payment_method"]

    db = get_db()
    cursor = db.cursor(dictionary=True)

    # Cart Total

    cursor.execute("""

        SELECT
        SUM(products.price * shopping_cart.quantity) AS total

        FROM shopping_cart

        JOIN products

        ON shopping_cart.product_id = products.id

        WHERE shopping_cart.user_id=%s

    """, (user_id,))

    result = cursor.fetchone()

    total = result["total"] if result["total"] else 0

    # Save Order

    cursor.execute("""

        INSERT INTO orders

        (user_id,total_amount,status,payment_method,shipping_address)

        VALUES

        (%s,%s,%s,%s,%s)

    """,

    (

        user_id,

        total,

        "Pending",

        payment,

        address

    ))

    # Empty Cart

    cursor.execute(

        "DELETE FROM shopping_cart WHERE user_id=%s",

        (user_id,)

    )

    db.commit()

    cursor.close()
    db.close()

    return {
        "message":"Order Placed Successfully!"
    }
    # ---------------- MY ORDERS ----------------

@products.route("/my-orders/<int:user_id>", methods=["GET"])
def my_orders(user_id):

    db = get_db()
    cursor = db.cursor(dictionary=True)

    sql = """
    SELECT
        id,
        total_amount,
        status,
        payment_method,
        created_at
    FROM orders
    WHERE user_id=%s
    ORDER BY created_at DESC
    """

    cursor.execute(sql, (user_id,))

    orders = cursor.fetchall()

    cursor.close()
    db.close()

    return orders

    # ---------------- ADMIN DASHBOARD ----------------

@products.route("/admin/dashboard", methods=["GET"])
def admin_dashboard():

    db = get_db()
    cursor = db.cursor(dictionary=True)

    # Total Users
    cursor.execute("SELECT COUNT(*) AS total_users FROM users")
    total_users = cursor.fetchone()["total_users"]

    # Total Products
    cursor.execute("SELECT COUNT(*) AS total_products FROM products")
    total_products = cursor.fetchone()["total_products"]

    # Total Orders
    cursor.execute("SELECT COUNT(*) AS total_orders FROM orders")
    total_orders = cursor.fetchone()["total_orders"]

    # Total Revenue
    cursor.execute("""
        SELECT IFNULL(SUM(total_amount),0) AS revenue
        FROM orders
    """)
    revenue = cursor.fetchone()["revenue"]

    cursor.close()
    db.close()

    return {
        "users": total_users,
        "products": total_products,
        "orders": total_orders,
        "revenue": float(revenue)
    }

    # ---------------- ADD PRODUCT ----------------

@products.route("/add-product", methods=["POST"])
def add_product():

    db = get_db()
    cursor = db.cursor()

    data = request.get_json()

    sql = """
    INSERT INTO products
    (name,brand,category,price,stock,image,description)
    VALUES(%s,%s,%s,%s,%s,%s,%s)
    """

    cursor.execute(sql, (

        data["name"],
        data["brand"],
        data["category"],
        data["price"],
        data["stock"],
        data["image"],
        data["description"]

    ))

    db.commit()

    cursor.close()
    db.close()

    return {
        "message":"Product Added Successfully!"
    }

    # ---------------- DELETE PRODUCT ----------------

@products.route("/delete-product/<int:id>", methods=["DELETE"])
def delete_product(id):

    db = get_db()

    cursor = db.cursor()

    cursor.execute(

        "DELETE FROM products WHERE id=%s",

        (id,)

    )

    db.commit()

    cursor.close()

    db.close()

    return {

        "message":"Product Deleted Successfully!"

    }

    # ---------------- GET SINGLE PRODUCT ----------------

@products.route("/<int:id>", methods=["GET"])
def get_single_product(id):

    db = get_db()

    cursor = db.cursor(dictionary=True)

    cursor.execute(

        "SELECT * FROM products WHERE id=%s",

        (id,)

    )

    product = cursor.fetchone()

    cursor.close()

    db.close()

    return product

    # ---------------- UPDATE PRODUCT ----------------

@products.route("/update-product/<int:id>", methods=["PUT"])
def update_product(id):

    db = get_db()

    cursor = db.cursor()

    data = request.get_json()

    sql = """

    UPDATE products

    SET

    name=%s,

    brand=%s,

    category=%s,

    price=%s,

    stock=%s,

    image=%s,

    description=%s

    WHERE id=%s

    """

    cursor.execute(sql,(

        data["name"],
        data["brand"],
        data["category"],
        data["price"],
        data["stock"],
        data["image"],
        data["description"],
        id

    ))

    db.commit()

    cursor.close()

    db.close()

    return {

        "message":"Product Updated Successfully!"

    }

    # ---------------- GET ALL ORDERS (ADMIN) ----------------

@products.route("/admin/orders", methods=["GET"])
def admin_orders():

    db = get_db()

    cursor = db.cursor(dictionary=True)

    sql = """

    SELECT

        orders.id,
        users.full_name,
        orders.total_amount,
        orders.payment_method,
        orders.shipping_address,
        orders.status,
        orders.created_at

    FROM orders

    JOIN users

    ON orders.user_id = users.id

    ORDER BY orders.created_at DESC

    """

    cursor.execute(sql)

    orders = cursor.fetchall()

    cursor.close()
    db.close()

    return orders

    # ---------------- UPDATE ORDER STATUS ----------------

@products.route("/update-order-status/<int:id>", methods=["PUT"])
def update_order_status(id):

    db = get_db()

    cursor = db.cursor()

    data = request.get_json()

    cursor.execute(

        "UPDATE orders SET status=%s WHERE id=%s",

        (

            data["status"],
            id

        )

    )

    db.commit()

    cursor.close()
    db.close()

    return {

        "message": "Order Status Updated Successfully!"

    }

    # ---------------- ADD TO WISHLIST ----------------

@products.route("/add-to-wishlist", methods=["POST"])
def add_to_wishlist():

    data = request.get_json()

    db = get_db()
    cursor = db.cursor(dictionary=True)

    # Check duplicate
    cursor.execute(
        """
        SELECT *
        FROM wishlist
        WHERE user_id=%s AND product_id=%s
        """,
        (
            data["user_id"],
            data["product_id"]
        )
    )

    already = cursor.fetchone()

    if already:

        cursor.close()
        db.close()

        return {
            "message": "Product already in wishlist!"
        }

    cursor = db.cursor()

    cursor.execute(
        """
        INSERT INTO wishlist
        (user_id, product_id)
        VALUES (%s,%s)
        """,
        (
            data["user_id"],
            data["product_id"]
        )
    )

    db.commit()

    cursor.close()
    db.close()

    return {
        "message": "Product added to wishlist!"
    }

    # ---------------- GET WISHLIST ----------------

@products.route("/wishlist/<int:user_id>", methods=["GET"])
def get_wishlist(user_id):

    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""

        SELECT

            wishlist.id,

            products.id AS product_id,

            products.name,

            products.price,

            products.image,

            products.category

        FROM wishlist

        JOIN products

        ON wishlist.product_id = products.id

        WHERE wishlist.user_id=%s

    """, (user_id,))

    wishlist = cursor.fetchall()

    cursor.close()
    db.close()

    return wishlist

    # ---------------- REMOVE FROM WISHLIST ----------------

@products.route("/remove-wishlist/<int:id>", methods=["DELETE"])
def remove_wishlist(id):

    db = get_db()
    cursor = db.cursor()

    cursor.execute(

        "DELETE FROM wishlist WHERE id=%s",

        (id,)

    )

    db.commit()

    cursor.close()
    db.close()

    return {
        "message": "Removed from wishlist!"
    }

    # ---------------- ADD REVIEW ----------------

@products.route("/add-review", methods=["POST"])
def add_review():

    data = request.get_json()

    db = get_db()
    cursor = db.cursor(dictionary=True)

    # Check if user already reviewed this product
    cursor.execute(
        """
        SELECT *
        FROM reviews
        WHERE user_id=%s AND product_id=%s
        """,
        (
            data["user_id"],
            data["product_id"]
        )
    )

    already = cursor.fetchone()

    if already:

        cursor.close()
        db.close()

        return {
            "message": "You have already reviewed this product."
        }

    cursor = db.cursor()

    cursor.execute(
        """
        INSERT INTO reviews
        (user_id, product_id, rating, review)
        VALUES (%s,%s,%s,%s)
        """,
        (
            data["user_id"],
            data["product_id"],
            data["rating"],
            data["review"]
        )
    )

    db.commit()

    cursor.close()
    db.close()

    return {
        "message": "Review submitted successfully!"
    }

    # ---------------- GET REVIEWS ----------------

@products.route("/reviews/<int:product_id>", methods=["GET"])
def get_reviews(product_id):

    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT

            reviews.id,
            reviews.rating,
            reviews.review,
            reviews.created_at,

            users.full_name

        FROM reviews

        JOIN users

        ON reviews.user_id = users.id

        WHERE reviews.product_id=%s

        ORDER BY reviews.created_at DESC
        """,
        (product_id,)
    )

    reviews = cursor.fetchall()

    cursor.close()
    db.close()

    return reviews

    # ---------------- PRODUCT RATING ----------------

@products.route("/rating/<int:product_id>", methods=["GET"])
def product_rating(product_id):

    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT

            ROUND(AVG(rating),1) AS average_rating,
            COUNT(*) AS total_reviews

        FROM reviews

        WHERE product_id=%s
        """,
        (product_id,)
    )

    result = cursor.fetchone()

    cursor.close()
    db.close()

    return {
        "average_rating": result["average_rating"] if result["average_rating"] else 0,
        "total_reviews": result["total_reviews"]
    }

    # ---------------- GET CATEGORIES ----------------

@products.route("/categories", methods=["GET"])
def get_categories():

    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""

        SELECT

            category,
            COUNT(*) AS total

        FROM products

        GROUP BY category

        ORDER BY category ASC

    """)

    categories = cursor.fetchall()

    cursor.close()
    db.close()

    return categories

    # ---------------- GET TOP 5-STAR REVIEWS ----------------
@products.route("/reviews/top", methods=["GET"])
def get_top_reviews():
    db = get_db()
    cursor = db.cursor(dictionary=True)

    # Database table columns: 'review', 'rating', 'user_id'
    sql = """
        SELECT 
            r.rating,
            r.review,
            r.created_at,
            u.full_name
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.rating = 5
        ORDER BY r.id DESC
        LIMIT 6
    """
    
    cursor.execute(sql)
    reviews = cursor.fetchall()

    cursor.close()
    db.close()

    return reviews