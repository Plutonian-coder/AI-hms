import jwt
import requests
import time

jwt_secret = "hms-v2-kBx9Pq3mWBVcXcM4xTyl7aAe0hJdLf0R"
url = "https://jekpgzxzknojijfbuhbu.supabase.co"

payload = {
    "role": "service_role",
    "iss": "supabase",
    "iat": int(time.time()),
    "exp": int(time.time()) + 31536000,
}

token = jwt.encode(payload, jwt_secret, algorithm="HS256")

headers = {
    "apikey": token,
    "Authorization": f"Bearer {token}",
}

res = requests.get(f"{url}/storage/v1/bucket", headers=headers)
print("Status:", res.status_code)
print("Response:", res.text)
