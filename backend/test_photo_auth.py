from routers.auth import create_access_token
import requests

# For user 3
token = create_access_token({"sub": "F/ND/23/3210138", "role": "student", "user_id": 3})
print("Token generated.")

url_upload = "http://localhost:8000/api/v1/allocation/photo"
headers = {"Authorization": f"Bearer {token}"}
files = {'file': ('test.jpg', b'dummy content', 'image/jpeg')}

res = requests.post(url_upload, headers=headers, files=files)
print("Upload status:", res.status_code)
print("Upload response:", res.text)
