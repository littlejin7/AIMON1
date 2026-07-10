import json
import re
import glob

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        return
        
    changed = False
    for q in data:
        if q.get('type') == 'code_multi_input':
            ans = q.get('answer', [])
            full_ans = ' '.join(ans)
            
            # fix execute_tool
            if '알 수 없는 도구' in full_ans:
                q['answer'] = ['return', "f'알 수 없는 도구: {tool_name}'"]
                q['code_template'] = q['code_template'].replace('{slot1} {slot2} {slot3} {slot4}', '{slot1} {slot2}')
                q['choices'] = ['return', "f'알 수 없는 도구: {tool_name}'", 'yield', "f'도구 실행 오류'"]
                changed = True
                
            # fix build_tool_result_message
            elif 'return' in ans and '{' in ans and len(ans) == 2:
                q['answer'] = ['return {']
                q['code_template'] = q['code_template'].replace('{slot1} {slot2}', '{slot1}')
                q['choices'] = ['return {', 'yield {', 'return [', 'dict(']
                changed = True

            # fix if hasattr(block, 'text')
            elif 'hasattr' in full_ans:
                q['answer'] = ["if hasattr(block, 'text'):", "return block.text"]
                q['code_template'] = q['code_template'].replace('{slot1} {slot2} {slot3} {slot4} {slot5}', '{slot1} {slot2}')
                q['choices'] = ["if hasattr(block, 'text'):", "return block.text", "if block.text:", "return block"]
                changed = True

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Fixed {filepath}")

for f in glob.glob('backend/data/**/*.json', recursive=True):
    fix_file(f)
