import psycopg2
from config import DATABASE_URL

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("SELECT id, identifier FROM users WHERE role = 'student' LIMIT 1")
user = cur.fetchone()
print("Test student:", user)
