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

print("Sending POST request (allow_redirects=False)...")
res = requests.post(GOOGLE_SCRIPT_URL, json=data, timeout=30, allow_redirects=False)
print(f"Status Code: {res.status_code}")

# Handle redirect — re-POST to Location (same as the fixed _send() logic)
if res.status_code in (301, 302, 303, 307, 308):
    location = res.headers.get("Location")
    print(f"Redirect detected -> re-POSTing to: {location}")
    res = requests.post(location, json=data, timeout=30, allow_redirects=False)
    print(f"Final Status Code: {res.status_code}")

print(f"Response Body (first 500 chars): {res.text[:500]}")

try:
    parsed = res.json()
    print(f"Parsed JSON: {parsed}")
    if parsed.get("status") == "success":
        print("✅ Email sent successfully via GAS!")
    else:
        print(f"❌ GAS returned error: {parsed.get('message')}")
except Exception as e:
    print(f"Could not parse as JSON: {e}")
