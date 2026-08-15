from config import get_db


def search_products(
    search=None,
    category=None,
    min_price=None,
    max_price=None,
    limit=5
):
    """
    Search products from SmartCart AI database.
    """

    db = None
    cursor = None

    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)

        query = """
            SELECT
                id,
                name,
                brand,
                category,
                price,
                stock,
                description,
                image
            FROM products
            WHERE 1=1
        """

        params = []

        # Search by product name, brand or category
        if search:
            query += """
                AND (
                    name LIKE %s
                    OR brand LIKE %s
                    OR category LIKE %s
                )
            """

            keyword = f"%{search}%"

            params.extend([
                keyword,
                keyword,
                keyword
            ])

        # Category filter
        if category:
            query += " AND category LIKE %s"
            params.append(f"%{category}%")

        # Minimum price
        if min_price is not None:
            query += " AND price >= %s"
            params.append(min_price)

        # Maximum price
        if max_price is not None:
            query += " AND price <= %s"
            params.append(max_price)

        query += """
            ORDER BY price ASC
            LIMIT %s
        """

        params.append(int(limit))

        cursor.execute(query, tuple(params))

        return cursor.fetchall()

    except Exception as e:
        print("MCP PRODUCT SEARCH ERROR:", e)
        return []

    finally:
        if cursor:
            cursor.close()

        if db:
            db.close()


def add_to_cart(user_id, product_id, quantity=1):
    db = None
    cursor = None

    try:
        db = get_db()

        cursor = db.cursor(dictionary=True)

        # Check product exists
        cursor.execute(
            """
            SELECT id, name, price, stock
            FROM products
            WHERE id=%s
            """,
            (product_id,)
        )

        product = cursor.fetchone()

        if not product:
            return {
                "success": False,
                "message": "Product not found."
            }

        # Check stock
        if product["stock"] < quantity:
            return {
                "success": False,
                "message": f"Only {product['stock']} units are available."
            }

        # Check existing cart item
        cursor.execute(
            """
            SELECT id, quantity
            FROM shopping_cart
            WHERE user_id=%s AND product_id=%s
            """,
            (user_id, product_id)
        )

        existing = cursor.fetchone()

        if existing:
            new_quantity = existing["quantity"] + quantity

            if new_quantity > product["stock"]:
                return {
                    "success": False,
                    "message": "Requested quantity exceeds available stock."
                }

            cursor.execute(
                """
                UPDATE shopping_cart
                SET quantity=%s
                WHERE id=%s
                """,
                (new_quantity, existing["id"])
            )

        else:
            cursor.execute(
                """
                INSERT INTO shopping_cart
                (user_id, product_id, quantity)
                VALUES (%s, %s, %s)
                """,
                (user_id, product_id, quantity)
            )

        db.commit()

        return {
            "success": True,
            "message": f"{product['name']} added to cart successfully.",
            "product_id": product_id,
            "quantity": quantity
        }

    except Exception as e:
        if db:
            db.rollback()

        print("ADD TO CART ERROR:", e)

        return {
            "success": False,
            "message": "Unable to add product to cart."
        }

    finally:
        if cursor:
            cursor.close()

        if db:
            db.close()

def add_to_wishlist(user_id, product_id):
    db = None
    cursor = None

    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)

        # Check product exists
        cursor.execute(
            """
            SELECT id, name
            FROM products
            WHERE id=%s
            """,
            (product_id,)
        )

        product = cursor.fetchone()

        if not product:
            return {
                "success": False,
                "message": "Product not found."
            }

        # Check duplicate
        cursor.execute(
            """
            SELECT id
            FROM wishlist
            WHERE user_id=%s AND product_id=%s
            """,
            (user_id, product_id)
        )

        existing = cursor.fetchone()

        if existing:
            return {
                "success": False,
                "message": f"{product['name']} is already in your wishlist."
            }

        # Add to wishlist
        cursor.execute(
            """
            INSERT INTO wishlist (user_id, product_id)
            VALUES (%s, %s)
            """,
            (user_id, product_id)
        )

        db.commit()

        return {
            "success": True,
            "message": f"{product['name']} added to wishlist successfully.",
            "product_id": product_id
        }

    except Exception as e:

        if db:
            db.rollback()

        print("ADD TO WISHLIST ERROR:", e)

        return {
            "success": False,
            "message": "Unable to add product to wishlist."
        }

    finally:

        if cursor:
            cursor.close()

        if db:
            db.close()

