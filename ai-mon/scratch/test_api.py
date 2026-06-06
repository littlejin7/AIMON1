import requests

res = requests.get("http://localhost:8000/quiz/units/1")
print("Status:", res.status_code)
print("JSON:", res.json())
