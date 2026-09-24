import os
from flask import Flask, send_from_directory, render_template
from flask_cors import CORS
from dotenv import load_dotenv

from routes.auth import auth
from routes.products import products
from routes.ai import ai

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "smartcart_secret_key_12345")

# FIX: CORS Settings for React Frontend
CORS(
    app,
    resources={r"/api/*": {"origins": "http://localhost:5173"}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
)

app.register_blueprint(auth, url_prefix="/api/auth")
app.register_blueprint(products, url_prefix="/api/products")
app.register_blueprint(ai, url_prefix="/api/ai")


@app.route("/")
def home():
    return "Welcome to SmartCart AI Backend!"


@app.route("/api/test")
def test():
    return {"message": "Backend Connected Successfully!", "status": "success"}


@app.route('/static/images/<path:filename>')
def serve_images(filename):
    """Static images ko serve karo. Vercel par bhi ye route chalega."""
    images_dir = os.path.join(app.root_path, 'static', 'images')
    return send_from_directory(images_dir, filename)


if __name__ == "__main__":
    app.run(debug=True)