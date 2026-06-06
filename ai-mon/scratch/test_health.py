import requests

try:
    res = requests.get("http://localhost:8000/")
    print("Health Check Status:", res.status_code)
    print("Health Check Response:", res.json())
except Exception as e:
    print("Failed to connect:", e)
