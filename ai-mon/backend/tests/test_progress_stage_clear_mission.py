"""P0 회귀: d_quiz3(stage_clear) 미션은 '서버가 확인한 최초 완료 전환'에서만 오른다.

이전 버그: POST /progress 가 매 호출마다 event_type="stage_clear" 를 무조건
grant_reward 에 넘겨, 체크포인트 저장·이미 완료한 스테이지 재저장·is_completed=false
요청 등 실제 최초완료가 아닌 호출에서도 d_quiz3 진척이 반복 증가할 수 있었다.

수정: award_xp(= existing.is_completed False→True 전환, 또는 신규 행+is_completed=True)
가 True 일 때만 event_type="stage_clear" 를 넘긴다.

테스트는 "boss" 가 포함된 stage 명을 써서 assert_stage_access/서버채점 카운트 게이트를
우회한다(그 게이트는 이 P0 와 무관한 별도 기능 — C 어뷰징 방어, 이미 다른 테스트가 커버).
"""
import os
import sys

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import routers.progress as P
import routers.quiz as Q
import routers.utils as U


def _seed_user(tmp_path, monkeypatch, **overrides):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "PROGRESS_FILE", str(tmp_path / "progress.json"))
    monkeypatch.setattr(Q, "load_units", lambda course_level=None: [{"unit_id": 1, "stages": 1}])
    user = {
        "id": "u1", "course_level": "beginner", "crowns": 0, "xp": 0, "lv": 1,
        "character": "slime", "titles": [],
    }
    user.update(overrides)
    U.save_users([user])
    (tmp_path / "progress.json").write_text("[]", encoding="utf-8")
    return user


def _d_quiz3(user_id="u1"):
    user = U.get_user_by_id(user_id)
    return (user.get("missions") or {}).get("daily", {}).get("progress", {}).get("d_quiz3", 0)


def _req(unit=1, stage="1-boss", score=100, is_completed=True, checkpoint=None):
    return P.ProgressUpdateRequest(
        unit=unit, stage=stage, score=score, is_completed=is_completed, checkpoint=checkpoint,
    )


# 1) 최초 스테이지 완료 시 d_quiz3 +1
def test_first_completion_increments_d_quiz3(tmp_path, monkeypatch):
    user = _seed_user(tmp_path, monkeypatch)
    P.update_progress(_req(is_completed=True), user_ref=user)
    assert _d_quiz3() == 1


# 2) 같은 완료 요청 반복 시 추가 증가 없음
def test_repeated_identical_completion_does_not_increment_again(tmp_path, monkeypatch):
    user = _seed_user(tmp_path, monkeypatch)
    P.update_progress(_req(is_completed=True), user_ref=user)
    assert _d_quiz3() == 1
    P.update_progress(_req(is_completed=True), user_ref=user)
    assert _d_quiz3() == 1


# 3) 이미 완료된 스테이지 재저장 시 증가 없음 (progress 가 이 엔드포인트 밖에서 이미 완료 상태로 시작)
def test_resave_of_already_completed_stage_does_not_increment(tmp_path, monkeypatch):
    user = _seed_user(tmp_path, monkeypatch)
    (tmp_path / "progress.json").write_text(
        '[{"id": "p1", "user_id": "u1", "unit": 1, "stage": "1-boss", '
        '"score": 100, "is_completed": true, "course_level": "beginner", '
        '"created_at": "2026-01-01T00:00:00+09:00", "updated_at": "2026-01-01T00:00:00+09:00"}]',
        encoding="utf-8",
    )
    assert _d_quiz3() == 0
    P.update_progress(_req(is_completed=True, score=100), user_ref=user)
    assert _d_quiz3() == 0


# 4) checkpoint만 저장 시 증가 없음
def test_checkpoint_only_save_does_not_increment(tmp_path, monkeypatch):
    user = _seed_user(tmp_path, monkeypatch)
    P.update_progress(_req(is_completed=False, checkpoint="mid", score=0), user_ref=user)
    assert _d_quiz3() == 0


# 5) is_completed=false 요청 시 증가 없음
def test_is_completed_false_request_does_not_increment(tmp_path, monkeypatch):
    user = _seed_user(tmp_path, monkeypatch)
    P.update_progress(_req(is_completed=False, score=50), user_ref=user)
    assert _d_quiz3() == 0
    # 같은 미완료 요청을 반복해도 여전히 증가 없음
    P.update_progress(_req(is_completed=False, score=60), user_ref=user)
    assert _d_quiz3() == 0


# ── 부가: 기존 보상 로직(coin/ranking) 은 변경되지 않았음을 함께 확인 ─────────
def test_first_completion_still_awards_coin_and_ranking(tmp_path, monkeypatch):
    user = _seed_user(tmp_path, monkeypatch)
    result = P.update_progress(_req(is_completed=True), user_ref=user)
    assert result["reward"]["coin_delta"] == 3000          # "boss" 스테이지 → xp_gain=3000
    assert result["reward"]["ranking_score_delta"] == 3000
    assert result["xp_awarded"] == 3000
