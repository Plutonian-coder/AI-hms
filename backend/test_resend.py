import requests

RESEND_API_KEY = "re_XmLjGRkE_NCPH5BKRs4CFifxaXSVCWZc6"
to_email = "khalidyekini80@gmail.com"
sender_email = "khalidyekini80@gmail.com"

headers = {
    "Authorization": f"Bearer {RESEND_API_KEY}",
    "Content-Type": "application/json"
}
data = {
    "from": f"HMS <{sender_email}>",
    "to": [to_email],
    "subject": "Test from AI (Resend)",
    "html": "<p>This is a test email.</p>"
}

res = requests.post("https://api.resend.com/emails", headers=headers, json=data)
print("Status:", res.status_code)
print("Response:", res.text)
