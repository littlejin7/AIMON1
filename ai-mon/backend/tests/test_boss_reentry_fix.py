"""보스 재진입(already-cleared) 허용 회귀 테스트.

tester_wang 케이스: unitboss_cleared_units에 키가 있는 유저는
선행 스테이지 progress 없이도 보스 재진입이 허용되어야 한다.
"""
import os, sys
import pytest
from fastapi import HTTPException

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

from routers import quiz as Q


def _patch_progress(monkeypatch, items):
    monkeypatch.setattr(Q, "get_progress_by_user", lambda uid, lvl: items)


def test_boss_access_already_cleared_skips_stage_check(monkeypatch):
    """이미 보스를 깬 유저(unitboss_cleared_units에 키 존재)는
    선행 스테이지 progress가 없어도 재진입 허용 (tester_wang 케이스)."""
    _patch_progress(monkeypatch, [])  # progress 완전 없음
    user = {
        "id": "u1", "is_level_tested": True,
        "max_unlocked_unit": {"beginner": 3},
        "unitboss_cleared_units": ["beginner-2"],  # 이미 클리어
    }
    Q.assert_boss_access(user, 2, "beginner")  # 예외 없음 — 재진입 허용


def test_boss_access_already_cleared_other_unit_still_blocks(monkeypatch):
    """다른 유닛 클리어 키는 이번 유닛 면제 조건이 되지 않는다."""
    _patch_progress(monkeypatch, [])  # unit3 progress 없음
    user = {
        "id": "u1", "is_level_tested": True,
        "max_unlocked_unit": {"beginner": 3},
        "unitboss_cleared_units": ["beginner-2"],  # unit2만 클리어, unit3은 미클리어
    }
    with pytest.raises(HTTPException) as e:
        Q.assert_boss_access(user, 3, "beginner")
    assert e.value.status_code == 403


def test_boss_access_no_cleared_units_still_blocks(monkeypatch):
    """unitboss_cleared_units가 없는 신규 유저는 선행 스테이지 미완료 시 차단."""
    _patch_progress(monkeypatch, [])
    user = {
        "id": "u1", "is_level_tested": True,
        "max_unlocked_unit": {"beginner": 3},
        # unitboss_cleared_units 없음
    }
    with pytest.raises(HTTPException) as e:
        Q.assert_boss_access(user, 2, "beginner")
    assert e.value.status_code == 403


def test_boss_access_already_cleared_level_test_still_required(monkeypatch):
    """이미 클리어했어도 is_level_tested=False면 403 — 레벨테스트 게이트 유지."""
    _patch_progress(monkeypatch, [])
    user = {
        "id": "u1", "is_level_tested": False,
        "max_unlocked_unit": {"beginner": 3},
        "unitboss_cleared_units": ["beginner-2"],
    }
    with pytest.raises(HTTPException) as e:
        Q.assert_boss_access(user, 2, "beginner")
    assert e.value.status_code == 403
    assert "레벨 테스트" in e.value.detail
