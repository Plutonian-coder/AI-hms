import requests

BASE_URL = "http://localhost:8000"

def get_auth_token():
    # Attempt to login using a common test student or the John Doe from earlier
    res = requests.post(f"{BASE_URL}/auth/login", data={"username": "CSC/2026/001", "password": "password123"})
    if res.status_code == 200:
        return res.json()["access_token"]
    
    res = requests.post(f"{BASE_URL}/auth/login", data={"username": "khalid", "password": "password123"})
    if res.status_code == 200:
        return res.json()["access_token"]
        
    return None

token = get_auth_token()
if token:
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.get(f"{BASE_URL}/application/status", headers=headers)
    print("Status code:", res.status_code)
    print("Response:", res.text)
else:
    print("Failed to login.")
