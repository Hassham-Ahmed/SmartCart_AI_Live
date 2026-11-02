"""
Conversation context ("MCP-style" context object) + memory.

Short-term  : the context object for an active chat session. Stored in Redis
              (Upstash, 2h TTL) when configured and always mirrored to MySQL
              `ai_sessions`, so a cold serverless instance can pick it up.
Long-term   : `ai_user_profiles` - merged preferences across sessions plus a
              "taste embedding" (mean vector of products the user bought,
              wishlisted or viewed). Loaded at the start of every session.

Storage note: the brief suggested MongoDB for long-term profiles. The project
already runs MySQL; adding Mongo would mean a second database to secure,
back up and pay for, for a few KB of JSON per user. A MEDIUMTEXT JSON column
does the job. (See "Needs Your Input" in the PR if you still want Mongo.)

Extraction is rule-based on purpose: it runs on every turn, costs nothing,
is deterministic and testable. The LLM still sees the raw message, so
anything the rules miss it can handle itself.
"""
import copy
import json
import re
import time

from config import get_db
from db_schema import ensure_schema
from .kv import kv

SESSION_TTL = 60 * 60 * 2
MAX_TURNS = 5

EMPTY_CONTEXT = {
    "user_id": None,
    "session_id": None,
    "preferences": {"categories": [], "brands": [], "price_range": {}, "features": []},
    "history": {"searches": [], "viewed": [], "purchased": []},
    "current_intent": "browse",
    "current_step": "discovery",
    "entities": {"product": None, "budget": None, "quantity": None, "order_id": None},
    "last_5_turns": [],
    "tone": "neutral",
    "language": "english",       # english | roman_urdu (reply in the same language)
    "last_products": [],        # ids shown in the previous answer ("add the second one")
    "pending_checkout": None,   # two-phase confirmation for orders
    "profile_summary": None,
    "updated_at": None,
}

FEATURE_WORDS = [
    "gaming", "camera", "battery", "lightweight", "light", "portable", "wireless", "bluetooth", "waterproof",
    "5g", "4g", "ssd", "rtx", "oled", "amoled", "fast charging", "noise cancelling", "noise cancellation",
    "touchscreen", "2-in-1", "office", "student", "coding", "programming", "editing", "business", "casual",
    "formal", "sports", "running", "kids", "organic", "leather", "cotton", "smart", "storage", "ram",
]

# English + Roman Urdu phrasings (e.g. "mera order kahan hai", "cart mein daal do").
INTENT_RULES = [
    ("track", r"\b(track|tracking|where(?:'s| is) my|order status|status of (?:my )?order|deliver(?:y|ed)\b.*order|order\s*#?\d+"
              r"|order\b.*\b(?:kahan|kahaan|kidhar|kab tak|kab (?:aye|aaye|ayega|aayega|milega|pohanchega))"
              r"|(?:mera|meri|mere)\s+(?:order|parcel)\b.*\b(?:status|kya hua|kahan|kahaan))"),
    ("support", r"\b(refund|return|exchange|complain|complaint|broken|damaged|warranty|cancel(?:\s+my)?\s+order|contact|human|agent|support"
                r"|wapas|wapis|paise wapas|shikayat|kharab|toota|tuta|order cancel)\b"),
    ("compare", r"\b(compare|comparison|vs\.?|versus|difference between|which is better|better than"
                r"|farq|fark|muqabla|kaun sa behtar|kon sa behtar|kaunsa behtar|konsa behtar|zyada behtar)\b"),
    ("buy", r"\b(buy|purchase|order (?:it|this|that|now)|place (?:the |my )?order|checkout|check out|add (?:it |this |that |them )?to (?:my )?cart|add\b.*\bcart|remove\b.*\bcart|my cart|view cart|wishlist"
            r"|cart\s+(?:mein|me|main)\b|khareed|khareedna|khareed lo|le lo|order (?:kar|karo|kardo|kar do)|checkout karo|mera cart)\b"),
]

