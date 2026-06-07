import requests

url = "https://script.google.com/macros/s/AKfycbzoeLUwiJVzC8xaNcIuld0OZ4SahO7st6uaAvSLbmKa7E3ERWI5bz6OU4LOMgjye_Tg/exec"

data = {
    "to": "khalidyekini80@gmail.com",
    "subject": "HMS Google Script Test",
    "html": "<h3>Success!</h3><p>Your Google Apps Script webhook is working perfectly.</p>",
    "senderName": "HMS System Admin"
}

res = requests.post(url, json=data)
print("Status Code:", res.status_code)
print("Response Body:", res.text)
