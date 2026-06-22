import requests

url = "http://localhost:8000/api/v1/allocation/photo"

# Since we don't have a token, it will probably throw 401 Unauthorized
# which confirms the route is hit. Let's see what happens.
try:
    response = requests.post(url, files={'file': ('test.txt', b'hello', 'image/jpeg')})
    print(response.status_code, response.text)
except Exception as e:
    print("Error:", e)
