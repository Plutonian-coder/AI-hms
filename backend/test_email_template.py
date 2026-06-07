from services.email import send_registration_email
import asyncio
from unittest.mock import patch
from config import GOOGLE_SCRIPT_URL

# Just in case we need async run context, but email module is synchronous
print("Sending test email to khalidyekini80@gmail.com...")
result = send_registration_email(
    to_email="khalidyekini80@gmail.com",
    first_name="Khalid",
    matric_number="CSC/2026/001"
)
print("Result:", result)
