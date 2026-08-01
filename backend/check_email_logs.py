import psycopg2
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config import DATABASE_URL

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("""
    SELECT id, recipient_email, subject, email_type, status, sent_at, metadata
    FROM email_logs
    ORDER BY sent_at DESC
    LIMIT 10
""")
rows = cur.fetchall()

print("RECENT EMAIL LOGS:")
for r in rows:
    print(f"ID: {r[0]} | To: {r[1]} | Subject: {r[2]} | Type: {r[3]} | Status: {r[4]} | Time: {r[5]}")
    print(f"  Metadata: {r[6]}")
    print("-" * 60)
