import os
import re
import json
from flask import Blueprint, request, jsonify, session
from dotenv import load_dotenv
from google import genai

# Triple-fallback import for product_tools
try:
    from smartcart_mcp.tools.product_tools import (
        search_products,
        add_to_cart,
        add_to_wishlist,
        get_cart,
        get_wishlist,
        place_order,
        get_orders
    )
except ImportError:
    try:
        from tools.product_tools import (
            search_products,
            add_to_cart,
            add_to_wishlist,
            get_cart,
            get_wishlist,
            place_order,
            get_orders
        )
    except ImportError:
        from product_tools import (
            search_products,
            add_to_cart,
            add_to_wishlist,
            get_cart,
            get_wishlist,
            place_order,
            get_orders
        )

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

ai = Blueprint("ai", __name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


# ---------------------------------------------------------
# PRODUCT / CATEGORY KNOWLEDGE
# ---------------------------------------------------------
STOPWORDS = [
    "yaar", "mujhe", "khareedna", "hai", "kya", "tumhare", "per", "koi",
    "accha", "dikhao", "show", "find", "search", "available", "have",
    "need", "want", "please", "mein", "me", "karo", "daalo", "bro", "bhai",
    "sir", "just", "only", "tell", "give", "recommend", "suggest", "check"
]

# Canonical product key -> words/phrases that identify it in a message.
PRODUCT_MAP = {
    "laptop": ["laptop", "laptops", "notebook"],
    "phone": ["phone", "phones", "mobile", "mobiles", "smartphone"],
    "iphone": ["iphone", "apple phone"],
    "samsung": ["samsung", "galaxy"],
    "hp": ["hp", "hewlett packard"],
    "dell": ["dell", "xps"],
    "lenovo": ["lenovo", "thinkpad"],
    "watch": ["watch", "watches", "smartwatch"],
    "headphones": ["headphones", "headphone", "earbuds"],
    "camera": ["camera", "cameras", "dslr"],
    "tablet": ["tablet", "tablets", "ipad"],
    "tv": ["tv", "television", "monitor"],
    "printer": ["printer", "printers"],
    "keyboard": ["keyboard", "keyboards"],
    "mouse": ["mouse", "mice"],
    "airpods": ["airpods", "airpod", "handfree"],
    "logitech": ["logitech"]
}

# Canonical product key -> the REAL category name stored in the database.
# When a key resolves here, we filter by the `category` column exactly
# instead of a loose LIKE search across name/brand/category - this avoids
# false positives like "phone" matching inside the word "Headphones".
CATEGORY_MAP = {
    "laptop": "Laptops",
    "phone": "Mobile Phones",
    "watch": "Smart Watches",
    "headphones": "Headphones & Earbuds",
    "camera": "Cameras",
    "tablet": "Tablets",
    "tv": "TVs & Monitors",
    "printer": "Printers",
    "keyboard": "Keyboards & Mice",
    "mouse": "Keyboards & Mice",
    "airpods": "Headphones & Earbuds",
}

BRAND_KEYWORDS = ["hp", "dell", "lenovo", "asus", "acer", "msi", "samsung", "apple", "oneplus", "logitech", "airpods"]


def clean_text(message):
    """Lowercase the message and strip filler/stopwords (substring-safe order preserved)."""
    text = message.lower().strip()
    for word in STOPWORDS:
        text = text.replace(word, " ")
    return text


def match_categories(message):
    """
    Return every distinct canonical product key mentioned in the message,
    in the order they first appear. Used so "mobile or laptop" surfaces
    BOTH categories instead of silently picking just one.
    """
    text = clean_text(message)
    words = text.split()
    found = []

    # Brand + product combos first (e.g. "hp laptop" -> more specific than just "hp")
    for brand in BRAND_KEYWORDS:
        if brand in text:
            for i, word in enumerate(words):
                if word == brand and i + 1 < len(words):
                    next_word = words[i + 1]
                    for product, variants in PRODUCT_MAP.items():
                        if next_word in variants or next_word == product:
                            combo = f"{brand} {product}"
                            if combo not in found:
                                found.append(combo)
                            break

    # Whole-word product/category matches
    for word in words:
        for product, variants in PRODUCT_MAP.items():
            if (word in variants or word == product) and product not in found:
                found.append(product)
                break

    return found


def search_by_keys(keys, min_price=None, max_price=None, limit=5):
    """
    Fetch products for one or more matched product keys. Category-mapped
    keys (phone, laptop, watch, ...) filter on the exact `category` column;
    everything else (brand names, "iphone", brand+product combos) falls
    back to the free-text search across name/brand/category.
    """
    if not keys:
        return []

    if len(keys) == 1:
        key = keys[0]
        category = CATEGORY_MAP.get(key)
        return search_products(
            search=None if category else key,
            category=category,
            min_price=min_price,
            max_price=max_price,
            limit=limit
        )

    per_key_limit = max(2, limit // len(keys))
    combined = []
    seen_ids = set()

    for key in keys:
        category = CATEGORY_MAP.get(key)
        results = search_products(
            search=None if category else key,
            category=category,
            min_price=min_price,
            max_price=max_price,
            limit=per_key_limit
        )
        for product in results:
            if product["id"] not in seen_ids:
                combined.append(product)
                seen_ids.add(product["id"])

    return combined


# ---------------------------------------------------------
# HELPER FUNCTIONS
# ---------------------------------------------------------
def has_word(text, word_list):
    """Exact standalone word matching - STRICT"""
    pattern = r'\b(' + '|'.join([re.escape(w) for w in word_list]) + r')\b'
    return bool(re.search(pattern, text, re.IGNORECASE))

# ✅ New function for buying intent
def has_buy_intent(text):
    """Check if user explicitly wants to buy NOW"""
    text = text.lower()
    # Must have "now" or "order" or "checkout" with buy/purchase
    if "buy now" in text or "order now" in text or "purchase now" in text:
        return True
    if "place order" in text or "checkout" in text:
        return True
    # If just "buy" without "now", it's a question
    if "buy" in text and "?" not in text:
        # Check if it's a statement, not a question
        if not any(q in text for q in ["do you", "have", "available", "?"]):
            return True
    return False


def extract_price_filters(message):
    text = message.lower().replace(",", "")
    min_price, max_price = None, None
    match = re.search(r"(?:under|below|less than|up to|max(?:imum)?)[^\d]{0,20}(\d+)", text)
    if match:
        max_price = float(match.group(1))
    match = re.search(r"(?:above|over|more than|minimum)[^\d]{0,20}(\d+)", text)
    if match:
        min_price = float(match.group(1))
    return min_price, max_price


def extract_search_term(message):
    """Return the single best-matching product/category key (first mention wins)."""
    matches = match_categories(message)
    return matches[0] if matches else ""


def extract_quantity(message, search_term=""):
    text = message.lower()
    if search_term:
        text = text.replace(search_term.lower(), "")
        
    words_to_remove = ["add to cart", "cart", "add", "to", "in", "me", "mein", "karo", "daalo", "please", "buy", "purchase", "order"]
    for w in words_to_remove:
        text = text.replace(w, " ")
        
    text = text.strip()
    match = re.search(r"\b(\d+)\b", text)
    if match:
        val = int(match.group(1))
        if 1 <= val <= 20:
            return val
            
    return 1


# ---------------------------------------------------------
# CHATBOT ROUTE
# ---------------------------------------------------------
@ai.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json() or {}
        message = data.get("message", "").strip()
        conversation = data.get("conversation", [])

        user_id_raw = (
            data.get("user_id") 
            or request.headers.get("X-User-Id") 
            or session.get("user_id")
        )

        if not user_id_raw:
            return jsonify({
                "reply": "🔒 **Please Log In First!**\n\nAI Cart, Wishlist, aur Order features use karne ke liye aap ka login hona zaroori hai."
            }), 401

        try:
            active_user_id = int(user_id_raw)
        except ValueError:
            return jsonify({"reply": "⚠️ Invalid User ID provided."}), 400

        if not message:
            return jsonify({"error": "Message is required"}), 400

        msg_lower = message.lower()

        # Check if the VERY LAST AI message explicitly asked for Address
        asked_for_address = False
        if conversation:
            for prev in reversed(conversation):
                prev_text = str(prev.get("reply") or prev.get("message") or "").lower()
                role = prev.get("role")
                if role == "ai" or "smartcart bot" in prev_text or "rs." in prev_text or "cart" in prev_text:
                    if "address batayein" in prev_text or "shipping address" in prev_text:
                        asked_for_address = True
                    break

        is_explicit_command = any(k in msg_lower for k in [
            "add to cart", "add to wishlist", "buy", "buy now", "order now",
            "show", "view", "find", "search", "check", "my cart", "my wishlist", "my orders"
        ])

        # ---------------------------------------------------------
        # 1. ADD TO WISHLIST (High Priority)
        # ---------------------------------------------------------
        if "wishlist" in msg_lower and any(k in msg_lower for k in ["add", "save", "daalo", "put", "keep"]):
            search_term = extract_search_term(message)
            products = search_by_keys([search_term] if search_term else [], limit=1)

            if not products and conversation:
                for prev in reversed(conversation):
                    p_term = extract_search_term(prev.get("message", ""))
                    if p_term:
                        products = search_by_keys([p_term], limit=1)
                        if products: break

            if products:
                p = products[0]
                res = add_to_wishlist(user_id=active_user_id, product_id=p["id"])
                if res.get("success"):
                    return jsonify({"reply": f"❤️ **{p['name']}** added to your wishlist!"})
                return jsonify({"reply": f"⚠️ {res.get('message', 'Could not add to wishlist.')}"})
            return jsonify({"reply": "Which product would you like to add to your wishlist?"})

        # ---------------------------------------------------------
        # 2. ADD TO CART ONLY
        # ---------------------------------------------------------
        if "cart" in msg_lower and any(k in msg_lower for k in ["add", "daalo", "put", "insert", "karo"]):
            search_term = extract_search_term(message)
            products = search_by_keys([search_term] if search_term else [], limit=1)

            if not products and conversation:
                for prev in reversed(conversation):
                    p_term = extract_search_term(prev.get("message", ""))
                    if p_term:
                        products = search_by_keys([p_term], limit=1)
                        if products: break

            if products:
                p = products[0]
                qty = extract_quantity(message, search_term=search_term)
                res = add_to_cart(user_id=active_user_id, product_id=p["id"], quantity=qty)
                if res.get("success"):
                    return jsonify({"reply": f"✅ **{p['name']}** (x{qty}) has been added to your cart! 🛒"})
                return jsonify({"reply": f"⚠️ {res.get('message', 'Could not add to cart.')}"})
            return jsonify({"reply": "Which product would you like to add to your cart?"})

        # ---------------------------------------------------------
        # 3. BUY NOW / DIRECT PURCHASE (STRICT - ONLY FOR CLEAR INTENT)
        # ---------------------------------------------------------
        # ✅ FIX: Only trigger if user explicitly says "buy now" or "order now"
        # NOT when "buy" is just a word in a sentence like "I want to buy"
        is_buy_now_intent = (
            "buy now" in msg_lower 
            or "order now" in msg_lower 
            or "purchase now" in msg_lower
            or "place order" in msg_lower
            or "checkout" in msg_lower
        )

        # ✅ Also check if user is asking a question (has "?" or "do you have")
        is_question = "?" in message or "do you" in msg_lower or "have" in msg_lower

        if is_buy_now_intent and not is_question:
            search_term = extract_search_term(message)

            products = search_by_keys([search_term] if search_term else [], limit=1)

            if not products and conversation:
                for prev in reversed(conversation):
                    p_term = extract_search_term(prev.get("message", ""))
                    if p_term:
                        products = search_by_keys([p_term], limit=1)
                        if products: break
                        
            if products:
                p = products[0]
                qty = extract_quantity(message, search_term=search_term)
                
                if qty < 1: qty = 1
                
                cart_res = get_cart(user_id=active_user_id)
                cart_items = cart_res.get("items", []) if (cart_res and cart_res.get("success")) else []
                
                existing_item = next((item for item in cart_items if item.get("product_id") == p["id"]), None)
                
                if not existing_item:
                    add_to_cart(user_id=active_user_id, product_id=p["id"], quantity=qty)
                    display_qty = qty
                else:
                    display_qty = existing_item.get("quantity", qty)
                
                total_price = float(p['price']) * display_qty
                delivery_fee = 200
                grand_total = total_price + delivery_fee
                
                return jsonify({
                    "reply": f"🛍️ **{p['name']}** (x{display_qty}) - Rs. {total_price:,.0f}\n\n📍 Order confirm karne ke liye apna **Shipping Address** batayein:",
                    "products": [p],
                    "product": {
                        "id": p["id"],
                        "name": p["name"],
                        "price": p["price"],
                        "quantity": display_qty,
                        "total": total_price,
                        "delivery": delivery_fee,
                        "grand_total": grand_total
                    }
                })
            return jsonify({"reply": "Which product would you like to buy?"})

        # ---------------------------------------------------------
        # 4. VIEW WISHLIST
        # ---------------------------------------------------------
        if "wishlist" in msg_lower and has_word(msg_lower, ["show", "view", "my", "check", "dikhao", "open", "get", "list"]):
            res = get_wishlist(user_id=active_user_id)
            if res.get("success") and res.get("items"):
                items_str = "\n".join([f"• **{i['name']}** - Rs. {float(i['price']):,.0f}" for i in res["items"]])
                return jsonify({"reply": f"❤️ **Your Wishlist:**\n\n{items_str}"})
            return jsonify({"reply": "❤️ Your wishlist is empty."})

        # ---------------------------------------------------------
        # 5. VIEW CART
        # ---------------------------------------------------------
        if "cart" in msg_lower and has_word(msg_lower, ["show", "view", "my", "check", "dikhao", "open", "get"]):
            res = get_cart(user_id=active_user_id)
            if res.get("success") and res.get("items"):
                items_str = "\n".join([f"• **{i['name']}** (x{i['quantity']}) - Rs. {float(i['subtotal']):,.0f}" for i in res["items"]])
                return jsonify({"reply": f"🛒 **Your Shopping Cart:**\n\n{items_str}\n\n**Total:** Rs. {res['total']:,.0f}"})
            return jsonify({"reply": "🛒 Your shopping cart is empty."})

        # ---------------------------------------------------------
        # 6. ORDER HISTORY
        # ---------------------------------------------------------
        if has_word(msg_lower, ["orders", "order"]) and has_word(msg_lower, ["show", "view", "my", "check", "get", "history", "status", "dikhao"]):
            res = get_orders(user_id=active_user_id)
            if res.get("success") and res.get("orders"):
                orders_str = "\n".join([f"• **Order #{o['order_id']}** | Status: `{o['status']}` | Total: Rs. {float(o['total_amount']):,.0f}" for o in res["orders"]])
                return jsonify({"reply": f"📦 **Your Order History:**\n\n{orders_str}"})
            return jsonify({"reply": "📦 You have no past orders."})

        # ---------------------------------------------------------
        # 7. CONFIRM ORDER / CHECKOUT
        # ---------------------------------------------------------
        is_checkout_intent = any(k in msg_lower for k in ["place order", "checkout", "confirm order", "order place karo", "checkout karo"])

        if (asked_for_address and not is_explicit_command) or is_checkout_intent:
            shipping_address = message if (asked_for_address and not is_checkout_intent) else data.get("shipping_address", "North Karachi, Pakistan")
            
            # ✅ Exact payment_method dynamic capture from frontend payload
            payment = data.get("payment_method") or "Cash on Delivery"
            
            res = place_order(user_id=active_user_id, shipping_address=shipping_address, payment_method=payment)
            if res.get("success"):
                return jsonify({
                    "reply": f"🎉 **Order Placed Successfully!**\n\n• **Order ID:** #{res['order_id']}\n• **Total Amount:** Rs. {res['total_amount']:,.0f}\n• **Payment Method:** {res['payment_method']}\n• **Shipping Address:** {shipping_address}\n\nℹ️ *Aap ka order place ho gaya hai. Placed orders dekhne ke liye **'My Orders'** type karein.*"
                })
            return jsonify({"reply": f"⚠️ {res.get('message', 'Cart is empty or order placement failed.')}"})

        # ---------------------------------------------------------
        # 8. DYNAMIC PRODUCT SEARCH
        # ---------------------------------------------------------
        print("====== PRODUCT SEARCH BLOCK ======")
        print("MESSAGE:", message)
        min_price, max_price = extract_price_filters(message)
        matched_keys = match_categories(message)
        search_term = matched_keys[0] if matched_keys else ""

        is_search_intent = (
            any(k in msg_lower for k in ["search", "find", "show", "available", "have",
                                        "dekho", "dikhao", "dhoondo", "hai", "available"])
            or bool(matched_keys)
            or (min_price is not None or max_price is not None)
        )

        if is_search_intent and (matched_keys or min_price or max_price):
            products = search_by_keys(
                matched_keys,
                min_price=min_price,
                max_price=max_price,
                limit=5
            )
            print("FOUND PRODUCTS:", len(products) if products else 0)

            if products:
                reply_lines = []
                for p in products:
                    line = (
                        f"🛍️ **{p['name']}**\n"
                        f"Brand: {p['brand']} | Category: {p['category']}\n"
                        f"Price: Rs. {float(p['price']):,.0f} | Stock: {p['stock']}"
                    )
                    reply_lines.append(line)

                intro = "Here are the matching products from our database:"
                if len(matched_keys) >= 2:
                    labels = [CATEGORY_MAP.get(k, k).title() for k in matched_keys]
                    intro = f"Here's what I found across {' and '.join(labels)}:"

                return jsonify({
                    "reply": intro + "\n\n" + "\n\n".join(reply_lines),
                    "products": products
                })
            else:
                return jsonify({
                    "reply": f"❌ Sorry, no products found for **'{search_term}'**.\n\nTry searching for:\n• Laptops\n• Mobile Phones\n• Smart Watches\n• Headphones"
                })

        # ---------------------------------------------------------
        # 9. GENERAL AI CHAT (Gemini Fallback - WITH CARDS)
        # ---------------------------------------------------------
        if client:
            matched_keys = match_categories(message)

            if not matched_keys and conversation:
                for prev in reversed(conversation):
                    prev_msg = prev.get("message") or prev.get("content") or ""
                    matched_keys = match_categories(str(prev_msg))
                    if matched_keys:
                        break

            print("=" * 60)
            print("USER:", message)
            print("MATCHED KEYS:", matched_keys)
            db_products = search_by_keys(matched_keys, limit=5)

            print("FOUND:", len(db_products) if db_products else 0)
            print("=" * 60)

            # ✅ FIX: If products found, return them with cards
            if db_products and matched_keys:
                label = " and ".join(CATEGORY_MAP.get(k, k).title() for k in matched_keys)
                return jsonify({
                    "reply": f"🛍️ I found these {label} products in our database:",
                    "products": db_products  # 👈 This triggers cards
                })
            
            # ❌ No products found - Use Gemini for friendly response
            stock_info = "No matching products found in SmartCart database."

            system_instruction = f"""
        You are SmartCart AI, an intelligent shopping assistant for SmartCart AI.

        Your job is to help users search products, compare products, recommend products,
        manage shopping cart, wishlist and orders using the SmartCart database.

=========================
GENERAL RULES
=========================

1. ALWAYS trust the SmartCart database.
If products exist in the database, they are available.
Never say products are unavailable unless the database is empty.

2. NEVER invent products.

3. NEVER invent prices.

4. NEVER invent specifications.

5. NEVER invent stock quantities.

6. Only use information available in the SmartCart database.

7. If information is missing, politely tell the user.

=========================
LANGUAGE
=========================

Reply in the same language used by the user.

=========================
STYLE
=========================

Be:
Friendly | Professional | Concise | Helpful

DATABASE CONTEXT:
{stock_info}
"""

            prompt = f"{system_instruction}\n\nUser Message: {message}"

            response = client.models.generate_content(
                model="gemini-3.1-flash-lite",
                contents=prompt
            )
            return jsonify({"reply": response.text})

        # ✅ FIXED: Yeh return tab chalega jab client None ho
        return jsonify({"reply": "I am here to help you with SmartCart AI!"})

    except Exception as e:
        print("AI ROUTE ERROR:", str(e))
        return jsonify({"reply": f"Backend Error: {str(e)}"}), 500