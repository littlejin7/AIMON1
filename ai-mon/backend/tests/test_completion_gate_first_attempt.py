"""레슨 완료 게이트 — 'qid별 첫 시도 정답'만 집계(엿보기 차단) 회귀 테스트.

검증 범위:
  - _server_graded_correct_qids: 첫 시도 정답 qid만 집계 + attempted_qids 반환
  - _supplement_from_answered: attempt 가 있는 qid 는 폴백 제외(첫 기록 우선)
  - update_progress 게이트: 8 첫시도정답 → 완료 허용 / 8 (오답→재시도정답) → 403
  - 전투/미니보스 배틀세션 로직은 본 변경 대상 아님(별도 테스트가 커버)
"""
import os, sys
import pytest
from fastapi import HTTPException

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

from routers import progress as P
from routers import quiz as Q


def _att(qid, t, ok, mode="quiz", unit=1, stage="1-1", level="beginner", id=""):
    return {"question_id": qid, "level": level, "unit": unit, "stage": stage,
            "mode": mode, "answered_at": t, "is_correct": ok, "id": id}


# ── _server_graded_correct_qids: 첫 시도 집계 ────────────────────────────────

def test_first_attempt_correct_counted(monkeypatch):
    """첫 시도 정답 qid만 집계."""
    atts = [_att("q1", "2026-01-01T10:00:00", True)]
    monkeypatch.setattr(P, "get_attempts_by_user", lambda uid: atts)
    fc, attempted = P._server_graded_correct_qids("u1", "beginner", 1, "1-1")
    assert fc == {"q1"}
    assert attempted == {"q1"}


def test_wrong_then_retry_correct_excluded(monkeypatch):
    """오답 → 재시도 정답: 첫 기록이 오답이므로 미집계(엿보기 차단)."""
    atts = [
        _att("q2", "2026-01-01T10:01:00", False),
        _att("q2", "2026-01-01T10:05:00", True),
    ]
    monkeypatch.setattr(P, "get_attempts_by_user", lambda uid: atts)
    fc, attempted = P._server_graded_correct_qids("u1", "beginner", 1, "1-1")
    assert fc == set()              # 미집계
    assert attempted == {"q2"}      # 시도는 존재


def test_tiebreak_same_timestamp_uses_id(monkeypatch):
    """answered_at 동률 시 id 오름차순으로 첫 기록 결정."""
    atts = [
        _att("q3", "2026-01-01T10:02:00", True,  id="b"),
        _att("q3", "2026-01-01T10:02:00", False, id="a"),   # id 'a' < 'b' → 첫 기록=오답
    ]
    monkeypatch.setattr(P, "get_attempts_by_user", lambda uid: atts)
    fc, _ = P._server_graded_correct_qids("u1", "beginner", 1, "1-1")
    assert fc == set()              # 첫 기록이 오답 → 미집계


def test_filters_by_level_unit_stage_mode(monkeypatch):
    """level/unit/stage/mode 불일치 attempt 는 제외."""
    atts = [
        _att("q1", "t1", True),                                  # 일치 → 집계
        _att("q2", "t1", True, level="advanced"),               # level 불일치
        _att("q3", "t1", True, unit=2),                         # unit 불일치
        _att("q4", "t1", True, stage="1-2"),                   # stage 불일치
        _att("q5", "t1", True, mode="random"),                 # 복습모드(LESSON_MODES 아님)
        _att("q6", "t1", True, mode="miniboss"),               # 미니보스도 레슨모드 → 집계
    ]
    monkeypatch.setattr(P, "get_attempts_by_user", lambda uid: atts)
    fc, attempted = P._server_graded_correct_qids("u1", "beginner", 1, "1-1")
    assert fc == {"q1", "q6"}
    assert attempted == {"q1", "q6"}


# ── _supplement_from_answered: 첫 기록 우선 ──────────────────────────────────

def _stage_pool(monkeypatch, answers):
    """quiz 로더가 stage 풀(qid→answer)을 돌려주도록 패치."""
    pool = [{"question_id": qid, "stage": "1-1", "answer": ans, "type": "output_select"}
            for qid, ans in answers.items()]
    monkeypatch.setattr(Q, "load_questions_by_category",
                        lambda cat, lvl=None, unit=None: pool)


class _Ans:
    def __init__(self, qid, ua):
        self.question_id = qid
        self.user_answer = ua


def test_supplement_skips_attempted_qid(monkeypatch):
    """이미 attempt 가 있는 qid 는 정답 답안을 보내도 폴백 보충에서 제외(첫 기록 우선)."""
    _stage_pool(monkeypatch, {"q2": "A"})
    # q2 는 attempted (오답→재시도정답 케이스). 폴백에 정답 'A'를 보내도 무시돼야 함.
    supp = P._supplement_from_answered([_Ans("q2", "A")], {"q2"}, "beginner", 1, "1-1")
    assert supp == 0


def test_supplement_adds_only_unattempted(monkeypatch):
    """attempt 가 전무한 qid 만 보충(네트워크 유실 정상통과 방어)."""
    _stage_pool(monkeypatch, {"q7": "A", "q8": "B"})
    # q7: attempt 없음 + 정답 → 보충 O / q8: attempt 없음 + 오답 → 보충 X
    supp = P._supplement_from_answered(
        [_Ans("q7", "A"), _Ans("q8", "Z")], set(), "beginner", 1, "1-1")
    assert supp == 1


