import os
from dotenv import load_dotenv
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


# Local development ke liye .env load karein
load_dotenv()

def get_db():
    host = os.environ.get("DB_HOST")
    user = os.environ.get("DB_USER")
    password = os.environ.get("DB_PASSWORD")
    database = os.environ.get("DB_NAME")
    port = int(os.environ.get("DB_PORT", 28028))

    return mysql.connector.connect(
        host=host,
        user=user,
        password=password,
        database=database,
        port=port,
        ssl_disabled=False,
        ssl_verify_identity=False
    )