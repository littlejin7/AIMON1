import requests

# Login to get token
login_res = requests.post("http://localhost:8000/auth/login", json={"username": "tester_beg", "password": "test1234"})
token = login_res.json()["access_token"]
print("Token:", token[:15] + "...")

# Get boss info
headers = {"Authorization": f"Bearer {token}"}
res = requests.get("http://localhost:8000/boss/info?unit=1", headers=headers)
print("Status:", res.status_code)
try:
    print("JSON:", res.json())
except Exception as e:
    print("Text:", res.text)