# Common Roman Urdu function words - if a message has several, the shopper is writing Roman Urdu.
ROMAN_URDU_MARKERS = set(
    "mujhe mujh mera meri mere hum humein aap ap tum kya kia kyun kaise kesa kaisa kahan kahaan kab kitna kitne kitni "
    "chahiye chahye chaiye hai hain tha thi ho hoga hogi karo kardo kar do daal dal daalo dikhao dikhaao batao bataen "
    "wala wali wale sasta sasti saste mehnga acha acchi achi accha bohat bahut zyada kam se mein main ka ki ke ko "
    "nahi nahin bhai yaar jee ji abhi dono sab koi kuch aur lekin magar".split()
)

_CASUAL = re.compile(r"\b(hey|yo|bro|bhai|yaar|dude|lol|pls|plz|thx|thanks!|gonna|wanna|u|ur|k|ok+)\b|[😀-🙏🔥👍❤]", re.I)
_FORMAL = re.compile(r"\b(kindly|could you please|would you|dear|regards|i would like|may i)\b", re.I)


# ------------------------------------------------------------- extraction
def parse_amount(num, unit):
    value = float(num.replace(",", ""))
    unit = (unit or "").lower()
    if unit in ("k", "thousand", "hazar", "hazaar", "hzar"):
        value *= 1_000
    elif unit in ("lakh", "lac", "lacs", "lakhs", "l"):
        value *= 100_000
    elif unit in ("m", "million", "mn"):
        value *= 1_000_000
    return value


_AMOUNT = r"(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|hazar|hazaar|hzar|lakh|lakhs|lac|lacs|l|m|mn|million)?\b"


def extract_budget(text):
    t = text.lower().replace("rs.", " ").replace("rs", " ").replace("pkr", " ")
    m = re.search(r"between\s+" + _AMOUNT + r"\s+(?:and|to|-)\s+" + _AMOUNT, t)
    if m:
        lo, hi = parse_amount(m.group(1), m.group(2)), parse_amount(m.group(3), m.group(4))
        return {"min": min(lo, hi), "max": max(lo, hi)}
    # Roman Urdu range: "30 se 50 hazar ke beech" / "30k se 50k tak" (unit may only follow the 2nd number)
    m = re.search(_AMOUNT + r"\s+se\s+" + _AMOUNT + r"\s*(?:ke|k)?\s*(?:beech|darmiyan|tak)\b", t)
    if m:
        hi = parse_amount(m.group(3), m.group(4))
        lo = parse_amount(m.group(1), m.group(2) or m.group(4))
        return {"min": min(lo, hi), "max": max(lo, hi)}
    # Roman Urdu postfix: "50k se kam", "1 lakh tak", "50 hazar ke andar", "60k ke neeche"
    m = re.search(_AMOUNT + r"\s*(?:se kam|se kum|tak|ke andar|k andar|ke neeche|ke niche|se neeche|ki range)\b", t)
    if m:
        return {"max": parse_amount(m.group(1), m.group(2))}
    m = re.search(_AMOUNT + r"\s*(?:se (?:zyada|ziada|upar|oopar))\b", t)
    if m:
        return {"min": parse_amount(m.group(1), m.group(2))}
    m = re.search(r"(?:under|below|less than|upto|up to|within|max(?:imum)?|budget(?: is| of)?|not more than)\s*(?:of\s*)?" + _AMOUNT, t)
    if m:
        return {"max": parse_amount(m.group(1), m.group(2))}
    m = re.search(r"(?:above|over|more than|at least|minimum|starting)\s*" + _AMOUNT, t)
    if m:
        return {"min": parse_amount(m.group(1), m.group(2))}
    m = re.search(r"\baround\s*" + _AMOUNT, t)
    if m:
        v = parse_amount(m.group(1), m.group(2))
        return {"min": round(v * 0.8), "max": round(v * 1.2)}
    return None


