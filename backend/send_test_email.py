import os
import sys

# Add the backend directory to sys.path so we can import services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.email import send_registration_email

to_email = "yekeenkhalid363@gmail.com"
result = send_registration_email(
    to_email=to_email,
    first_name="Khalid",
    matric_number="FPT/CSC/25/0010"
)

print("Email send result:", result)
