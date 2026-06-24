"""청크 2: 데일리 미션 MVP 단위 테스트.

- bump_mission 진척 누적 / 상한 클리핑
- d_login auto_claim (crowns 지급 + claimed 등록)
- d_login 하루 1회 dedup (day_key 기준)
- daily lazy reset (날짜 바뀌면 초기화)
- POST /missions/claim 멱등성 (두 번 claim → already_claimed)
- POST /missions/claim 진척 미달 → ValueError
"""

import sys
import os
import json
import pytest

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

import routers.missions_core as missions_core_mod
# missions.json 이 생성된 뒤 모듈이 import 됐는지 보장
if not missions_core_mod.DAILY_DEFS:
    missions_core_mod._load_defs()

from routers.missions_core import bump_mission, find_def, _ensure_period
from routers.utils import today_kst, iso_week

TODAY = today_kst()
WEEK = iso_week()


def _base_user(uid: str = "u-test") -> dict:
    return {"id": uid, "xp": 0, "lv": 1, "character": "slime", "titles": [], "crowns": 0}


# ─────────────────────────────── bump_mission 단위 ────────────────────────────

def test_d_quiz3_accumulates():
    u = _base_user()
    bump_mission(u, "stage_clear")
    assert u["missions"]["daily"]["progress"]["d_quiz3"] == 1
    bump_mission(u, "stage_clear")
    assert u["missions"]["daily"]["progress"]["d_quiz3"] == 2
    bump_mission(u, "stage_clear")
    assert u["missions"]["daily"]["progress"]["d_quiz3"] == 3


def test_d_quiz3_capped_at_goal():
    """goal(3) 초과 호출해도 progress 가 3 을 넘지 않아야 한다."""
    u = _base_user()
    for _ in range(6):
        bump_mission(u, "stage_clear")
    assert u["missions"]["daily"]["progress"]["d_quiz3"] == 3


def test_d_login_auto_claim():
    """로그인 이벤트 → progress 1 + d_login claimed + crowns += 1."""
    u = _base_user()
    bump_mission(u, "login", day_key=TODAY)
    d = u["missions"]["daily"]
    assert d["progress"].get("d_login", 0) == 1
    assert "d_login" in d.get("claimed", [])
    assert u["crowns"] == 1


def test_d_login_dedup_same_day():
    """같은 day_key 로 두 번 bump → 두 번째는 no-op (progress·crowns 증가 없음)."""
    u = _base_user()
    bump_mission(u, "login", day_key=TODAY)
    bump_mission(u, "login", day_key=TODAY)
    d = u["missions"]["daily"]
    assert d["progress"].get("d_login", 0) == 1  # 여전히 1
    assert u["crowns"] == 1                       # 이중 지급 없음


def test_d_review_accumulates():
    u = _base_user()
    bump_mission(u, "review_done")
    assert u["missions"]["daily"]["progress"].get("d_review", 0) == 1


def test_daily_lazy_reset():
    """어제 날짜 기록이 있으면 접근 시 자동 초기화되어야 한다."""
    u = _base_user()
    u["missions"] = {
        "daily": {"date": "2000-01-01", "progress": {"d_quiz3": 3}, "claimed": ["d_quiz3"]},
        "weekly": {"week": "2000-W01", "progress": {}, "claimed": [], "login_days": []},
    }
    bump_mission(u, "stage_clear")
    d = u["missions"]["daily"]
    assert d["date"] == TODAY           # 오늘 날짜로 갱신
    assert d["progress"]["d_quiz3"] == 1  # 리셋 후 새로 +1


def test_find_def_known():
    assert find_def("d_quiz3") is not None
    assert find_def("d_quiz3")["event"] == "stage_clear"
    assert find_def("d_login")["event"] == "login"
    assert find_def("d_review")["event"] == "review_done"


def test_find_def_unknown():
    assert find_def("nonexistent") is None


# ─────────────────────────── claim 멱등성 (mutate_user_atomic) ────────────────

