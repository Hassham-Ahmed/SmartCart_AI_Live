# config.py
import os
import mysql.connector
from dotenv import load_dotenv

# .env file load karo
load_dotenv()


def get_db():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        port=int(os.getenv("DB_PORT", 20480)),
        use_pure=True,
        ssl_disabled=False,
        ssl_verify_identity=False,
    )