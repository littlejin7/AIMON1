import google.generativeai as genai
import json
import os

_model = None


def get_model():
    global _model
    if _model is None:
        genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
        _model = genai.GenerativeModel("gemini-1.5-flash")
    return _model


async def ask_gemini(prompt: str) -> dict:
    """
    Send a prompt to Gemini and parse the JSON response.
    Returns a dict. Falls back to an error dict on failure.
    """
    model = get_model()

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        # Extract JSON block if wrapped in markdown
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "is_correct": False,
            "score": 0,
            "feedback": "AI 응답을 파싱할 수 없었습니다. 다시 시도해주세요.",
            "hint": "",
        }
    except Exception as e:
        return {
            "is_correct": False,
            "score": 0,
            "feedback": f"AI 서비스 오류: {str(e)}",
            "hint": "",
        }


async def ask_gemini_feedback(prompt: str, level: str = "beginner") -> dict:
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

    full_prompt = f"{system_prompt}\n\n{prompt}"
    
    model = get_model()
    try:
        response = model.generate_content(full_prompt)
        return {
            "success": True,
            "feedback": response.text.strip(),
        }
    except Exception as e:
        return {
            "success": False,
            "feedback": f"AI 피드백을 불러오지 못했습니다: {str(e)}",
        }
