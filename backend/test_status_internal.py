from fastapi.testclient import TestClient
from main import app
from routers.dependencies import get_current_student

def override_get_current_student():
    return {"user_id": 1, "matric_number": "CSC/2026/001", "role": "student"}

app.dependency_overrides[get_current_student] = override_get_current_student

client = TestClient(app)
response = client.get("/application/status")
print("Status Code:", response.status_code)
print("Response JSON:", response.json())

response2 = client.get("/allocation/hostels")
print("Hostels Code:", response2.status_code)
print("Hostels JSON:", response2.json())

response3 = client.get("/allocation/dashboard")
print("Dash Code:", response3.status_code)
print("Dash JSON:", response3.json())
