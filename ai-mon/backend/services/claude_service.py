import anthropic
import os

_client = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY", "")
        )
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

    client = get_client()
    try:
        message = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=512,
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

import json

async def ask_claude_json(prompt: str) -> dict:
    """
    JSON 형식을 반환해야 하는 채점용
    """
    client = get_client()
    try:
        message = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        text = message.content[0].text.strip()
        
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        return json.loads(text)
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
