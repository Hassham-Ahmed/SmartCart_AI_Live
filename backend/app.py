import os

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))  # before route imports read env

from flask import Flask, jsonify, send_from_directory  # noqa: E402
from flask_cors import CORS  # noqa: E402

from routes.ai import ai  # noqa: E402
from routes.auth import auth  # noqa: E402
from routes.products import products  # noqa: E402

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB request cap (uploads included)

# CORS: auth is now a bearer token (not cookies), so allowing any origin no
# longer lets other sites act as the user. Restrict further by setting
# CORS_ORIGINS="https://your-frontend.vercel.app,http://localhost:5173".
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
CORS(
    app,
    resources={r"/api/*": {"origins": _origins if _origins != ["*"] else "*"}},
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
