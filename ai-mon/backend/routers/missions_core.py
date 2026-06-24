"""데일리/위클리 미션 코어.

청크 2: data/missions.json 로딩 + _ensure_period(lazy reset) + bump_mission 정의 순회.
청크 1의 no-op 골격을 실제 구현으로 대체.

[필수] bump_mission 은 user 객체를 '그 자리에서만' 변경한다.
저장은 반드시 호출부의 mutate_user_atomic 에서 처리. (BACKEND_REVIEW_AND_MISSIONS.md C-1)
순환 참조 방지: utils 임포트는 bump_mission 본체 안에서 lazy 임포트.
"""

import json
import os

MISSIONS_FILE = os.path.join(os.path.dirname(__file__), "../data/missions.json")

DAILY_DEFS: list = []
WEEKLY_DEFS: list = []


def _load_defs() -> None:
    global DAILY_DEFS, WEEKLY_DEFS
    try:
        with open(MISSIONS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        DAILY_DEFS = data.get("daily", [])
        WEEKLY_DEFS = data.get("weekly", [])
    except Exception:
        pass  # 파일 없거나 파싱 오류 → no-op 안전판 유지


_load_defs()


def find_def(mission_id: str) -> dict | None:
    """mission_id 로 미션 정의를 찾는다. 없으면 None."""
    for d in DAILY_DEFS + WEEKLY_DEFS:
        if d["mission_id"] == mission_id:
            return d
    return None


def _ensure_period(user: dict, today: str, week_key: str) -> dict:
    """데일리·위클리 기간 lazy reset.

    접근 시 KST 날짜/ISO주차를 비교해 기간이 바뀌었으면 진척·claimed·login_days 초기화.
    스케줄러 의존 없이 자정 기준 자동 전환.
    """
    m = user.setdefault("missions", {})

    d = m.setdefault("daily", {})
    if d.get("date") != today:
        d.clear()
        d["date"] = today
        d["progress"] = {}
        d["claimed"] = []

    w = m.setdefault("weekly", {})
    if w.get("week") != week_key:
        w.clear()
        w["week"] = week_key
        w["progress"] = {}
        w["claimed"] = []
        w["login_days"] = []

    return m


def bump_mission(user: dict, event: str, amount: int = 1, day_key: str = None) -> None:
    """학습 이벤트 발생 시 활성 미션 진척을 +amount 한다. (보상 지급은 claim 에서)

    호출부 책임:
    - 반드시 mutate_user_atomic 의 mutator 안(또는 동일 저장 경로)에서 호출할 것.
      login_days/claimed 같은 리스트 append 가 last-writer-wins 가 되지 않으려면
      원자 쓰기 경로가 필수다. (BACKEND_REVIEW_AND_MISSIONS.md C-1 deferred)
    - apply_xp 에서 event_type 없이 호출되는 경우 재진입하지 않음.

    auto_claim 미션(d_login): goal 도달 즉시 claimed 에 추가하고 보상을 직접 반영.
    apply_xp 를 재호출하지 않고 crowns 를 직접 증가해 순환 재귀를 방지.
    """
    if not DAILY_DEFS and not WEEKLY_DEFS:
        return

    # utils 임포트를 함수 안으로 → 모듈 로드 시 순환 임포트 방지
    from routers.utils import today_kst as _today, iso_week as _week
    today = _today()
    week = _week()
    m = _ensure_period(user, today, week)
    d = m["daily"]

    for defn in DAILY_DEFS:
        if defn["event"] != event:
            continue
        mid = defn["mission_id"]

        # login 이벤트: day_key 집합으로 하루 1회만 카운트 (중복 방지)
        if event == "login" and day_key is not None:
            login_days = d.setdefault("login_days", [])
            if day_key in login_days:
                continue
            login_days.append(day_key)

        prog = d.setdefault("progress", {})
        goal = defn["goal"]
        prog[mid] = min(prog.get(mid, 0) + amount, goal)

        # auto_claim: goal 도달 즉시 무마찰 수령
        if defn.get("auto_claim") and prog[mid] >= goal:
            claimed = d.setdefault("claimed", [])
            if mid not in claimed:
                claimed.append(mid)
                reward = defn.get("reward", {})
                if reward.get("crowns"):
                    user["crowns"] = user.get("crowns", 0) + reward["crowns"]
                # XP auto_claim 은 apply_xp 재귀를 유발하므로 지원하지 않음.
                # auto_claim 미션에 XP 보상이 필요한 경우 수동 claim 사용.
