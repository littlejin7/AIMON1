import json
import re

with open(r"c:\AIMON\AIMON1\ai-mon\scratch\split_blocks_results.json", "r", encoding="utf-8") as f:
    data = json.load(f)

headers = ["출력", "출력 목표", "조건", "예시", "출력예시", "출력 예시", "목표", "예", "출력값", "결과", "위 코드는", "출력:", "조건:", "예시:", "출력 목표:", "목표:"]
header_res = [re.compile(rf"^\s*{h}\s*:?", re.I) for h in headers]

def split_after_text(after_text):
    lines = after_text.split("\n")
    code_lines = []
    desc_lines = []
    in_desc = False
    
    for line in lines:
        stripped = line.strip()
        if in_desc:
            desc_lines.append(line)
            continue
            
        # Check if line matches any header
        is_header = False
        for r in header_res:
            if r.match(stripped):
                is_header = True
                break
                
        # Also check if it's Korean text indicating description
        # e.g., containing Korean character and not starting with a common code symbol or containing quotes.
        # But to be simple and safe, let's see:
        if is_header or (any(ord('가') <= ord(c) <= ord('힣') for c in stripped) and not ("'" in stripped or '"' in stripped)):
            in_desc = True
            desc_lines.append(line)
        else:
            code_lines.append(line)
            
    return "\n".join(code_lines).rstrip(), "\n".join(desc_lines).strip()

results = []
for item in data:
    text = item["text"]
    
    # 1. Split intro text (before first ```)
    first_idx = text.find("```")
    if first_idx == -1:
        continue
    intro = text[:first_idx].strip()
    
    # 2. Extract middle text (between first ``` and last ```)
    # Find last ```
    last_idx = text.rfind("```")
    if last_idx == first_idx:
        # Only one ```? That shouldn't happen since count >= 4
        continue
        
    middle_with_fences = text[first_idx:last_idx+3]
    # Remove all fence marks from middle_with_fences
    # E.g., replace ```python or ``` with empty string
    middle_clean = re.sub(r"```(python)?\n?", "", middle_with_fences, flags=re.I).strip()
    
    # 3. Parse after text
    after = text[last_idx+3:]
    after_code, after_desc = split_after_text(after)
    
    # Unify code parts
    full_code = middle_clean
    if after_code:
        full_code = full_code + "\n" + after_code
        
    full_code = full_code.strip()
    
    # Reconstruct question
    reconstructed = intro + "\n\n```python\n" + full_code + "\n```"
    if after_desc:
        reconstructed = reconstructed + "\n\n" + after_desc
        
    results.append({
        "question_id": item["question_id"],
        "original": text,
        "reconstructed": reconstructed
    })

with open(r"c:\AIMON\AIMON1\ai-mon\scratch\parser_test_results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print("Parsed", len(results), "questions")
