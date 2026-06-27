"""통합(end-to-end): 첫시도 정답 게이트 × 유닛 크라운 지급을 한 흐름으로 검증.

수정 1~4 통합 회귀의 핵심 시나리오:
  첫시도 정답 8/10 으로 스테이지 정상 완료 → is_completed 저장 →
  유닛 전 스테이지 완료 시 크라운 1개 지급.

특징: 게이트를 mock 하지 않는다.
  - _stage_required_correct 는 실제 quiz 데이터(beginner unit1 stage 1-1: set-A 10문항)에서
    ceil(0.8*10)=8 을 산출.
  - _server_graded_correct_qids 는 실제 attempts(첫 시도 정답 8건)를 집계.
  - 크라운 지급은 update_progress 의 실제 mutate_user_atomic 경로로 처리.
즉 '게이트(8/10 실제 통과) × 크라운(1개 지급)' 이 한 번에 동작함을 입증한다.

대조군: 같은 8문항이 '오답→재시도 정답'이면 첫 기록이 오답 → 게이트 403(크라운 미지급).
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
from routers import progress as P
from routers.quiz import load_questions_by_category

LEVEL = "beginner"
UNIT = 1
GATED_STAGE = "1-1"


def _stage_a_qids(stage: str) -> list:
    """실제 quiz 풀에서 해당 스테이지 set-A question_id 목록(첫 시도 게이트 대상)."""
    qs = [q for q in load_questions_by_category("quiz", LEVEL, UNIT)
          if q.get("stage") == stage and q.get("quiz_set") == "A"]
    return [q["question_id"] for q in qs if q.get("question_id")]


@pytest.fixture
def env(monkeypatch, tmp_path):
    """USERS/PROGRESS/ATTEMPTS 파일을 임시 경로로 리디렉트.

    진입 게이트(assert_stage_access)는 본 검증과 직교 → 레벨테스트 완료 + 전 유닛 해금.
    유닛1의 1-2..1-7 + 보스는 '이미 완료'로 progress 에 시드하고, 마지막 미완료
    스테이지 1-1 을 게이트(8/10 첫시도정답) 통과로 완료시켜 유닛을 닫는다.
    """
    users_file = tmp_path / "users.json"
    progress_file = tmp_path / "progress.json"
    attempts_file = tmp_path / "attempts.json"

    users_file.write_text(json.dumps([{
        "id": "u1", "xp": 0, "lv": 1, "crowns": 0,
        "character": "slime", "titles": [], "awarded_crown_units": [],
        "course_level": LEVEL, "is_level_tested": True,
        "max_unlocked_unit": {LEVEL: 99},
    }]), encoding="utf-8")

    # 1-2..1-7 + 1-boss 는 이미 완료 (마지막 1-1 만 이번에 닫음)
    seeded = [
        {"user_id": "u1", "unit": UNIT, "stage": f"{UNIT}-{i}",
         "is_completed": True, "score": 100, "course_level": LEVEL}
        for i in range(2, 8)
    ] + [{"user_id": "u1", "unit": UNIT, "stage": f"{UNIT}-boss",
          "is_completed": True, "score": 100, "course_level": LEVEL}]
    progress_file.write_text(json.dumps(seeded), encoding="utf-8")
    attempts_file.write_text("[]", encoding="utf-8")

    monkeypatch.setattr(U, "USERS_FILE", str(users_file))
    monkeypatch.setattr(U, "PROGRESS_FILE", str(progress_file))
    monkeypatch.setattr(U, "ATTEMPTS_FILE", str(attempts_file))
    monkeypatch.setattr(U, "USE_SUPABASE", False)
    return {"users": str(users_file), "attempts": str(attempts_file)}


def _seed_attempts(path: str, qids: list, first_correct: bool):
    """qids 각각에 attempt 시드.
    first_correct=True  → 첫 시도(10:00)가 정답.
    first_correct=False → 첫 시도(10:00) 오답, 재시도(11:00) 정답(엿보기 패턴).
    """
    atts = []
    for i, qid in enumerate(qids):
        if first_correct:
            atts.append({"question_id": qid, "level": LEVEL, "unit": UNIT,
                         "stage": GATED_STAGE, "mode": "quiz",
                         "answered_at": f"2026-01-01T10:0{i}:00",
                         "is_correct": True, "id": f"{i}a", "user_id": "u1"})
        else:
            atts.append({"question_id": qid, "level": LEVEL, "unit": UNIT,
                         "stage": GATED_STAGE, "mode": "quiz",
                         "answered_at": f"2026-01-01T10:0{i}:00",
                         "is_correct": False, "id": f"{i}a", "user_id": "u1"})
            atts.append({"question_id": qid, "level": LEVEL, "unit": UNIT,
                         "stage": GATED_STAGE, "mode": "quiz",
                         "answered_at": f"2026-01-01T11:0{i}:00",
                         "is_correct": True, "id": f"{i}b", "user_id": "u1"})
    with open(path, "w", encoding="utf-8") as f:
        json.dump(atts, f)


def _crowns(users_file: str) -> int:
    with open(users_file, encoding="utf-8") as f:
        return json.load(f)[0].get("crowns", 0)


def _submit_complete():
    req = P.ProgressUpdateRequest(unit=UNIT, stage=GATED_STAGE, score=100, is_completed=True)
    user = {"id": "u1", "course_level": LEVEL,
            "is_level_tested": True, "max_unlocked_unit": {LEVEL: 99}}
    return P.update_progress(req, user)


# ── 해피패스: 첫시도 정답 8/10 → 완료 → 유닛 닫힘 → 크라운 1 ──────────────────
def test_first_attempt_pass_completes_stage_and_awards_unit_crown(env):
    qids = _stage_a_qids(GATED_STAGE)
    assert len(qids) >= 8, "테스트 전제: 1-1 set-A 가 8문항 이상이어야 함"

    # 실제 required = ceil(0.8 * min(10, poolsize)) = 8 인지 먼저 고정
    required = P._stage_required_correct(LEVEL, UNIT, GATED_STAGE)
    assert required == 8, f"기대 required=8, 실제={required}"

    # 8문항 '첫 시도 정답' 시드 (10문항 중 8 → 정확히 게이트 충족선)
    _seed_attempts(env["attempts"], qids[:8], first_correct=True)

    res = _submit_complete()

    # 게이트 통과 → 완료 저장 → 유닛 전 스테이지 충족 → 크라운 1
    assert res["crowns_awarded"] == 1, "8/10 첫시도정답 + 전 스테이지 완료인데 크라운 미지급"
    assert _crowns(env["users"]) == 1


# ── 대조군: 같은 8문항이 '오답→재시도 정답'이면 게이트 403 (크라운 0) ─────────
def test_retry_correct_blocked_no_crown(env):
    qids = _stage_a_qids(GATED_STAGE)
    _seed_attempts(env["attempts"], qids[:8], first_correct=False)  # 첫 기록 오답

    with pytest.raises(HTTPException) as exc:
        _submit_complete()
    assert exc.value.status_code == 403
    assert "0/8" in exc.value.detail          # 첫시도 정답 0개로 집계
    assert _crowns(env["users"]) == 0          # 크라운 미지급
