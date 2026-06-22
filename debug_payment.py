import httpx

with httpx.Client(base_url="http://localhost:8000/api/v1") as client:
    resp = client.post("/auth/login", data={"username": "FPT/CSC/25/0003", "password": "password"})
    token = resp.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Check dashboard
    dash = client.get("/allocation/dashboard", headers=headers)
    print("Dashboard status:", dash.status_code)
    
    # Check fee-summary
    fee = client.get("/application/fee-summary?fee_type=hostel", headers=headers)
    print("Fee summary status:", fee.status_code)
    if fee.status_code != 200:
        print(fee.text)
    
    # Check payment status
    pay = client.get("/payment/status?fee_type=hostel", headers=headers)
    print("Payment status status:", pay.status_code)
    if pay.status_code != 200:
        print(pay.text)
