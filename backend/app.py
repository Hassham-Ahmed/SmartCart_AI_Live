import os

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))  # before route imports read env

from startup_checks import run_startup_checks  # noqa: E402

# Fail fast: a missing/weak SECRET_KEY in production crashes the function on import with a clear
# message in the Vercel logs (every request 500s) instead of a "healthy" site where nobody can log in.
run_startup_checks()

from flask import Flask, jsonify, send_from_directory  # noqa: E402
from flask_cors import CORS  # noqa: E402

from routes.ai import ai  # noqa: E402
from routes.auth import auth  # noqa: E402
from routes.products import products  # noqa: E402

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB request cap (uploads included)

# CORS allowlist: the production frontend + local Vite dev server.
# Extra origins (e.g. a Vercel preview URL) can be added without a code change:
#   CORS_ORIGINS="https://my-preview.vercel.app,https://another.example"
FRONTEND_ORIGIN = "https://smart-cart-ai-frontend-live-w24x.vercel.app"
DEFAULT_ORIGINS = [FRONTEND_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"]
# Browsers send Origin without a trailing slash, so normalise configured values.
# "*" is ignored on purpose so a leftover CORS_ORIGINS=* can't silently re-open the API to every site.
_extra = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip() and o.strip() != "*"]
_origins = list(dict.fromkeys(DEFAULT_ORIGINS + _extra))
CORS(
    app,
    resources={r"/api/*": {"origins": _origins}},
    supports_credentials=False,
    allow_headers=["Content-Type", "Authorization", "X-Session-Id"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    expose_headers=["Content-Type"],
)

app.register_blueprint(auth, url_prefix="/api/auth")
app.register_blueprint(products, url_prefix="/api/products")
app.register_blueprint(ai, url_prefix="/api/ai")


@app.after_request
def security_headers(resp):
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    return resp


@app.errorhandler(500)
def internal_error(_e):
    return jsonify({"message": "Internal server error."}), 500


@app.route("/")
def home():
    return "Welcome to SmartCart AI Backend!"


@app.route("/api/test")
def test():
    return {"message": "Backend Connected Successfully!", "status": "success"}


@app.route("/static/images/<path:filename>")
def serve_images(filename):
    images_dir = os.path.join(app.root_path, "static", "images")
    resp = send_from_directory(images_dir, filename)
    resp.headers["Cache-Control"] = "public, max-age=604800, immutable"
    return resp


if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG") == "1")
