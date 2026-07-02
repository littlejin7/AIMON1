"""유닛보스 진입 비용(기회/왕관) 회귀 테스트.

버그 리포트 검증용: "무료 도전 2회 소진 후, 왕관 201개 보유 중인데도 진입 불가" 라는
증상이 현재 코드(feature/supabase-migration)에서 실제로 재현되는지 확정한다.

진입 규칙 (boss.py: start_boss_battle):
  daily_free_attempts > 0  → 무료 1회 차감, 진입
  daily_free_attempts == 0 → crowns > 0 이면 왕관 1 차감 후 진입,
                              crowns <= 0 이면 400 "왕관이 부족합니다."

핵심 검증:
  T1. 무료 0 + 왕관 201 → 정상 진입(예외 없음) + 왕관 200 으로 차감
  T2. 무료 0 + 왕관 0   → 400 (이 조건에서만 차단)

주의: last_free_attempt_date 를 오늘(KST)로 세팅해 일일 리셋이
daily_free_attempts 를 2 로 되돌리지 못하게 한다.
"""
import sys
import os
import json

import pytest
from fastapi import HTTPException

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

from routers import utils as U
from routers import boss as B


def _today_kst() -> str:
    return U.now_kst().strftime("%Y-%m-%d")


def _read_user(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)[0]


@pytest.fixture
def user_factory(monkeypatch, tmp_path):
    """USERS_FILE 을 임시 경로로 리디렉트하고, 주어진 필드로 유저 1명을 만든다.
    반환값: (user_dict, users_file_path) — user_dict 를 핸들러에 그대로 넘긴다.

    진입 게이트(assert_boss_access)는 이 테스트의 관심사(진입 비용)와 직교하므로,
    기본 유저는 레벨테스트 완료 + 전 유닛 해금 상태로 두고, unit1 전 스테이지(1-1..1-7)
    완료를 PROGRESS_FILE 에 시드해 게이트를 통과시킨다."""
    uf = tmp_path / "users.json"
    pf = tmp_path / "progress.json"
    monkeypatch.setattr(U, "USERS_FILE", str(uf))
    monkeypatch.setattr(U, "PROGRESS_FILE", str(pf))
    monkeypatch.setattr(U, "USE_SUPABASE", False)

    # unit1(7스테이지) 전 스테이지 완료 시드 → assert_boss_access 의 진행도 조건 충족
    pf.write_text(json.dumps([
        {"user_id": "u1", "unit": 1, "stage": f"1-{i}",
         "is_completed": True, "course_level": "beginner"}
        for i in range(1, 8)
    ]), encoding="utf-8")

    def _make(**fields) -> dict:
        user = {
            "id": "u1",
            "xp": 0,
            "lv": 1,
            "crowns": 0,
            "daily_free_attempts": 0,
            "last_free_attempt_date": _today_kst(),  # 일일 리셋 회피
            "course_level": "beginner",
            "character": "slime",
            "titles": [],
            "seen_questions": {},
            "is_level_tested": True,                 # 진입 게이트 통과용
            "max_unlocked_unit": {"beginner": 99},   # 전 유닛 해금
        }
        user.update(fields)
        uf.write_text(json.dumps([user]), encoding="utf-8")
        return user

    return _make, str(uf)


# ── T1: 무료 0 + 왕관 201 → 정상 진입 + 왕관 차감 ───────────────────
def test_entry_with_crowns_when_free_exhausted(user_factory):
    make, uf = user_factory
    user = make(daily_free_attempts=0, crowns=201)

    # 예외 없이 문제 1개를 반환해야 한다 (진입 성공)
    # 응답 형식: {question, battle_token} (배틀세션 토큰 도입). question 에 정답은 없다(F).
    res = B.start_boss_battle(unit="1", user=user)
    assert res is not None and res.get("battle_token")
    chosen = res["question"]
    assert chosen.get("question_id")

    # 왕관 1개 차감 → 200
    saved = _read_user(uf)
    assert saved["crowns"] == 200, f"왕관이 차감되지 않거나 잘못 차감됨: {saved['crowns']}"
    assert saved["daily_free_attempts"] == 0, "무료 횟수는 그대로여야 함(왕관으로 진입)"


# ── T2: 무료 0 + 왕관 0 → 400 (이 조건에서만 차단) ─────────────────
def test_blocked_only_when_no_free_and_no_crowns(user_factory):
    make, uf = user_factory
    user = make(daily_free_attempts=0, crowns=0)

    with pytest.raises(HTTPException) as exc:
        B.start_boss_battle(unit="1", user=user)
    assert exc.value.status_code == 400
    assert "왕관" in exc.value.detail

    # 차단됐으므로 왕관/무료 모두 변동 없음
    saved = _read_user(uf)
    assert saved["crowns"] == 0
    assert saved["daily_free_attempts"] == 0
