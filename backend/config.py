import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Database connection parameters (individual fields to avoid URL-encoding issues)
DATABASE_HOST = os.getenv("DATABASE_HOST", "")
DATABASE_PORT = int(os.getenv("DATABASE_PORT", "5432"))
DATABASE_NAME = os.getenv("DATABASE_NAME", "postgres")
DATABASE_USER = os.getenv("DATABASE_USER", "")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD", "")

# JWT overrides
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_MINUTES = int(os.getenv("JWT_EXPIRY_MINUTES", "1440"))

# Uploads & OCR
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Supabase API (read from environment — NEVER hardcode)
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# CORS — comma-separated allowed origins
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

# Init global client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
