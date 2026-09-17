import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()  # reads the .env file and loads variables into the environment

def get_db():
    return mysql.connector.connect(
        host="127.0.0.1",
        user="root",
        password="root",
        database="smartcart_ai"
    )