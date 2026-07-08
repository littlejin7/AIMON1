"""버그3(게이팅) 회귀 테스트 — assert_stage_access / assert_boss_access / 공개구간 검증."""
import os, sys
import pytest
from fastapi import HTTPException

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

from routers import quiz as Q

LEVELED = {"id": "u1", "is_level_tested": True,
           "max_unlocked_unit": {"beginner": 3}}


def _patch_progress(monkeypatch, items):
    monkeypatch.setattr(Q, "get_progress_by_user", lambda uid, lvl: items)


def test_stage_access_blocks_when_not_level_tested(monkeypatch):
    _patch_progress(monkeypatch, [])
    with pytest.raises(HTTPException) as e:
        Q.assert_stage_access({"id": "u1", "is_level_tested": False}, 1, "1-1", "beginner")
    assert e.value.status_code == 403


def test_stage_access_blocks_locked_unit(monkeypatch):
    _patch_progress(monkeypatch, [])
    with pytest.raises(HTTPException) as e:
        Q.assert_stage_access(LEVELED, 5, "5-1", "beginner")  # max=3
    assert e.value.status_code == 403


def test_stage_access_first_stage_no_prev_check(monkeypatch):
    _patch_progress(monkeypatch, [])  # 진행도 없어도 X-1 은 통과
    Q.assert_stage_access(LEVELED, 2, "2-1", "beginner")  # 예외 없음


def test_stage_access_blocks_when_prev_stage_incomplete(monkeypatch):
    _patch_progress(monkeypatch, [])  # 2-1 미완료
    with pytest.raises(HTTPException) as e:
        Q.assert_stage_access(LEVELED, 2, "2-2", "beginner")
    assert e.value.status_code == 403


def test_stage_access_allows_when_prev_done(monkeypatch):
    _patch_progress(monkeypatch, [
        {"unit": 2, "stage": "2-1", "is_completed": True},
    ])
    Q.assert_stage_access(LEVELED, 2, "2-2", "beginner")  # 통과(과잉 차단 없음)


def test_stage_access_allows_when_prev_miniboss_cleared_but_progress_lost(monkeypatch):
    """progress 완료행이 유실돼도 이전 스테이지가 miniboss_cleared_stages 에 있으면 통과.

    de0040ab 사례: 미니보스 클리어(원자, users)만 남고 progress 완료행(락 밖)이
    유실된 유저가 다음 스테이지에서 영구 403 되던 회귀를 고정한다.
    """
    _patch_progress(monkeypatch, [])  # progress 완전 유실
    user = {**LEVELED, "miniboss_cleared_stages": ["2-1"]}
    Q.assert_stage_access(user, 2, "2-2", "beginner")  # 예외 없음


def test_boss_access_allows_when_stages_via_miniboss_cleared(monkeypatch):
    """progress 일부 유실 + miniboss_cleared_stages 합산으로 전 스테이지 완료 인정."""
    # progress 에는 3개만, 나머지 3개는 miniboss 클리어로만 남음
    _patch_progress(monkeypatch, [
        {"unit": 2, "stage": f"2-{i}", "is_completed": True} for i in range(1, 4)
    ])
    user = {**LEVELED, "miniboss_cleared_stages": ["2-4", "2-5", "2-6"]}
    Q.assert_boss_access(user, 2, "beginner")  # 통과 (3 + 3 = 6)


def test_boss_access_blocks_until_all_stages_done(monkeypatch):
    done = [{"unit": 2, "stage": f"2-{i}", "is_completed": True} for i in range(1, 6)]
    _patch_progress(monkeypatch, done)
    with pytest.raises(HTTPException) as e:
        Q.assert_boss_access(LEVELED, 2, "beginner")
    assert e.value.status_code == 403


def test_boss_access_allows_when_all_stages_done(monkeypatch):
    done = [{"unit": 2, "stage": f"2-{i}", "is_completed": True} for i in range(1, 7)]
    _patch_progress(monkeypatch, done)
    Q.assert_boss_access(LEVELED, 2, "beginner")  # 통과


def test_questions_public_stage_1_1_allows_anonymous():
    out = Q.get_questions(unit=1, stage="1-1", course_level="beginner",
                          category="quiz", limit=5, attempt=1, user=None)
    assert isinstance(out, (list, dict))


def test_questions_anonymous_blocked_on_non_public():
    with pytest.raises(HTTPException) as e:
        Q.get_questions(unit=1, stage="1-2", course_level="beginner",
                        category="quiz", limit=5, attempt=1, user=None)
    assert e.value.status_code == 401
