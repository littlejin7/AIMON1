import hashlib

words = ["password", "1234", "123456", "tester", "tester_beg", "aimon", "admin", "1"]
target = "937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244"
for w in words:
    h = hashlib.sha256(w.encode()).hexdigest()
    if h == target:
        print(f"Match found: {w}")
        break
else:
    print("No match")
