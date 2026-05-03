import os
from dotenv import load_dotenv

load_dotenv()

# Use single DATABASE_URL
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Keep these for other parts of your app
JWT_SECRET         = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM      = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_MINUTES = int(os.getenv("JWT_EXPIRY_MINUTES", "1440"))

UPLOAD_DIR   = os.getenv("UPLOAD_DIR", "./uploads")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

PAYSTACK_SECRET_KEY   = os.getenv("PAYSTACK_SECRET_KEY", "")
PAYSTACK_PUBLIC_KEY   = os.getenv("PAYSTACK_PUBLIC_KEY", "")
HOSTEL_FEE_AMOUNT     = int(os.getenv("HOSTEL_FEE_AMOUNT", "15000"))
PAYSTACK_CALLBACK_URL = os.getenv("PAYSTACK_CALLBACK_URL", "")

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]