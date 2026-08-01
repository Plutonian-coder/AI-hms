import psycopg2
from config import DATABASE_URL
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("""SELECT conname, pg_get_constraintdef(c.oid) 
               FROM pg_constraint c 
               WHERE c.conrelid = 'session_register'::regclass AND c.contype = 'c'""")
for row in cur.fetchall():
    print(row)
cur.close()
conn.close()
