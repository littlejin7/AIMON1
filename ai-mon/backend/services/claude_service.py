import anthropic
import os
import json
import logging

logger = logging.getLogger(__name__)

_client = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        import httpx
        api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY", "")
        _client = anthropic.AsyncAnthropic(
            api_key=api_key,
            timeout=httpx.Timeout(10.0, connect=3.0)
        )
    return _client


async def ask_claude(prompt: str, level: str = "beginner") -> dict:
    """
    오답 피드백용: Claude에게 레벨별 설명을 요청합니다.
    level: beginner | intermediate | advanced
    """
    level_instructions = {
        "beginner": (
            "오답 이유 한 가지만 골라 2~3문장으로 설명하세요. "
            "비유나 일상 예시를 하나 써도 좋습니다. 전문 용어는 쓰지 마세요."
        ),
        "intermediate": (
            "핵심 개념과 짧은 코드 예시를 포함해 3~4문장으로 설명하세요. "
            "왜 틀렸는지 원인 한 줄, 올바른 개념 한 줄, 예시 한 줄 순서로 써주세요."
        ),
        "advanced": (
            "원리, 엣지 케이스, 더 나은 접근법을 4~5문장으로 설명하세요. "
            "단순 정답 확인보다 깊이 있는 이해를 돕는 방향으로 써주세요."
        ),
    }

    system_prompt = (
        "당신은 파이썬을 가르치는 AI 튜터 '에이몬'입니다. "
        "항상 한국어로 답변하고, 격려하는 톤을 유지하세요. "
        "지정된 문장 수를 반드시 지키고, 불필요한 서론/마무리 인사는 생략하세요. "
        + level_instructions.get(level, level_instructions["beginner"])
    )

    try:
        client = get_client()
        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
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

async def stream_claude(prompt: str, level: str = "beginner"):
    """
    스트리밍 피드백용: 텍스트 청크를 async generator로 yield.
    """
    level_instructions = {
        "beginner": (
            "오답 이유 한 가지만 골라 2~3문장으로 설명하세요. "
            "비유나 일상 예시를 하나 써도 좋습니다. 전문 용어는 쓰지 마세요."
        ),
        "intermediate": (
            "핵심 개념과 짧은 코드 예시를 포함해 3~4문장으로 설명하세요. "
            "왜 틀렸는지 원인 한 줄, 올바른 개념 한 줄, 예시 한 줄 순서로 써주세요."
        ),
        "advanced": (
            "원리, 엣지 케이스, 더 나은 접근법을 4~5문장으로 설명하세요. "
            "단순 정답 확인보다 깊이 있는 이해를 돕는 방향으로 써주세요."
        ),
    }

    system_prompt = (
        "당신은 파이썬을 가르치는 AI 튜터 '에이몬'입니다. "
        "항상 한국어로 답변하고, 격려하는 톤을 유지하세요. "
        "지정된 문장 수를 반드시 지키고, 불필요한 서론/마무리 인사는 생략하세요. "
        + level_instructions.get(level, level_instructions["beginner"])
    )

    try:
        client = get_client()
        async with client.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                yield text
    except Exception as e:
        yield f"[AI 피드백 오류: {str(e)}]"


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
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        text = message.content[0].text.strip()
        parsed_json_str = extract_json(text)
        data = json.loads(parsed_json_str)
        if isinstance(data, dict):
            data["grading_failed"] = False
            return data
        else:
            raise json.JSONDecodeError("Parsed JSON is not a dictionary", text, 0)
    except json.JSONDecodeError:
        logger.exception("ask_claude_json: AI 응답 JSON 파싱 실패")
        return {
            "is_correct": False,
            "score": 0,
            "feedback": "AI 응답을 파싱할 수 없었습니다. 패널티 없이 다시 제출할 수 있습니다.",
            "hint": "",
            "grading_failed": True,
        }
    except Exception:
        logger.exception("ask_claude_json: AI 서비스 오류")
        return {
            "is_correct": False,
            "score": 0,
            "feedback": "AI 서비스에 일시적인 오류가 발생했습니다. 패널티 없이 다시 제출할 수 있습니다.",
            "hint": "",
            "grading_failed": True,
        }

