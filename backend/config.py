import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()  # reads the .env file and loads variables into the environment

def get_db():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME")
    )