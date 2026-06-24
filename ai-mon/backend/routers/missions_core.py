"""데일리/위클리 미션 코어.

청크 1: import/런타임 에러 없는 **no-op 안전판 골격**만 제공한다.
정의 로딩(data/missions.json) · _ensure_period(lazy reset) · 진척 순회 같은 본체는
청크 2에서 구현한다. apply_xp(utils) 와 auth 로그인 핸들러가 bump_mission 을 호출하지만,
정의가 비어 있으면 아무것도 하지 않으므로 기존 동작에 영향이 없다.

[필수 — 청크 2~3] bump_mission 본체가 채워지면 미션 진척(login_days/claimed/progress
append)이 user 객체에 기록된다. append 류는 0-C delta-merge 경로에서 last-writer-wins 로
유실되므로, **미션을 쓰는 핸들러는 반드시 utils.mutate_user_atomic 경로를 통해 저장해야**
0-C의 리스트 머지 방어가 유지된다. (BACKEND_REVIEW_AND_MISSIONS.md C-1 deferred 참고)
"""

# 청크 2에서 data/missions.json 로딩 결과로 대체된다.
DAILY_DEFS: list = []
WEEKLY_DEFS: list = []


def find_def(mission_id: str):
    """mission_id 로 미션 정의를 찾는다. 청크 2 구현. 청크 1: 정의 없음 → None."""
    return None


def _ensure_period(user: dict) -> dict:
    """기간(데일리/위클리) lazy reset. 청크 2 구현.
    청크 1: user['missions'] 컨테이너 존재만 보장한다."""
    return user.setdefault("missions", {})


def bump_mission(user: dict, event: str, amount: int = 1, day_key: str = None) -> None:
    """학습 이벤트 발생 시 활성 미션 진척을 +amount 한다. (보상 지급은 claim 에서)

    청크 1: 미션 정의가 없으면 **no-op**. 청크 2에서 _ensure_period + 정의 순회로 본체 구현.
    호출부: apply_xp(utils) 의 event_type 분기, auth 로그인 출석(event='login', day_key=오늘).
    """
    if not DAILY_DEFS and not WEEKLY_DEFS:
        # 정의 없음 → 안전하게 아무것도 하지 않음 (import/runtime 에러 없이 동작)
        return
    # TODO(청크 2): _ensure_period(user) 후 데일리/위클리 정의를 순회하며 진척 갱신.
    return
