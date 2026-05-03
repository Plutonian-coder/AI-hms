from services.email import send_registration_email

# Replace this with the exact email you used to register on Resend!
TEST_STUDENT_EMAIL = "YOUR_RESEND_EMAIL@example.com" 

print(f"Testing Resend email delivery to: {TEST_STUDENT_EMAIL}")

response = send_registration_email(
    to_email=TEST_STUDENT_EMAIL,
    first_name="Test Student",
    matric_number="FPT/CSC/25/TEST"
)

print("Email sent successfully! Response ID:", response.get('id'))