def _make_claim_mutator(mission_id: str):
    """mission.py claim 핸들러의 mutator 로직을 테스트용으로 추출."""
    from routers.missions_core import find_def as _find, _ensure_period as _ep
    from routers.utils import today_kst as _t, iso_week as _w, apply_xp as _xp
    defn = _find(mission_id)

    def mutator(user: dict) -> dict:
        today = _t()
        week = _w()
        m = _ep(user, today, week)
        period_key = "weekly" if mission_id.startswith("w_") else "daily"
        p = m[period_key]
        if mission_id in p.get("claimed", []):
            return {"already_claimed": True, "xp": 0, "crowns": 0}
        if p.get("progress", {}).get(mission_id, 0) < defn["goal"]:
            raise ValueError("Mission not completed yet")
        p.setdefault("claimed", []).append(mission_id)
        reward = defn.get("reward", {})
        xp = reward.get("xp", 0)
        crowns = reward.get("crowns", 0)
        if xp:
            _xp(user, xp)
        if crowns:
            user["crowns"] = user.get("crowns", 0) + crowns
        return {"already_claimed": False, "xp": xp, "crowns": crowns}

    return mutator


def test_claim_idempotent(tmp_path, monkeypatch):
    """d_quiz3 claim 두 번 → 두 번째는 already_claimed, XP 이중 지급 없음."""
    import routers.utils as utils_mod

    users_file = tmp_path / "users.json"
    u = _base_user("u-claim")
    u["missions"] = {
        "daily": {"date": TODAY, "progress": {"d_quiz3": 3}, "claimed": []},
        "weekly": {"week": WEEK, "progress": {}, "claimed": [], "login_days": []},
    }
    users_file.write_text(json.dumps([u]), encoding="utf-8")
    monkeypatch.setattr(utils_mod, "USERS_FILE", str(users_file))
    monkeypatch.setattr(utils_mod, "USE_SUPABASE", False)

    _, r1 = utils_mod.mutate_user_atomic("u-claim", _make_claim_mutator("d_quiz3"))
    assert not r1["already_claimed"]
    assert r1["xp"] == 300

    _, r2 = utils_mod.mutate_user_atomic("u-claim", _make_claim_mutator("d_quiz3"))
    assert r2["already_claimed"]
    assert r2["xp"] == 0


def test_claim_incomplete_raises(tmp_path, monkeypatch):
    """진척 미달 상태에서 claim → ValueError."""
    import routers.utils as utils_mod

    users_file = tmp_path / "users.json"
    u = _base_user("u-incomplete")
    u["missions"] = {
        "daily": {"date": TODAY, "progress": {"d_quiz3": 1}, "claimed": []},
        "weekly": {"week": WEEK, "progress": {}, "claimed": [], "login_days": []},
    }
    users_file.write_text(json.dumps([u]), encoding="utf-8")
    monkeypatch.setattr(utils_mod, "USERS_FILE", str(users_file))
    monkeypatch.setattr(utils_mod, "USE_SUPABASE", False)

    with pytest.raises(ValueError, match="not completed"):
        utils_mod.mutate_user_atomic("u-incomplete", _make_claim_mutator("d_quiz3"))


def test_claim_d_review(tmp_path, monkeypatch):
    """d_review claim → xp 150 지급."""
    import routers.utils as utils_mod

    users_file = tmp_path / "users.json"
    u = _base_user("u-review")
    u["missions"] = {
        "daily": {"date": TODAY, "progress": {"d_review": 1}, "claimed": []},
        "weekly": {"week": WEEK, "progress": {}, "claimed": [], "login_days": []},
    }
    users_file.write_text(json.dumps([u]), encoding="utf-8")
    monkeypatch.setattr(utils_mod, "USERS_FILE", str(users_file))
    monkeypatch.setattr(utils_mod, "USE_SUPABASE", False)

    _, r = utils_mod.mutate_user_atomic("u-review", _make_claim_mutator("d_review"))
    assert not r["already_claimed"]
    assert r["xp"] == 150