def extract_quantity(text):
    m = re.search(r"\b(\d{1,2})\s*(?:x|pcs|pieces|units|qty)\b|\b(?:qty|quantity)\s*(\d{1,2})\b", text.lower())
    if m:
        return int(m.group(1) or m.group(2))
    words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "a pair of": 2, "couple of": 2}
    for w, n in words.items():
        if re.search(rf"\b{w}\b", text.lower()) and re.search(r"\b(add|buy|order|want)\b", text.lower()):
            return n
    return None


def detect_intent(text):
    t = text.lower()
    for intent, pattern in INTENT_RULES:
        if re.search(pattern, t):
            return intent
    return "browse"


def detect_language(text):
    """'roman_urdu' when >=2 Roman Urdu marker words (or >=30% of words), else 'english'."""
    words = re.findall(r"[a-z]+", text.lower())
    if not words:
        return "english"
    hits = sum(w in ROMAN_URDU_MARKERS for w in words)
    return "roman_urdu" if hits >= 2 or hits / len(words) >= 0.3 else "english"


def detect_tone(text):
    if _FORMAL.search(text):
        return "formal"
    if _CASUAL.search(text) or (text.islower() and len(text) < 60):
        return "casual"
    return "neutral"


def step_for(intent, text):
    t = text.lower()
    if intent == "track":
        return "tracking"
    if intent == "compare":
        return "comparison"
    if intent == "buy":
        return "checkout" if re.search(r"checkout|check out|place (?:the |my )?order", t) else "cart"
    return "discovery"


def _known(index_products):
    cats = sorted({p["category"] for p in index_products if p.get("category")})
    brands = sorted({p["brand"] for p in index_products if p.get("brand") and p["brand"].lower() not in ("generic", "local brand")})
    return cats, brands


def update_from_message(ctx, message, catalog=None):
    """Mutates ctx with entities, intent, step, tone and preferences from `message`."""
    from .vector_store import category_synonyms

    text = message.strip()
    low = text.lower()
    intent = detect_intent(text)
    ctx["current_intent"] = intent
    ctx["current_step"] = step_for(intent, text)
    ctx["tone"] = detect_tone(text)
    ctx["language"] = detect_language(text)

    budget = extract_budget(text)
    ctx["entities"]["budget"] = budget  # per-turn: only a budget stated *now* is a hard filter
    if budget:
        ctx["preferences"]["price_range"] = budget

    qty = extract_quantity(text)
    ctx["entities"]["quantity"] = qty

    m = re.search(r"(?:order|#)\s*#?\s*(\d{1,9})\b", low)
    ctx["entities"]["order_id"] = int(m.group(1)) if m and intent == "track" else None

    if catalog:
        cats, brands = _known(catalog)
        for c in cats:
            words = set((c.lower() + " " + category_synonyms(c)).replace("&", " ").replace("(", " ").replace(")", " ").split())
            if any(re.search(rf"\b{re.escape(w)}s?\b", low) for w in words if len(w) > 3):
                _push_unique(ctx["preferences"]["categories"], c, 5)
        for b in brands:
            if re.search(rf"\b{re.escape(b.lower())}\b", low):
                _push_unique(ctx["preferences"]["brands"], b, 6)

    for f in FEATURE_WORDS:
        if re.search(rf"\b{re.escape(f)}\b", low):
            _push_unique(ctx["preferences"]["features"], f, 8)

    if intent in ("browse", "compare") and len(text) > 2:
        _push_unique(ctx["history"]["searches"], text[:120], 10)
    return ctx


def _push_unique(lst, value, cap):
    if value in lst:
        lst.remove(value)
    lst.append(value)
    del lst[:-cap]


def add_turn(ctx, role, text):
    ctx["last_5_turns"].append({"role": role, "text": (text or "")[:1500]})
    ctx["last_5_turns"] = ctx["last_5_turns"][-(MAX_TURNS * 2):]  # 5 user + 5 assistant messages


