import requests
import json

res = requests.get("http://localhost:8000/openapi.json")
openapi = res.json()
paths = list(openapi.get("paths", {}).keys())
print("Paths in running server:")
for p in sorted(paths):
    print("  ", p)
