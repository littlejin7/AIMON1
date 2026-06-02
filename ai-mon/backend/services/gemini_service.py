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
