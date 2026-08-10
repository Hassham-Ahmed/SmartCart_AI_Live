from flask import Flask
from flask_cors import CORS

from routes.auth import auth
from routes.products import products

app = Flask(__name__)
CORS(app)

app.register_blueprint(auth, url_prefix="/api/auth")
app.register_blueprint(products, url_prefix="/api/products")


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