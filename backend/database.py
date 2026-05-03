import psycopg2
from psycopg2 import pool
from contextlib import contextmanager
from config import DATABASE_URL

_pool = None

def get_pool():
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=10,
            dsn=DATABASE_URL,  # ← single URL instead of separate params
            sslmode="require",
            keepalives=1,
            keepalives_idle=30,
            keepalives_interval=10,
            keepalives_count=5
        )
    return _pool


@contextmanager
def get_connection():
    """Get a connection from the pool, auto-return on exit."""
    p = get_pool()
    conn = None
    
    # Try to get a valid connection, discarding dead ones
    for _ in range(3):
        conn = p.getconn()
        try:
            if conn.closed:
                raise psycopg2.OperationalError("Connection is marked as closed.")
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            break  # Connection is alive and healthy
        except psycopg2.OperationalError:
            p.putconn(conn, close=True)
            conn = None
            
    if conn is None:
        raise Exception("Failed to get a working database connection from the pool.")

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
    """Convenience: get a cursor with auto-commit/rollback."""
    with get_connection() as conn:
        cur = conn.cursor()
        try:
            yield cur
        finally:
            cur.close()