def test_supplement_ignores_foreign_qid(monkeypatch):
    """stage 풀 밖 qid 는 무시(외부 qid 주입 차단)."""
    _stage_pool(monkeypatch, {"q7": "A"})
    supp = P._supplement_from_answered([_Ans("evil", "A")], set(), "beginner", 1, "1-1")
    assert supp == 0


# ── update_progress 게이트 통합 ─────────────────────────────────────────────

def _mock_post_gate(monkeypatch):
    """게이트 통과 후 진행도/보상 경로를 무해하게 mock."""
    monkeypatch.setattr(P, "assert_stage_access", lambda *a, **k: None)
    monkeypatch.setattr(P, "_stage_required_correct", lambda lvl, u, s: 8)
    monkeypatch.setattr(P, "get_progress_by_user", lambda uid, lvl: [])
    monkeypatch.setattr(P, "save_progress_item", lambda item: None)
    monkeypatch.setattr(
        P, "grant_reward",
        lambda u, coin_delta=0, ranking_score_delta=0, gp_delta=0, context=None, event_type=None: {
            "coin_delta": coin_delta, "gp_delta": 0, "ranking_score_delta": ranking_score_delta,
            "level_up": False, "events": {"newly_earned_titles": []},
        },
    )
    monkeypatch.setattr(P, "serialize_user", lambda u: u)

    def _fake_mutate(uid, mutator):
        u = {"id": uid, "lv": 1, "character": "slime"}
        res = mutator(u)
        return u, res
    monkeypatch.setattr(P, "mutate_user_atomic", _fake_mutate)

    import routers.quiz as RQ
    monkeypatch.setattr(RQ, "load_units", lambda lvl: [{"unit_id": 1, "stages": 5}])


def _req(answered=None):
    return P.ProgressUpdateRequest(
        unit=1, stage="1-1", score=100, is_completed=True,
        answered_questions=answered,
    )


def test_gate_allows_8_first_attempt_correct(monkeypatch):
    """10문항 중 8개 '첫 시도 정답' → 완료 허용(예외 없음)."""
    _mock_post_gate(monkeypatch)
    atts = [_att(f"q{i}", f"2026-01-01T10:0{i}:00", True) for i in range(8)]
    monkeypatch.setattr(P, "get_attempts_by_user", lambda uid: atts)

    out = P.update_progress(_req(), {"id": "u1", "course_level": "beginner"})
    assert out["message"]  # 정상 완료 응답


def test_gate_blocks_8_retry_correct(monkeypatch):
    """8개를 '오답 → 재시도 정답'으로 채움 → 첫 기록이 모두 오답 → 403."""
    _mock_post_gate(monkeypatch)
    atts = []
    for i in range(8):
        atts.append(_att(f"q{i}", f"2026-01-01T10:0{i}:00", False, id=f"{i}a"))  # 첫시도 오답
        atts.append(_att(f"q{i}", f"2026-01-01T11:0{i}:00", True,  id=f"{i}b"))  # 재시도 정답
    monkeypatch.setattr(P, "get_attempts_by_user", lambda uid: atts)

    with pytest.raises(HTTPException) as e:
        P.update_progress(_req(), {"id": "u1", "course_level": "beginner"})
    assert e.value.status_code == 403
    assert "0/8" in e.value.detail   # 첫시도 정답 0개


def test_gate_blocks_retry_even_with_answered_fallback(monkeypatch):
    """재시도정답 qid 는 answered_questions(첫 오답 답안) 폴백으로도 되살아나지 않는다."""
    _mock_post_gate(monkeypatch)
    # quiz 풀: 정답 'A'. 프론트는 '첫 답안'(오답 'Z')을 보낸다.
    _stage_pool(monkeypatch, {f"q{i}": "A" for i in range(8)})
    atts = []
    for i in range(8):
        atts.append(_att(f"q{i}", f"2026-01-01T10:0{i}:00", False, id=f"{i}a"))
        atts.append(_att(f"q{i}", f"2026-01-01T11:0{i}:00", True,  id=f"{i}b"))
    monkeypatch.setattr(P, "get_attempts_by_user", lambda uid: atts)

    answered = [P.AnsweredQuestion(question_id=f"q{i}", user_answer="Z") for i in range(8)]  # 첫 답안=오답
    with pytest.raises(HTTPException) as e:
        P.update_progress(_req(answered), {"id": "u1", "course_level": "beginner"})
    assert e.value.status_code == 403


def test_gate_allows_via_unattempted_fallback(monkeypatch):
    """기록 유실(attempt 전무)이라도 answered_questions 첫 정답 8개면 완료 허용."""
    _mock_post_gate(monkeypatch)
    _stage_pool(monkeypatch, {f"q{i}": "A" for i in range(8)})
    monkeypatch.setattr(P, "get_attempts_by_user", lambda uid: [])  # 기록 전무

    answered = [P.AnsweredQuestion(question_id=f"q{i}", user_answer="A") for i in range(8)]  # 첫 답안=정답
    out = P.update_progress(_req(answered), {"id": "u1", "course_level": "beginner"})
    assert out["message"]
