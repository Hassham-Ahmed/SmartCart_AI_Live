"""
Agent tools: JSON-schema declarations (for Gemini function calling) +
server-side executors.

Every executor gets a ToolContext with the *authenticated* user (from the
bearer token, never from model output), so the model cannot act on another
account even if a prompt injection tells it to.

Executors return ToolResult(data_for_llm, ui_events, products) where
`products` are added to the grounding candidate set for this turn.
"""
import re
from dataclasses import dataclass, field

from config import get_db
from services.orders import ALLOWED_PAYMENTS, DELIVERY_FEE, get_order, place_order, sanitize_payment
from smartcart_mcp.tools.product_tools import add_to_cart as _add_to_cart
from smartcart_mcp.tools.product_tools import add_to_wishlist as _add_to_wishlist
from smartcart_mcp.tools.product_tools import get_cart as _get_cart

from . import context as ctxmod
from .system_prompt import _compact
from .vector_store import get_index, product_vector, public_product, recommend_by_vector, retrieve_relevant_products


@dataclass
class ToolContext:
    user: dict | None
    ctx: dict


@dataclass
class ToolResult:
    data: dict
    events: list = field(default_factory=list)
    products: list = field(default_factory=list)


LOGIN_REQUIRED = {"ok": False, "error": "login_required", "message": "The user must log in to do this."}

# --------------------------------------------------------------- schemas
DECLARATIONS = [
    {
        "name": "search_products",
        "description": "Hybrid semantic + keyword search over the SmartCart catalog. Use for any product discovery or refinement.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {"type": "STRING", "description": "What the shopper wants, in natural language (include use-case and features)."},
                "category": {"type": "STRING", "description": "Optional category filter, e.g. 'Mobile', 'Laptop', 'Shoes'."},
                "brand": {"type": "STRING", "description": "Optional brand filter."},
                "min_price": {"type": "NUMBER", "description": "Minimum price in PKR."},
                "max_price": {"type": "NUMBER", "description": "Maximum price in PKR."},
                "in_stock_only": {"type": "BOOLEAN"},
                "limit": {"type": "INTEGER", "description": "Number of results, 1-10 (default 6)."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_product_details",
        "description": "Full details for one product: specs, live stock, price, rating and recent reviews.",
        "parameters": {"type": "OBJECT", "properties": {"product_id": {"type": "INTEGER"}}, "required": ["product_id"]},
    },
    {
        "name": "compare_products",
        "description": "Side-by-side comparison of 2-4 products. The UI renders a table from the result.",
        "parameters": {
            "type": "OBJECT",
            "properties": {"product_ids": {"type": "ARRAY", "items": {"type": "INTEGER"}}},
            "required": ["product_ids"],
        },
    },
    {
        "name": "add_to_cart",
        "description": "Add a product to the logged-in shopper's cart.",
        "parameters": {
            "type": "OBJECT",
            "properties": {"product_id": {"type": "INTEGER"}, "quantity": {"type": "INTEGER", "description": "1-20, default 1"}},
            "required": ["product_id"],
        },
    },
    {
        "name": "remove_from_cart",
        "description": "Remove a product from the shopper's cart.",
        "parameters": {"type": "OBJECT", "properties": {"product_id": {"type": "INTEGER"}}, "required": ["product_id"]},
    },
    {"name": "view_cart", "description": "Show the shopper's current cart and totals.", "parameters": {"type": "OBJECT", "properties": {}}},
    {
        "name": "add_to_wishlist",
        "description": "Save a product to the shopper's wishlist.",
        "parameters": {"type": "OBJECT", "properties": {"product_id": {"type": "INTEGER"}}, "required": ["product_id"]},
    },
    {
        "name": "checkout",
        "description": (
            "Place an order for everything in the cart. Two-step: call with confirm=false to get a summary to show "
            "the shopper; call again with confirm=true ONLY after the shopper explicitly confirms."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "address": {"type": "STRING", "description": "Full shipping address given by the shopper."},
                "payment_method": {"type": "STRING", "description": "Only 'Cash on Delivery' is supported in chat."},
                "confirm": {"type": "BOOLEAN"},
            },
            "required": ["address", "confirm"],
        },
    },
    {
        "name": "track_order",
        "description": "Status of an order with a progress stepper. Omit order_id for the latest order.",
        "parameters": {"type": "OBJECT", "properties": {"order_id": {"type": "INTEGER"}}},
    },
    {
        "name": "get_user_history",
        "description": "The shopper's past orders, purchased items, wishlist and recently viewed products.",
        "parameters": {"type": "OBJECT", "properties": {}},
    },
    {
        "name": "get_recommendations",
        "description": "Personalised suggestions from the shopper's taste profile (purchases, wishlist, views). Optional category.",
        "parameters": {"type": "OBJECT", "properties": {"category": {"type": "STRING"}}},
    },
]


