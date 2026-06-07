import requests
from database import get_connection
import sys
import os

# Add backend dir to sys.path properly
backend_dir = r"c:\Users\HomePC\.gemini\antigravity\scratch\AI-hms\backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from services.auth import create_access_token
from datetime import timedelta

with get_connection() as conn:
    cur = conn.cursor()
    cur.execute("SELECT identifier FROM users WHERE role='admin' LIMIT 1")
    admin_id = cur.fetchone()[0]

token = create_access_token({'sub': admin_id, 'role': 'admin'}, timedelta(minutes=10))

for idx in [19, 21]:
    res = requests.get(f'http://127.0.0.1:8000/api/v1/admin/medical-doc/{idx}', headers={'Authorization': 'Bearer ' + token})
    print(f"Status for {idx}:", res.status_code)
    print("Headers:", res.headers)
    if res.status_code != 200:
        print("Body:", res.text[:200])
