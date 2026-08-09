import mysql.connector

db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="root",
    database="smartcart_ai"
)

print("✅ MySQL Connected Successfully!")