# ------------------------------------------------------------- helpers
def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return v


def _clean(obj):
    """Decimals/datetimes -> JSON friendly."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    if obj is None or isinstance(obj, (bool, int, float, str)):
        return obj
    return _num(obj) if hasattr(obj, "as_tuple") else str(obj)


def parse_specs(specs):
    out = {}
    for chunk in (specs or "").split(";"):
        if ":" in chunk:
            k, v = chunk.split(":", 1)
            out[k.strip()] = v.strip()
    return out


def _product_row(pid):
    idx = get_index()
    p = idx.by_id.get(int(pid))
    return public_product(p) if p else None


def _cart_payload(user_id):
    res = _clean(_get_cart(user_id=user_id))
    items = [
        {"product_id": i["product_id"], "name": i["name"], "price": i["price"], "quantity": i["quantity"],
         "subtotal": i["subtotal"], "image": i.get("image")}
        for i in res.get("items", [])
    ]
    total = float(res.get("total") or 0)
    return {"items": items, "subtotal": total, "delivery_fee": DELIVERY_FEE if items else 0,
            "total": total + (DELIVERY_FEE if items else 0), "item_count": res.get("item_count", 0)}


def _remember_shown(tc, products):
    tc.ctx["last_products"] = [{"id": p["id"], "name": p["name"]} for p in products[:8]]


# ------------------------------------------------------------ executors
def search_products(tc, query, category=None, brand=None, min_price=None, max_price=None, in_stock_only=False, limit=6):
    limit = max(1, min(int(limit or 6), 10))
    filters = {"category": category, "brand": brand, "min_price": min_price, "max_price": max_price,
               "in_stock_only": bool(in_stock_only)}
    products = retrieve_relevant_products(query, k=limit, filters=filters)
    if not products and (category or brand):
        # filters too strict? retry semantic-only so the model can explain alternatives
        products = retrieve_relevant_products(query, k=limit, filters={"min_price": min_price, "max_price": max_price})
    _remember_shown(tc, products)
    return ToolResult({"ok": True, "count": len(products), "products": [_compact(p) for p in products]}, products=products)


def get_product_details(tc, product_id):
    db = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute("SELECT * FROM products WHERE id=%s", (int(product_id),))
        p = cur.fetchone()
        if not p:
            return ToolResult({"ok": False, "message": f"No product with id {product_id}."})
        cur.execute(
            "SELECT ROUND(AVG(rating),1) AS rating, COUNT(*) AS n FROM reviews WHERE product_id=%s", (p["id"],))
        r = cur.fetchone() or {}
        cur.execute(
            "SELECT rating, review FROM reviews WHERE product_id=%s ORDER BY created_at DESC LIMIT 3", (p["id"],))
        reviews = cur.fetchall()
    finally:
        cur.close()
        db.close()
    p = _clean(p)
    p["rating"] = float(r.get("rating") or 0)
    p["review_count"] = int(r.get("n") or 0)
    prod = public_product(p)
    data = {"ok": True, "product": {**_compact(prod), "specs": parse_specs(prod.get("specs")),
                                    "review_count": prod["review_count"],
                                    "recent_reviews": [{"rating": x["rating"], "text": (x["review"] or "")[:200]} for x in reviews]}}
    return ToolResult(data, products=[prod])


def compare_products(tc, product_ids):
    ids = [int(i) for i in (product_ids or [])][:4]
    products = [p for p in (_product_row(i) for i in ids) if p]
    if len(products) < 2:
        return ToolResult({"ok": False, "message": "Need at least two valid product ids to compare."})
    spec_maps = [parse_specs(p.get("specs")) for p in products]
    spec_keys = []
    for m in spec_maps:
        for k in m:
            if k not in spec_keys:
                spec_keys.append(k)
    rows = [
        {"label": "Price", "values": [f"Rs. {p['price']:,.0f}" for p in products]},
        {"label": "Brand", "values": [p.get("brand") or "-" for p in products]},
        {"label": "Category", "values": [p.get("category") or "-" for p in products]},
        {"label": "Rating", "values": [f"{p['rating']:.1f} ({p['review_count']})" if p.get("review_count") else "No reviews" for p in products]},
        {"label": "Stock", "values": ["In stock" if p["stock"] > 0 else "Out of stock" for p in products]},
    ] + [{"label": k, "values": [m.get(k, "-") for m in spec_maps]} for k in spec_keys[:8]]
    cheapest = min(products, key=lambda p: p["price"])
    _remember_shown(tc, products)
    event = {"type": "comparison", "products": products, "rows": rows}
    return ToolResult({"ok": True, "products": [_compact(p) for p in products],
                       "cheapest_id": cheapest["id"]}, events=[event], products=products)


def add_to_cart(tc, product_id, quantity=1):
    if not tc.user:
        return ToolResult(LOGIN_REQUIRED)
    qty = max(1, min(int(quantity or 1), 20))
    res = _add_to_cart(user_id=tc.user["id"], product_id=int(product_id), quantity=qty)
    events = [{"type": "cart_updated"}] if res.get("success") else []
    return ToolResult({"ok": bool(res.get("success")), "message": res.get("message"), "product_id": int(product_id), "quantity": qty}, events=events)


def remove_from_cart(tc, product_id):
    if not tc.user:
        return ToolResult(LOGIN_REQUIRED)
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("DELETE FROM shopping_cart WHERE user_id=%s AND product_id=%s", (tc.user["id"], int(product_id)))
        db.commit()
        removed = cur.rowcount > 0
    finally:
        cur.close()
        db.close()
    return ToolResult({"ok": removed, "message": "Removed from cart." if removed else "That product is not in the cart."},
                      events=[{"type": "cart_updated"}] if removed else [])


def view_cart(tc):
    if not tc.user:
        return ToolResult(LOGIN_REQUIRED)
    cart = _cart_payload(tc.user["id"])
    return ToolResult({"ok": True, **cart}, events=[{"type": "cart", "cart": cart}])


def add_to_wishlist(tc, product_id):
    if not tc.user:
        return ToolResult(LOGIN_REQUIRED)
    res = _add_to_wishlist(user_id=tc.user["id"], product_id=int(product_id))
    return ToolResult({"ok": bool(res.get("success")), "message": res.get("message")})


def _norm_addr(a):
    return re.sub(r"\s+", " ", (a or "").strip().lower())


def checkout(tc, address, confirm=False, payment_method="Cash on Delivery"):
    if not tc.user:
        return ToolResult(LOGIN_REQUIRED)
    payment_method = payment_method or "Cash on Delivery"
    if payment_method not in ALLOWED_PAYMENTS or payment_method != "Cash on Delivery":
        return ToolResult({"ok": False, "error": "unsupported_payment_in_chat",
                           "message": "In chat only Cash on Delivery is supported. For card/wallet use the Checkout page (/checkout)."})
    if len((address or "").strip()) < 8:
        return ToolResult({"ok": False, "error": "address_required", "message": "Ask the shopper for their full shipping address."})

    cart = _cart_payload(tc.user["id"])
    if not cart["items"]:
        return ToolResult({"ok": False, "message": "The cart is empty."})
    signature = ",".join(f"{i['product_id']}x{i['quantity']}" for i in sorted(cart["items"], key=lambda i: i["product_id"]))

    pending = tc.ctx.get("pending_checkout")
    if not confirm or not pending:
        tc.ctx["pending_checkout"] = {"address": _norm_addr(address), "signature": signature, "payment": payment_method}
        summary = {"ok": True, "status": "awaiting_confirmation", "address": address.strip(), "payment_method": payment_method, **cart}
        return ToolResult(summary, events=[{"type": "cart", "cart": cart, "awaiting_confirmation": True}])

    # Server-side guard: confirmation must match exactly what was summarised.
    if pending["signature"] != signature or pending["address"] != _norm_addr(address):
        tc.ctx["pending_checkout"] = {"address": _norm_addr(address), "signature": signature, "payment": payment_method}
        return ToolResult({"ok": False, "status": "awaiting_confirmation",
                           "message": "Cart or address changed since the summary. Show the new summary and ask again.", **cart})

    res = place_order(tc.user["id"], address.strip(), sanitize_payment(payment_method))
    tc.ctx["pending_checkout"] = None
    if not res.get("success"):
        return ToolResult({"ok": False, "message": res.get("message")})
    order = get_order(tc.user["id"], res["order_id"]).get("order")
    tc.ctx["history"]["purchased"] = [i["product_id"] for i in res["items"]] + tc.ctx["history"]["purchased"][:20]
    return ToolResult({"ok": True, "order_id": res["order_id"], "total_amount": res["total_amount"], "status": "Pending"},
                      events=[{"type": "order", "order": order}, {"type": "cart_updated"}])


def track_order(tc, order_id=None):
    if not tc.user:
        return ToolResult(LOGIN_REQUIRED)
    if not order_id:
        db = get_db()
        cur = db.cursor()
        cur.execute("SELECT id FROM orders WHERE user_id=%s ORDER BY created_at DESC LIMIT 1", (tc.user["id"],))
        row = cur.fetchone()
        cur.close()
        db.close()
        if not row:
            return ToolResult({"ok": False, "message": "The shopper has no orders yet."})
        order_id = row[0]
    res = get_order(tc.user["id"], order_id, is_admin=False)
    if not res.get("success"):
        return ToolResult({"ok": False, "message": res.get("message")})
    o = res["order"]
    return ToolResult({"ok": True, "order_id": o["order_id"], "status": o["status"], "total_amount": o["total_amount"],
                       "placed_at": o["created_at"], "items": [f"{i['name']} x{i['quantity']}" for i in o["items"]]},
                      events=[{"type": "order", "order": o}])


def get_user_history(tc):
    if not tc.user:
        return ToolResult(LOGIN_REQUIRED)
    hist = ctxmod.load_user_history(tc.user["id"])
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute("SELECT id, status, total_amount, created_at FROM orders WHERE user_id=%s ORDER BY created_at DESC LIMIT 5", (tc.user["id"],))
    orders = _clean(cur.fetchall())
    cur.close()
    db.close()
    return ToolResult({"ok": True, "recent_orders": orders, **hist})


def get_recommendations(tc, category=None):
    ids = list(dict.fromkeys(tc.ctx.get("_taste_ids") or (tc.ctx["history"]["purchased"] + tc.ctx["history"]["viewed"])))
    filters = {"category": category, "in_stock_only": True, "exclude_ids": tc.ctx["history"]["purchased"]}
    vec = product_vector(ids) if ids else None
    products = recommend_by_vector(vec, k=6, filters=filters) if vec is not None else []
    basis = "taste_profile"
    if not products:
        prefs = tc.ctx["preferences"]
        q = " ".join(prefs.get("categories", [])[-2:] + prefs.get("features", [])[-3:] + prefs.get("brands", [])[-2:]) or (category or "popular top rated")
        products = retrieve_relevant_products(q, k=6, filters=filters)
        basis = "stated_preferences" if prefs.get("categories") or prefs.get("features") else "popular"
    _remember_shown(tc, products)
    return ToolResult({"ok": True, "basis": basis, "products": [_compact(p) for p in products]}, products=products)


EXECUTORS = {
    "search_products": search_products,
    "get_product_details": get_product_details,
    "compare_products": compare_products,
    "add_to_cart": add_to_cart,
    "remove_from_cart": remove_from_cart,
    "view_cart": view_cart,
    "add_to_wishlist": add_to_wishlist,
    "checkout": checkout,
    "track_order": track_order,
    "get_user_history": get_user_history,
    "get_recommendations": get_recommendations,
}


def execute(name, args, tc):
    fn = EXECUTORS.get(name)
    if not fn:
        return ToolResult({"ok": False, "message": f"Unknown tool {name}."})
    allowed = set(fn.__code__.co_varnames[1:fn.__code__.co_argcount])
    clean_args = {k: v for k, v in (args or {}).items() if k in allowed}
    try:
        return fn(tc, **clean_args)
    except TypeError as e:
        return ToolResult({"ok": False, "message": f"Bad arguments for {name}: {e}"})
    except Exception as e:  # noqa: BLE001
        print(f"TOOL {name} ERROR:", e)
        return ToolResult({"ok": False, "message": "That action failed on our side. Please try again."})
