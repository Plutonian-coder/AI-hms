"""
Create Admin Account — One-off admin task (Factor XII).

Usage:
  python scripts/create_admin.py
  docker compose exec backend python scripts/create_admin.py

Uses self-managed auth (bcrypt). No external auth dependency.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import logging
from logging_config import setup_logging
setup_logging()

from passlib.hash import bcrypt
from database import get_cursor

logger = logging.getLogger(__name__)

ADMIN_IDENTIFIER = os.getenv("ADMIN_IDENTIFIER", "ADMIN001")
ADMIN_PASSWORD   = os.getenv("ADMIN_PASSWORD", "Admin@2026")
ADMIN_SURNAME    = os.getenv("ADMIN_SURNAME", "System")
ADMIN_FIRST_NAME = os.getenv("ADMIN_FIRST_NAME", "Administrator")
ADMIN_GENDER     = os.getenv("ADMIN_GENDER", "male")


def create_admin():
    password_hash = bcrypt.hash(ADMIN_PASSWORD)
    logger.info("Creating admin: %s", ADMIN_IDENTIFIER)

    with get_cursor() as cur:
        cur.execute("SELECT id FROM users WHERE identifier = %s", (ADMIN_IDENTIFIER,))
        row = cur.fetchone()
        if row:
            cur.execute(
                "UPDATE users SET role = 'admin', password_hash = %s WHERE identifier = %s",
                (password_hash, ADMIN_IDENTIFIER),
            )
            logger.info("Updated existing user to admin (id=%d)", row[0])
        else:
            cur.execute(
                """INSERT INTO users (identifier, surname, first_name, gender, password_hash, role)
                   VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
                (ADMIN_IDENTIFIER, ADMIN_SURNAME, ADMIN_FIRST_NAME, ADMIN_GENDER, password_hash, "admin"),
            )
            user_id = cur.fetchone()[0]
            logger.info("Created admin in DB (id=%d)", user_id)

    logger.info("Admin ready — ID: %s", ADMIN_IDENTIFIER)


if __name__ == "__main__":
    create_admin()
