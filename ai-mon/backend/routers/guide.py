import os
import re
from fastapi import APIRouter

router = APIRouter()

_CONTEXT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "guide_context.md")

# guide_context.md 의 "- Q: ...\n  A: ..." 형식 FAQ 항목을 파싱하는 패턴
_FAQ_PATTERN = re.compile(r"^- Q:\s*(.+?)\s*$\n^[ \t]*A:\s*(.+?)\s*$", re.MULTILINE)


def _load_guide_context() -> str:
    """홈 화면 안내봇 컨텍스트를 매 요청마다 새로 읽는다.
    (guide_context.md 를 고치면 서버 재시작 없이 바로 반영됨)"""
    try:
        with open(_CONTEXT_PATH, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return "(서비스 설명이 아직 준비되지 않았습니다.)"


def _parse_faq_list(context: str) -> list[dict]:
    return [
        {"question": q.strip(), "answer": a.strip()}
        for q, a in _FAQ_PATTERN.findall(context)
    ]


@router.get("/faq")
def guide_faq():
    """선택형 버튼용 FAQ 목록. Claude를 호출하지 않으므로 비용이 들지 않는다."""
    context = _load_guide_context()
    return {"items": _parse_faq_list(context)}
