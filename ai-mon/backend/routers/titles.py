from fastapi import APIRouter

router = APIRouter()

TITLE_DEFINITIONS = {
    "first_step":   "🌱 첫 발걸음",
    "streak_7":     "🔥 연속학습자",
    "boss_slayer":  "⚔️ 보스슬레이어",
    "ai_explorer":  "🧠 AI 탐구자",
    "unit_master":  "👑 유닛 마스터",
    "aimon_master": "💎 에이몬 마스터",
}

def check_and_award_titles(user: dict, context: dict) -> list[dict]:
    earned = set(user.get("titles", []))
    newly = []

    def award(title_id):
        if title_id not in earned:
            earned.add(title_id)
            newly.append({"id": title_id, "name": TITLE_DEFINITIONS[title_id]})

    if context.get("stage_completed"):
        award("first_step")
    if user.get("streak", 0) >= 7:
        award("streak_7")
    if context.get("boss_cleared"):
        award("boss_slayer")
    if user.get("ai_feedback_count", 0) >= 10:
        award("ai_explorer")
    if context.get("unit_fully_done"):
        award("unit_master")
    if user.get("lv", 1) >= 30:
        award("aimon_master")

    user["titles"] = list(earned)
    return newly
