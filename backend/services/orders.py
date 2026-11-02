"""
Single source of truth for placing orders and reading order status.

Used by both the REST checkout (/api/products/place-order) and the AI
`checkout` tool, so the two paths can no longer disagree on totals,
delivery fee or stock handling (they previously did: the REST path never
checked or decremented stock, the AI path never charged delivery).
"""
from config import get_db
from db_schema import ensure_schema

DELIVERY_FEE = 200.0
ORDER_STEPS = ["Pending", "Processing", "Shipped", "Delivered"]
ALLOWED_PAYMENTS = ("Cash on Delivery", "Credit / Debit Card", "Easypaisa / JazzCash")


def sanitize_payment(method, detail=""):
    """
    Never persist full card or wallet numbers. Keep only the last 4 digits.
    """
    method = method if method in ALLOWED_PAYMENTS else "Cash on Delivery"
    digits = "".join(ch for ch in str(detail or "") if ch.isdigit())
    if method != "Cash on Delivery" and len(digits) >= 4:
        return f"{method} (ending {digits[-4:]})"
    return method


def place_order(user_id, shipping_address, payment_method, product_id=None, quantity=1):
    """
    Place an order from the user's cart, or a direct 'buy now' for a single
    product. Runs in one transaction with row locks so stock cannot go negative.
    """
    shipping_address = (shipping_address or "").strip()
    if len(shipping_address) < 8:
        return {"success": False, "message": "Please provide a complete shipping address."}
    if len(shipping_address) > 255:
        shipping_address = shipping_address[:255]

    ensure_schema()
    db = get_db()
    cur = db.cursor(dictionary=True)
    try:
        db.start_transaction()
        if product_id:
            quantity = max(1, min(int(quantity or 1), 50))
            cur.execute(
                "SELECT id AS product_id, name, price, stock FROM products WHERE id=%s FOR UPDATE",
                (int(product_id),),
            )
            row = cur.fetchone()
            if not row:
                db.rollback()
                return {"success": False, "message": "Product not found."}
            lines = [{**row, "quantity": quantity}]
        else:
            cur.execute(
                """
                SELECT c.product_id, c.quantity, p.name, p.price, p.stock
                FROM shopping_cart c JOIN products p ON p.id = c.product_id
                WHERE c.user_id=%s FOR UPDATE
                """,
                (user_id,),
            )
            lines = cur.fetchall()
            if not lines:
                db.rollback()
                return {"success": False, "message": "Your cart is empty."}

        for line in lines:
            if int(line["stock"]) < int(line["quantity"]):
                db.rollback()
                return {
                    "success": False,
                    "message": f"Only {line['stock']} unit(s) of {line['name']} left in stock.",
                }

        subtotal = sum(float(l["price"]) * int(l["quantity"]) for l in lines)
        total = subtotal + DELIVERY_FEE

        cur.execute(
            """
            INSERT INTO orders (user_id, total_amount, status, payment_method, shipping_address)
            VALUES (%s, %s, 'Pending', %s, %s)
            """,
            (user_id, total, payment_method, shipping_address),
        )
        order_id = cur.lastrowid

        for l in lines:
            cur.execute(
                "INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES (%s,%s,%s,%s,%s)",
                (order_id, l["product_id"], l["name"], l["price"], l["quantity"]),
            )
            cur.execute(
                "UPDATE products SET stock = stock - %s WHERE id=%s",
                (l["quantity"], l["product_id"]),
            )

        if not product_id:
            cur.execute("DELETE FROM shopping_cart WHERE user_id=%s", (user_id,))

        db.commit()
        return {
            "success": True,
            "message": "Order placed successfully!",
            "order_id": order_id,
            "subtotal": subtotal,
            "delivery_fee": DELIVERY_FEE,
            "total_amount": total,
            "status": "Pending",
            "payment_method": payment_method,
            "shipping_address": shipping_address,
            "items": [
                {"product_id": l["product_id"], "name": l["name"], "price": float(l["price"]), "quantity": int(l["quantity"])}
                for l in lines
            ],
        }
    except Exception as e:  # noqa: BLE001
        db.rollback()
        print("PLACE ORDER ERROR:", e)
        return {"success": False, "message": "Unable to place order right now. Please try again."}
    finally:
        cur.close()
        db.close()


def get_order(user_id, order_id, is_admin=False):
    """Order + items + a status stepper the UI can render."""
    ensure_schema()
    db = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id AS order_id, user_id, total_amount, status, payment_method, shipping_address, created_at "
            "FROM orders WHERE id=%s",
            (int(order_id),),
        )
        order = cur.fetchone()
        if not order or (not is_admin and int(order["user_id"]) != int(user_id)):
            return {"success": False, "message": f"I couldn't find order #{order_id} on your account."}
        cur.execute(
            "SELECT product_id, name, price, quantity FROM order_items WHERE order_id=%s",
            (order["order_id"],),
        )
        items = cur.fetchall()
        status = order["status"] or "Pending"
        cancelled = status.lower() == "cancelled"
        current = ORDER_STEPS.index(status) if status in ORDER_STEPS else 0
        order.pop("user_id", None)
        return {
            "success": True,
            "order": {
                **order,
                "total_amount": float(order["total_amount"]),
                "created_at": str(order["created_at"]),
                "items": [{**i, "price": float(i["price"])} for i in items],
                "steps": [
                    {"label": s, "done": (not cancelled) and i <= current, "current": (not cancelled) and i == current}
                    for i, s in enumerate(ORDER_STEPS)
                ],
                "cancelled": cancelled,
            },
        }
    finally:
        cur.close()
        db.close()
