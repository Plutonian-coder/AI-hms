import requests
import json
from config import GOOGLE_SCRIPT_URL

if not GOOGLE_SCRIPT_URL:
    print("No GOOGLE_SCRIPT_URL configured.")
    exit(1)

print(f"Testing URL: {GOOGLE_SCRIPT_URL}")

data = {
    "to": "yekeenkhalid363@gmail.com",
    "subject": "Direct Webhook Test",
    "html": "<h1>Test from Python</h1>",
    "senderName": "Test Sender"
}

print("Sending POST request...")
res = requests.post(GOOGLE_SCRIPT_URL, json=data, timeout=30)
print(f"Status Code: {res.status_code}")
print(f"Response Headers: {res.headers}")
print(f"Response Body (first 500 chars): {res.text[:500]}")

try:
    print(f"Parsed JSON: {res.json()}")
except Exception as e:
    print(f"Could not parse as JSON: {e}")
