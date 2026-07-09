import os
import json
import re
import random

random.seed(42)
data_dir = r"c:\AIMON\AIMON1\ai-mon\backend\data"

dists_pool = ["await", "async", "gather", "sleep", "def", "run", "tasks", "response", "get", "post", "return", "raise", "except", "try", "yield"]

def split_multi_input_answer(ans):
    parts = [p.strip() for p in ans.split() if p.strip()]
    if len(parts) > 5:
        new_parts = []
        for idx, val in enumerate(parts):
            if idx < 4:
                new_parts.append(val)
            else:
                new_parts[-1] = new_parts[-1] + " " + val
        parts = new_parts
    if len(parts) < 2:
        val = parts[0] if parts else ans
        return [val]
    return parts

def compress_code(code_str):
    lines = code_str.split('\n')
    if len(lines) <= 10:
        return code_str
    
    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if i + 1 < len(lines):
            next_line = lines[i+1]
            stripped_line = line.strip()
            stripped_next = next_line.strip()
            if (stripped_line.startswith('if ') or stripped_line.startswith('elif ') or stripped_line == 'else:') and \
               (stripped_next.startswith('return ') or stripped_next.startswith('raise ')):
                indent = len(line) - len(line.lstrip())
                new_lines.append(" " * indent + stripped_line + " " + stripped_next)
                i += 2
                continue
        new_lines.append(line)
        i += 1
    return "\n".join(new_lines)

def find_target_line(lines):
    for idx, line in enumerate(lines):
        if 'raise ValueError' in line:
            return idx
    for idx, line in enumerate(lines):
        if any(k in line for k in ['await', 'sleep', 'gather', 'create_task']):
            return idx
    for idx, line in enumerate(lines):
        if 'return' in line:
            return idx
    for idx in range(len(lines)-1, -1, -1):
        if lines[idx].strip():
            return idx
    return len(lines) - 1

def process_question(q):
    ans_str = q.get("answer", "")
    if not ans_str or not isinstance(ans_str, str):
        return False
        
    question_text = q.get("question", "")
    match = re.search(r'```(?:python)?\r?\n([\s\S]*?)```', question_text)
    code_block = match.group(1) if match else ""
    
    code_to_check = code_block if code_block else ans_str
    code_lines = [l.strip() for l in code_to_check.split('\n') if l.strip()]
    ans_lines = [l.strip() for l in ans_str.split('\n') if l.strip()]
    
    # Rule 1: code_input
    # - Short example code (within 3 lines)
    # - 1 single answer typed
    # - choices has exactly 3 options
    if len(code_lines) <= 3 and len(ans_lines) == 1:
        has_underscores = code_block and bool(re.search(r'_{3,}', code_block))
        if has_underscores:
            code_template = re.sub(r'_{3,}', "{slot1}", code_block)
        else:
            code_template = "{slot1}"
            
        q["type"] = "code_input"
        q["code_template"] = code_template
        q["answer"] = [ans_str.strip()]
        
        dists = [d for d in dists_pool if d != ans_str.strip()]
        choices = [ans_str.strip()] + dists[:2]
        random.shuffle(choices)
        q["choices"] = choices
        return True
        
    # Rule 2: code_multi_input
    # - Within 10 lines of code template
    # - One line is blanked out and split into <= 5 slots
    # - choices has exactly slots + 1 distractor
    else:
        compressed_ans = compress_code(ans_str)
        template_lines = compressed_ans.split('\n')
        
        target_idx = find_target_line(template_lines)
        target_line = template_lines[target_idx]
        
        indent = len(target_line) - len(target_line.lstrip())
        target_line_stripped = target_line.strip()
        
        slots = split_multi_input_answer(target_line_stripped)
        slots_placeholder = " " * indent + " ".join(f"{{slot{i+1}}}" for i in range(len(slots)))
        
        template_lines_mod = list(template_lines)
        template_lines_mod[target_idx] = slots_placeholder
        code_template = "\n".join(template_lines_mod)
        
        template_split = code_template.split('\n')
        if len(template_split) > 10:
            start_idx = max(0, target_idx - 4)
            end_idx = min(len(template_split), start_idx + 10)
            if end_idx - start_idx < 10:
                start_idx = max(0, end_idx - 10)
            code_template = "\n".join(template_split[start_idx:end_idx])
            
        dists = [d for d in dists_pool if d not in slots]
        choices = list(slots) + [dists[0] if dists else "return"]
        random.shuffle(choices)
        
        q["type"] = "code_multi_input"
        q["code_template"] = code_template
        q["answer"] = slots
        q["choices"] = choices
        return True

converted_count = 0

for root, dirs, files in os.walk(data_dir):
    for file in files:
        if file.endswith('.json') and not file.endswith('.lock') and 'backup' not in root:
            file_path = os.path.join(root, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                
                is_dict = isinstance(content, dict)
                questions = content["questions"] if is_dict else content
                
                code_inputs = [q for q in questions if q.get("type") == "code_input"]
                
                for q in code_inputs:
                    success = process_question(q)
                    if success:
                        converted_count += 1
                
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(content, f, indent=2, ensure_ascii=False)
                    
            except Exception as e:
                print(f"Error processing {file_path}: {e}")

print(f"Successfully converted {converted_count} code questions according to target line and format specification rules!")
