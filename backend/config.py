import os
from dotenv import load_dotenv

load_dotenv()

# ── Database (Supabase Postgres via psycopg2 directly) ──────────────────────
DATABASE_HOST     = os.getenv("DATABASE_HOST", "")
DATABASE_PORT     = int(os.getenv("DATABASE_PORT", "5432"))
DATABASE_NAME     = os.getenv("DATABASE_NAME", "postgres")
DATABASE_USER     = os.getenv("DATABASE_USER", "")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD", "")

# ── Self-managed JWT (no external auth service needed) ───────────────────────
# Generate a strong secret:  python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET          = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM       = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_MINUTES  = int(os.getenv("JWT_EXPIRY_MINUTES", "1440"))  # 24 hours

# ── File Uploads & OCR ───────────────────────────────────────────────────────
UPLOAD_DIR     = os.getenv("UPLOAD_DIR", "./uploads")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ── CORS — comma-separated allowed origins ───────────────────────────────────
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]