def retrieval_query(ctx, message):
    """Make follow-ups ('any cheaper?', 'what about samsung') retrievable."""
    words = re.findall(r"[a-zA-Z]+", message)
    vague = len(words) <= 5 or re.search(
        r"\b(it|this|that|those|them|these|cheaper|another|more|else|similar|other"
        r"|yeh|ye|woh|wo|isse|is se|us se|sasta|saste|sasti|dusra|doosra|aur|jaisa|jaisi)\b", message.lower())
    prev = [s for s in ctx["history"]["searches"] if s != message]
    if vague and prev:
        return f"{prev[-1]} {message}"
    return message


# -------------------------------------------------------------- persistence
def _db():
    ensure_schema()
    return get_db()


def load(session_id, user_id):
    key = f"ctx:{session_id}"
    ctx = kv.get_json(key)
    if ctx is None:
        try:
            db = _db()
            cur = db.cursor()
            cur.execute("SELECT context FROM ai_sessions WHERE session_id=%s", (session_id,))
            row = cur.fetchone()
            cur.close()
            db.close()
            ctx = json.loads(row[0]) if row else None
        except Exception as e:  # noqa: BLE001
            print("context load failed:", e)
            ctx = None

    fresh = copy.deepcopy(EMPTY_CONTEXT)
    if ctx is None:
        ctx = fresh
    else:
        owner = ctx.get("user_id")
        if owner is not None and owner != user_id:
            ctx = fresh  # never let one account read another account's session
        else:
            for k, v in fresh.items():  # forward-compatible with schema additions
                ctx.setdefault(k, v)
    ctx["session_id"] = session_id
    ctx["user_id"] = user_id
    return ctx


def save(ctx):
    ctx["updated_at"] = int(time.time())
    kv.set_json(f"ctx:{ctx['session_id']}", ctx, SESSION_TTL)
    try:
        db = _db()
        cur = db.cursor()
        cur.execute(
            """INSERT INTO ai_sessions (session_id, user_id, context) VALUES (%s,%s,%s)
               ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), context=VALUES(context)""",
            (ctx["session_id"], ctx["user_id"], json.dumps(ctx, default=str)),
        )
        db.commit()
        cur.close()
        db.close()
    except Exception as e:  # noqa: BLE001
        print("context save failed:", e)


def reset(session_id):
    kv.delete(f"ctx:{session_id}")
    try:
        db = _db()
        cur = db.cursor()
        cur.execute("DELETE FROM ai_sessions WHERE session_id=%s", (session_id,))
        db.commit()
        cur.close()
        db.close()
    except Exception as e:  # noqa: BLE001
        print("context reset failed:", e)


# ------------------------------------------------------- long-term profile
def load_user_history(user_id, limit=10):
    """Purchased / viewed / wishlisted products for personalisation."""
    ensure_schema()
    db = get_db()
    cur = db.cursor(dictionary=True)
    out = {"purchased": [], "viewed": [], "wishlist": []}
    try:
        cur.execute(
            """SELECT oi.product_id, oi.name, MAX(o.created_at) AS at FROM order_items oi
               JOIN orders o ON o.id = oi.order_id WHERE o.user_id=%s
               GROUP BY oi.product_id, oi.name ORDER BY at DESC LIMIT %s""",
            (user_id, limit),
        )
        out["purchased"] = [{"id": r["product_id"], "name": r["name"]} for r in cur.fetchall()]
        cur.execute(
            """SELECT v.product_id, p.name, MAX(v.viewed_at) AS at FROM product_views v
               JOIN products p ON p.id = v.product_id WHERE v.user_id=%s
               GROUP BY v.product_id, p.name ORDER BY at DESC LIMIT %s""",
            (user_id, limit),
        )
        out["viewed"] = [{"id": r["product_id"], "name": r["name"]} for r in cur.fetchall()]
        cur.execute(
            """SELECT w.product_id, p.name FROM wishlist w JOIN products p ON p.id = w.product_id
               WHERE w.user_id=%s ORDER BY w.id DESC LIMIT %s""",
            (user_id, limit),
        )
        out["wishlist"] = [{"id": r["product_id"], "name": r["name"]} for r in cur.fetchall()]
    except Exception as e:  # noqa: BLE001
        print("history load failed:", e)
    finally:
        cur.close()
        db.close()
    return out


