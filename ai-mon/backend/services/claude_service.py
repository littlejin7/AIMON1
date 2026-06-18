import anthropic
import os
import json

_client = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY", "")
        _client = anthropic.AsyncAnthropic(api_key=api_key)
    return _client


async def ask_claude(prompt: str, level: str = "beginner") -> dict:
    """
    오답 피드백용: Claude에게 레벨별 설명을 요청합니다.
    level: beginner | intermediate | advanced
    """
    level_instructions = {
        "beginner": "비유와 일상 예시를 들어 왜 틀렸는지 쉽게 설명해주세요. 전문 용어는 최소화하세요.",
        "intermediate": "핵심 개념과 코드 예시를 포함해 오류 원인을 분석해주세요.",
        "advanced": "원리와 엣지 케이스, 최적 해법까지 포함해 깊이 있게 설명해주세요.",
    }

    system_prompt = (
        "당신은 파이썬을 처음 배우는 학생들을 가르치는 친절한 AI 튜터 '에이몬'입니다. "
        "항상 한국어로 답변하고, 학생이 낙담하지 않도록 격려하는 톤을 유지하세요. "
        + level_instructions.get(level, level_instructions["beginner"])
    )

    try:
        client = get_client()
        message = await client.messages.create(
            model="claude-3-5-haiku-latest",
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}],
        )
        return {
            "success": True,
            "feedback": message.content[0].text,
        }
    except Exception as e:
        return {
            "success": False,
            "feedback": f"AI 피드백을 불러오지 못했습니다: {str(e)}",
        }

def extract_json(text: str) -> str:
    text_clean = text.strip()
    
    # 1. Try to extract from ```json ... ```
    if "```json" in text_clean:
        try:
            parts = text_clean.split("```json")
            for part in parts[1:]:
                candidate = part.split("```")[0].strip()
                if "{" in candidate and "}" in candidate:
                    sub_candidate = candidate[candidate.find("{"):candidate.rfind("}")+1]
                    json.loads(sub_candidate)
                    return sub_candidate
        except Exception:
            pass

    # 2. Try to extract from ``` ... ```
    if "```" in text_clean:
        try:
            parts = text_clean.split("```")
            for i in range(1, len(parts), 2):
                candidate = parts[i].strip()
                if "{" in candidate and "}" in candidate:
                    sub_candidate = candidate[candidate.find("{"):candidate.rfind("}")+1]
                    json.loads(sub_candidate)
                    return sub_candidate
        except Exception:
            pass

    # 3. Try to extract using the outermost braces
    first_brace = text_clean.find("{")
    last_brace = text_clean.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        candidate = text_clean[first_brace:last_brace + 1]
        try:
            json.loads(candidate)
            return candidate
        except Exception:
            pass

    # 4. Scanning fallback for nested braces/junk text
    try:
        idx = 0
        while True:
            first_brace = text_clean.find("{", idx)
            if first_brace == -1:
                break
            last_brace = text_clean.rfind("}")
            while last_brace != -1 and last_brace > first_brace:
                candidate = text_clean[first_brace:last_brace + 1]
                try:
                    json.loads(candidate)
                    return candidate
                except Exception:
                    pass
                last_brace = text_clean.rfind("}", first_brace, last_brace)
            idx = first_brace + 1
    except Exception:
        pass

    return text_clean


async def ask_claude_json(prompt: str) -> dict:
    """
    JSON 형식을 반환해야 하는 채점용
    """
    try:
        client = get_client()
        message = await client.messages.create(
            model="claude-3-5-haiku-latest",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        text = message.content[0].text.strip()
        parsed_json_str = extract_json(text)
        return json.loads(parsed_json_str)
    except json.JSONDecodeError:
        return {
            "is_correct": False,
            "score": 0,
            "feedback": "AI 응답을 파싱할 수 없었습니다.",
            "hint": "",
        }
    except Exception as e:
        return {
            "is_correct": False,
            "score": 0,
            "feedback": f"AI 서비스 오류: {str(e)}",
            "hint": "",
        }

