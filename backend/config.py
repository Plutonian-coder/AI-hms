"""
HMS Configuration — 12-Factor Compliant.

All config is sourced from environment variables.
Required vars crash on boot if missing (fail-fast).
Optional vars have safe, non-secret defaults.
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv(override=True)


def _require(key: str) -> str:
    """Return env var value or crash immediately if missing."""
    val = os.getenv(key)
    if not val:
        print(f"FATAL: Missing required environment variable: {key}", file=sys.stderr)
        sys.exit(1)
    return val


# ── Required (crash on boot if missing) ─────────────────────────────────────
DATABASE_URL        = _require("DATABASE_URL")
JWT_SECRET          = _require("JWT_SECRET")
PAYSTACK_SECRET_KEY = _require("PAYSTACK_SECRET_KEY")
GEMINI_API_KEY      = _require("GEMINI_API_KEY")

# ── SMTP Email (Gmail) ──────────────────────────────────────────────────────
SMTP_EMAIL          = os.getenv("SMTP_EMAIL", "")
SMTP_APP_PASSWORD   = os.getenv("SMTP_APP_PASSWORD", "")

# ── Optional with safe defaults ─────────────────────────────────────────────
JWT_ALGORITHM       = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_MINUTES  = int(os.getenv("JWT_EXPIRY_MINUTES", "1440"))

PAYSTACK_PUBLIC_KEY   = os.getenv("PAYSTACK_PUBLIC_KEY", "")
PAYSTACK_CALLBACK_URL = os.getenv("PAYSTACK_CALLBACK_URL", "")
HOSTEL_FEE_AMOUNT     = int(os.getenv("HOSTEL_FEE_AMOUNT", "15000"))

UPLOAD_DIR          = os.getenv("UPLOAD_DIR", "/tmp/uploads")
GROQ_API_KEY        = os.getenv("GROQ_API_KEY", "")
OPENROUTER_API_KEY  = os.getenv("OPENROUTER_API_KEY", "")
HMS_APP_URL         = os.getenv("HMS_APP_URL", "http://localhost:5173")

DB_POOL_MIN         = int(os.getenv("DB_POOL_MIN", "1"))
DB_POOL_MAX         = int(os.getenv("DB_POOL_MAX", "3"))

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]