def load_profile(user_id):
    try:
        db = _db()
        cur = db.cursor()
        cur.execute("SELECT profile FROM ai_user_profiles WHERE user_id=%s", (user_id,))
        row = cur.fetchone()
        cur.close()
        db.close()
        return json.loads(row[0]) if row else {}
    except Exception as e:  # noqa: BLE001
        print("profile load failed:", e)
        return {}


def save_profile(user_id, ctx, taste_vec=None):
    """Merge this session's preferences into the long-term profile."""
    import numpy as np

    prof = load_profile(user_id)
    prefs = prof.get("preferences", {"categories": [], "brands": [], "features": [], "price_range": {}})
    for key in ("categories", "brands", "features"):
        for v in ctx["preferences"].get(key, []):
            _push_unique(prefs.setdefault(key, []), v, 10)
    if ctx["preferences"].get("price_range"):
        prefs["price_range"] = ctx["preferences"]["price_range"]
    prof["preferences"] = prefs
    prof["recent_searches"] = (prof.get("recent_searches", []) + ctx["history"]["searches"][-3:])[-10:]
    prof["tone"] = ctx.get("tone", "neutral")
    try:
        db = _db()
        cur = db.cursor()
        blob = np.asarray(taste_vec, dtype="<f4").tobytes() if taste_vec is not None else None
        cur.execute(
            """INSERT INTO ai_user_profiles (user_id, profile, taste_embedding) VALUES (%s,%s,%s)
               ON DUPLICATE KEY UPDATE profile=VALUES(profile),
               taste_embedding=COALESCE(VALUES(taste_embedding), taste_embedding)""",
            (user_id, json.dumps(prof), blob),
        )
        db.commit()
        cur.close()
        db.close()
    except Exception as e:  # noqa: BLE001
        print("profile save failed:", e)


def bootstrap_session(ctx):
    """
    Cross-session continuity: on the first turn of a session for a logged-in
    user, pull their long-term profile + purchase/view history into context.
    """
    if not ctx["user_id"] or ctx.get("profile_summary") is not None:
        return ctx
    prof = load_profile(ctx["user_id"])
    hist = load_user_history(ctx["user_id"])
    prefs = prof.get("preferences", {})
    for key in ("categories", "brands", "features"):
        for v in prefs.get(key, [])[-4:]:
            if v not in ctx["preferences"][key]:
                ctx["preferences"][key].append(v)
    if prefs.get("price_range") and not ctx["preferences"]["price_range"]:
        ctx["preferences"]["price_range"] = prefs["price_range"]
    ctx["history"]["purchased"] = [p["id"] for p in hist["purchased"]]
    ctx["history"]["viewed"] = [p["id"] for p in hist["viewed"]]
    lines = []
    if hist["purchased"]:
        lines.append("Bought before: " + ", ".join(p["name"] for p in hist["purchased"][:5]))
    if hist["wishlist"]:
        lines.append("Wishlist: " + ", ".join(p["name"] for p in hist["wishlist"][:5]))
    if hist["viewed"]:
        lines.append("Recently viewed: " + ", ".join(p["name"] for p in hist["viewed"][:5]))
    if prof.get("recent_searches"):
        lines.append("Past searches: " + "; ".join(prof["recent_searches"][-4:]))
    ctx["profile_summary"] = "\n".join(lines)
    ctx["_taste_ids"] = [p["id"] for p in hist["purchased"] + hist["wishlist"] + hist["viewed"]]
    return ctx
