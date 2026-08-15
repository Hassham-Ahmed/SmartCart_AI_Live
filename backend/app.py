import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from routes.auth import auth
from routes.products import products
from routes.ai import ai
from flask import render_template

load_dotenv()

app = Flask(__name__)
# Session support ke liye secret key zaroori hai
app.secret_key = os.getenv("SECRET_KEY", "smartcart_secret_key_12345")
CORS(app)

app.register_blueprint(auth, url_prefix="/api/auth")
app.register_blueprint(products, url_prefix="/api/products")
app.register_blueprint(ai, url_prefix="/api/ai")

# Agar Jinja templates se render kar rahe hain:
@app.route('/components/navbar')
def get_navbar():
    return render_template('navbar.html')

@app.route("/")
def home():
    return "Welcome to SmartCart AI Backend!"


@app.route("/api/test")
def test():
    return {
        "message": "Backend Connected Successfully!",
        "status": "success"
    }


if __name__ == "__main__":
    app.run(debug=True)