import sys
sys.path.append('c:/AIMON1/ai-mon/backend')
from main import app

for route in app.routes:
    print(f"Path: {route.path}, Name: {route.name}, Methods: {route.methods}")
