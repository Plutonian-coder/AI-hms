import psycopg2
from psycopg2 import pool
from contextlib import contextmanager
from config import DATABASE_URL

_pool = None

def get_pool():
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL is missing or empty. Check your .env file and config.py.")
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=10,
            dsn=DATABASE_URL,
            sslmode="require"
        )
    return _pool

@contextmanager
def get_connection():
    p = get_pool()
    conn = None
    for _ in range(3):
        conn = p.getconn()
        try:
            if conn.closed:
                raise psycopg2.OperationalError("Connection closed.")
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            break
        except psycopg2.OperationalError:
            p.putconn(conn, close=True)
            conn = None

    if conn is None:
        raise Exception("Failed to get a working database connection.")

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        p.putconn(conn)

@contextmanager
def get_cursor():
    with get_connection() as conn:
        cur = conn.cursor()
        try:
            yield cur
        finally:
            cur.close()