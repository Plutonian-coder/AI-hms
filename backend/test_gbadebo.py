import psycopg2
from config import DATABASE_URL

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("SELECT id, passport_photo_url FROM users WHERE identifier='FPT/CSC/25/0010'")
print("Gbadebo info:", cur.fetchone())
