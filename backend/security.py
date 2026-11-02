"""
Authentication & authorization helpers.

Why this exists
---------------
Before this module, the API trusted whatever `user_id` the browser sent, so
anyone could read/modify any user's cart, orders and profile, and every
/admin endpoint was public. We now issue a signed, expiring bearer token at
login (itsdangerous ships with Flask - no new dependency) and derive the
user identity from that token on the server.

Passwords were stored in plaintext. New passwords are hashed with Werkzeug's
scrypt/pbkdf2 helpers. Existing plaintext passwords keep working and are
transparently upgraded to a hash on the user's next successful login, so no
one gets locked out.
"""
import os
from functools import wraps

from flask import g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

TOKEN_MAX_AGE = int(os.getenv("AUTH_TOKEN_MAX_AGE", 60 * 60 * 24 * 7))  # 7 days
_HASH_PREFIXES = ("scrypt:", "pbkdf2:")


def _secret_key():
    key = os.getenv("SECRET_KEY")
    if not key:
        # Fail loudly in production rather than silently signing tokens with
        # a value that is published in the git history.
        if os.getenv("VERCEL") or os.getenv("FLASK_ENV") == "production":
            raise RuntimeError("SECRET_KEY environment variable must be set in production.")
        key = "dev-only-insecure-secret-change-me"
    return key


def _serializer():
    return URLSafeTimedSerializer(_secret_key(), salt="smartcart-auth")


# ---------------------------------------------------------------- passwords
def hash_password(raw):
    return generate_password_hash(raw)


def is_hashed(stored):
    return bool(stored) and stored.startswith(_HASH_PREFIXES)


def verify_password(stored, raw):
    """Return (ok, needs_upgrade)."""
    if not stored or raw is None:
        return False, False
    if is_hashed(stored):
        return check_password_hash(stored, raw), False
    # Legacy plaintext row - compare in constant time, then flag for upgrade.
    import hmac
    ok = hmac.compare_digest(str(stored), str(raw))
    return ok, ok


# ------------------------------------------------------------------- tokens
def issue_token(user):
    return _serializer().dumps({"uid": int(user["id"]), "role": user.get("role", "user")})


def decode_token(token):
    try:
        data = _serializer().loads(token, max_age=TOKEN_MAX_AGE)
        return {"id": int(data["uid"]), "role": data.get("role", "user")}
    except (BadSignature, SignatureExpired, KeyError, ValueError, TypeError):
        return None


def current_user():
    """Identity from the Authorization header, or None (cached per request)."""
    if "auth_user" in g:
        return g.auth_user
    header = request.headers.get("Authorization", "")
    user = None
    if header.startswith("Bearer "):
        user = decode_token(header[7:].strip())
    g.auth_user = user
    return user


def _unauthorized(msg="Please log in to continue."):
    return jsonify({"message": msg, "error": "unauthorized"}), 401


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user():
            return _unauthorized()
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user:
            return _unauthorized()
        if user["role"] != "admin":
            return jsonify({"message": "Admin access required.", "error": "forbidden"}), 403
        return fn(*args, **kwargs)
    return wrapper


def owns(user_id):
    """True if the logged-in user is `user_id` or an admin (prevents IDOR)."""
    user = current_user()
    if not user:
        return False
    try:
        return user["role"] == "admin" or int(user_id) == user["id"]
    except (TypeError, ValueError):
        return False


def forbidden():
    return jsonify({"message": "You are not allowed to access this resource.", "error": "forbidden"}), 403
