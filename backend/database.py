"""
Database Connection Pool — 12-Factor Compliant (Factors IV, VIII, IX).

- Pool sizing is driven by environment variables (Factor III)
- Lazy initialization treats DB as an attached resource (Factor IV)
- Pool sizing accounts for multi-worker concurrency (Factor VIII)
- Explicit closeall() supports graceful shutdown (Factor IX)
"""
import logging
import psycopg2
from psycopg2 import pool
from contextlib import contextmanager
from config import DATABASE_URL, DB_POOL_MIN, DB_POOL_MAX

logger = logging.getLogger(__name__)

_pool = None


def get_pool():
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL is missing or empty. Check your environment variables.")
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=DB_POOL_MIN,
            maxconn=DB_POOL_MAX,
            dsn=DATABASE_URL,
            sslmode="require"
        )
        logger.info("Database connection pool created (min=%d, max=%d)", DB_POOL_MIN, DB_POOL_MAX)
    return _pool


def close_pool():
    """Close all connections in the pool. Called during graceful shutdown."""
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None
        logger.info("Database connection pool closed")


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