def get_cart(user_id):
    db = None
    cursor = None

    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                shopping_cart.id AS cart_id,
                products.id AS product_id,
                products.name,
                products.brand,
                products.price,
                products.image,
                shopping_cart.quantity,
                (products.price * shopping_cart.quantity) AS subtotal
            FROM shopping_cart
            JOIN products
                ON shopping_cart.product_id = products.id
            WHERE shopping_cart.user_id=%s
            ORDER BY shopping_cart.id DESC
            """,
            (user_id,)
        )

        items = cursor.fetchall()

        total = sum(
            float(item["subtotal"])
            for item in items
        )

        return {
            "success": True,
            "items": items,
            "total": total,
            "item_count": sum(
                item["quantity"]
                for item in items
            )
        }

    except Exception as e:
        print("GET CART ERROR:", e)

        return {
            "success": False,
            "message": "Unable to retrieve cart."
        }

    finally:
        if cursor:
            cursor.close()

        if db:
            db.close()


def get_wishlist(user_id):
    db = None
    cursor = None

    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                wishlist.id AS wishlist_id,
                products.id AS product_id,
                products.name,
                products.brand,
                products.category,
                products.price,
                products.stock,
                products.image
            FROM wishlist
            JOIN products
                ON wishlist.product_id = products.id
            WHERE wishlist.user_id=%s
            ORDER BY wishlist.id DESC
            """,
            (user_id,)
        )

        items = cursor.fetchall()

        return {
            "success": True,
            "items": items,
            "item_count": len(items)
        }

    except Exception as e:
        print("GET WISHLIST ERROR:", e)

        return {
            "success": False,
            "message": "Unable to retrieve wishlist."
        }

    finally:
        if cursor:
            cursor.close()

        if db:
            db.close()

def place_order(user_id, shipping_address, payment_method):
    db = None
    cursor = None

    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)

        # Get cart
        cursor.execute(
            """
            SELECT
                shopping_cart.id AS cart_id,
                shopping_cart.product_id,
                shopping_cart.quantity,
                products.name,
                products.price,
                products.stock
            FROM shopping_cart
            JOIN products
                ON shopping_cart.product_id = products.id
            WHERE shopping_cart.user_id=%s
            """,
            (user_id,)
        )

        cart_items = cursor.fetchall()

        if not cart_items:
            return {
                "success": False,
                "message": "Your shopping cart is empty."
            }

        # Check stock and calculate total
        total = 0

        for item in cart_items:

            if item["quantity"] > item["stock"]:
                return {
                    "success": False,
                    "message": (
                        f"Not enough stock for {item['name']}. "
                        f"Only {item['stock']} units are available."
                    )
                }

            total += (
                float(item["price"]) *
                item["quantity"]
            )

        # Create order
        cursor.execute(
            """
            INSERT INTO orders
            (
                user_id,
                total_amount,
                status,
                payment_method,
                shipping_address
            )
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                user_id,
                total,
                "Pending",
                payment_method,
                shipping_address
            )
        )

        order_id = cursor.lastrowid

        # Reduce stock
        for item in cart_items:

            cursor.execute(
                """
                UPDATE products
                SET stock = stock - %s
                WHERE id=%s
                """,
                (
                    item["quantity"],
                    item["product_id"]
                )
            )

        # Clear cart
        cursor.execute(
            """
            DELETE FROM shopping_cart
            WHERE user_id=%s
            """,
            (user_id,)
        )

        db.commit()

        return {
            "success": True,
            "message": "Order placed successfully!",
            "order_id": order_id,
            "total_amount": total,
            "status": "Pending",
            "payment_method": payment_method,
            "shipping_address": shipping_address
        }

    except Exception as e:

        if db:
            db.rollback()

        print("PLACE ORDER ERROR:", e)

        return {
            "success": False,
            "message": "Unable to place order."
        }

    finally:

        if cursor:
            cursor.close()

        if db:
            db.close()

def get_orders(user_id):
    db = None
    cursor = None

    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                id AS order_id,
                total_amount,
                status,
                payment_method,
                shipping_address,
                created_at
            FROM orders
            WHERE user_id=%s
            ORDER BY created_at DESC
            """,
            (user_id,)
        )

        orders = cursor.fetchall()

        return {
            "success": True,
            "orders": orders,
            "order_count": len(orders)
        }

    except Exception as e:

        print("GET ORDERS ERROR:", e)

        return {
            "success": False,
            "message": "Unable to retrieve order history."
        }

    finally:

        if cursor:
            cursor.close()

        if db:
            db.close()