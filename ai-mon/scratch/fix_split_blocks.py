import os
import json
import re

data_dirs = [
    r"c:\AIMON\AIMON1\ai-mon\backend\data\miniboss",
    r"c:\AIMON\AIMON1\ai-mon\backend\data\quiz"
]

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
            
        is_header = False
        for r in header_res:
            if r.match(stripped):
                is_header = True
                break
                
        if is_header or (any(ord('가') <= ord(c) <= ord('힣') for c in stripped) and not ("'" in stripped or '"' in stripped)):
            in_desc = True
            desc_lines.append(line)
        else:
            code_lines.append(line)
            
    return "\n".join(code_lines).rstrip(), "\n".join(desc_lines).strip()

def fix_question_text(text):
    first_idx = text.find("```")
    if first_idx == -1:
        return text
        
    last_idx = text.rfind("```")
    if last_idx == first_idx:
        return text
        
    intro = text[:first_idx].strip()
    
    middle_with_fences = text[first_idx:last_idx+3]
    middle_clean = re.sub(r"```(python)?\n?", "", middle_with_fences, flags=re.I).strip()
    
    after = text[last_idx+3:]
    after_code, after_desc = split_after_text(after)
    
    full_code = middle_clean
    if after_code:
        full_code = full_code + "\n" + after_code
    full_code = full_code.strip()
    
    reconstructed = intro + "\n\n```python\n" + full_code + "\n```"
    if after_desc:
        reconstructed = reconstructed + "\n\n" + after_desc
        
    return reconstructed

fixed_files_count = 0
fixed_questions_count = 0
base_dir = r"c:\AIMON\AIMON1\ai-mon"

for data_dir in data_dirs:
    for root, dirs, files in os.walk(data_dir):
        for file in files:
            if file.endswith(".json") and not file.endswith("_lock"):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = json.load(f)
                        
                    is_modified = False
                    
                    if isinstance(content, list):
                        for item in content:
                            if isinstance(item, dict) and "question" in item:
                                q_text = item["question"]
                                if isinstance(q_text, str) and q_text.count("```") >= 4:
                                    fixed = fix_question_text(q_text)
                                    if fixed != q_text:
                                        item["question"] = fixed
                                        is_modified = True
                                        fixed_questions_count += 1
                    elif isinstance(content, dict):
                        if "questions" in content and isinstance(content["questions"], list):
                            for item in content["questions"]:
                                if isinstance(item, dict) and "question" in item:
                                    q_text = item["question"]
                                    if isinstance(q_text, str) and q_text.count("```") >= 4:
                                        fixed = fix_question_text(q_text)
                                        if fixed != q_text:
                                            item["question"] = fixed
                                            is_modified = True
                                            fixed_questions_count += 1
                        else:
                            if "question" in content:
                                q_text = content["question"]
                                if isinstance(q_text, str) and q_text.count("```") >= 4:
                                    fixed = fix_question_text(q_text)
                                    if fixed != q_text:
                                        content["question"] = fixed
                                        is_modified = True
                                        fixed_questions_count += 1
                                        
                    if is_modified:
                        with open(filepath, "w", encoding="utf-8") as f:
                            json.dump(content, f, ensure_ascii=False, indent=2)
                        fixed_files_count += 1
                        rel_path = os.path.relpath(filepath, base_dir)
                        print("Fixed file: " + rel_path)
                except Exception as e:
                    print("Error processing " + file + ": " + str(e))

print("Finished. Fixed " + str(fixed_questions_count) + " questions in " + str(fixed_files_count) + " files.")
