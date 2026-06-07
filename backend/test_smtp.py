import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_EMAIL = "khalidyekini80@gmail.com"
SMTP_APP_PASSWORD = "zqxmktcegevgjllh"
to_email = "khalidyekini80@gmail.com"

msg = MIMEMultipart("alternative")
msg["Subject"] = "Test from AI"
msg["From"] = f"HMS <{SMTP_EMAIL}>"
msg["To"] = to_email

msg.attach(MIMEText("This is a test email.", "plain"))

context = ssl.create_default_context()
try:
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
        server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
        server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
    print("Sent successfully via 465")
except Exception as e:
    print("465 failed:", e)
