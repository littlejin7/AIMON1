"""
attempts 전수 기록 검증 (실제 엔드포인트 호출, JSON dev 스토리지).

검증 항목:
  T0. /boss/endboss/answer 가 실제로 200 (기존 NameError 버그 수정 확인)
  T1. 정답/오답 섞어 풀면 attempts 에 매번 1건씩 기록
  T2. AI 피드백을 일부러 실패시켜도 오답 attempt 는 그대로 남음 (완전 분리)
  T3. 오답복습(only_wrong)은 셔플 폴백 없이 '실제 틀린 문제만' 반환 (latest 기준)
  T4. 유닛별 정답률이 is_completed 가 아니라 실제 정오답으로 계산
"""
import sys, os, json, logging, uuid

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

import pytest
from fastapi.testclient import TestClient

import routers.utils as U
import routers.boss as BOSS
import routers.endboss as EB
import routers.quiz as QUIZ
import routers.train as TRAIN
import routers.attempts as ATT
from main import app

TEST_USER = {"id": "u1", "course_level": "beginner", "lv": 1, "xp": 0, "crowns": 0}

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolate(monkeypatch, tmp_path):
    """모든 유저 스토리지를 임시 파일로 격리 + 인증 의존성 오버라이드."""
    for attr, name in [
        ("ATTEMPTS_FILE", "attempts.json"),
        ("WRONG_ANSWERS_FILE", "wrong_answers.json"),
        ("USERS_FILE", "users.json"),
        ("PROGRESS_FILE", "progress.json"),
    ]:
        monkeypatch.setattr(U, attr, str(tmp_path / name))
    monkeypatch.setattr(U, "USE_SUPABASE", False)

    app.dependency_overrides[U.get_current_user] = lambda: dict(TEST_USER)
    app.dependency_overrides[U.get_current_user_optional] = lambda: dict(TEST_USER)
    yield
    app.dependency_overrides.clear()


def _read_attempts():
    with open(U.ATTEMPTS_FILE, encoding="utf-8") as f:
        return json.load(f)


def _seed_attempts(rows):
    with open(U.ATTEMPTS_FILE, "w", encoding="utf-8") as f:
        json.dump(rows, f)


def test_supabase_attempt_failure_is_logged_not_raised(monkeypatch, caplog):
    class FailingAttemptTable:
        def upsert(self, item):
            self.item = item
            return self

        def execute(self):
            raise RuntimeError("column answered_at does not exist")

    class FailingSupabase:
        def table(self, name):
            assert name == "attempts"
            return FailingAttemptTable()

    monkeypatch.setattr(U, "USE_SUPABASE", True)
    monkeypatch.setattr(U, "supabase", FailingSupabase())

    item = {
        "id": "11111111-1111-1111-1111-111111111111",
        "user_id": "22222222-2222-2222-2222-222222222222",
        "question_id": "q1",
        "unit": 1,
        "stage": "1-1",
        "level": "beginner",
        "mode": "quiz",
        "is_correct": True,
        "answered_at": "2026-06-30T12:00:00+09:00",
        "token": "secret-token",
        "password": "secret-password",
    }

    with caplog.at_level(logging.ERROR, logger="uvicorn.error"):
        result = U.save_attempt_item(item)

    assert result is False
    assert any("Supabase attempts upsert failed" in r.message for r in caplog.records)
    log_text = "\n".join(r.getMessage() for r in caplog.records)
    assert "secret-token" not in log_text
    assert "secret-password" not in log_text
    assert "'user_id': '22222222-2222-2222-2222-222222222222'" in log_text


def test_supabase_attempt_user_id_is_normalized_to_str(monkeypatch):
    class CapturingAttemptTable:
        def __init__(self):
            self.item = None

        def upsert(self, item):
            self.item = item
            return self

        def execute(self):
            return type("Result", (), {"data": [self.item]})()

    class CapturingSupabase:
        def __init__(self):
            self.attempts = CapturingAttemptTable()

        def table(self, name):
            assert name == "attempts"
            return self.attempts

    fake = CapturingSupabase()
    user_id = uuid.UUID("33333333-3333-3333-3333-333333333333")
    monkeypatch.setattr(U, "USE_SUPABASE", True)
    monkeypatch.setattr(U, "supabase", fake)

    result = U.save_attempt_item({
        "id": "11111111-1111-1111-1111-111111111111",
        "user_id": user_id,
        "question_id": "q1",
        "mode": "quiz",
        "is_correct": True,
    })

    assert result is True
    assert fake.attempts.item["user_id"] == "33333333-3333-3333-3333-333333333333"
    assert isinstance(fake.attempts.item["user_id"], str)


def test_supabase_attempt_invalid_uuid_is_skipped(monkeypatch, caplog):
    class ShouldNotBeCalledSupabase:
        def table(self, name):
            raise AssertionError("Supabase should not be called for invalid user_id")

    monkeypatch.setattr(U, "USE_SUPABASE", True)
    monkeypatch.setattr(U, "supabase", ShouldNotBeCalledSupabase())
    item = {
        "id": "11111111-1111-1111-1111-111111111111",
        "user_id": "u1",
        "question_id": "q1",
        "mode": "quiz",
        "is_correct": True,
        "password": "secret-password",
    }

    with caplog.at_level(logging.WARNING, logger="uvicorn.error"):
        result = U.save_attempt_item(item)

    assert result is False
    log_text = "\n".join(r.getMessage() for r in caplog.records)
    assert "not a valid uuid" in log_text
    assert "secret-password" not in log_text


# ─────────────────────────────────────────────────────────────────────────────
# T0. /boss/endboss/answer 200
# ─────────────────────────────────────────────────────────────────────────────
def test_endboss_answer_returns_200(monkeypatch):
    monkeypatch.setattr(EB, "load_endboss_questions", lambda level: [{
        "question_id": "eb1", "type": "multiple_choice", "question": "Q?",
        "answer": "B", "feedback": {"correct": "정답", "incorrect": "오답"}, "hint": "h",
    }])
    r = client.post("/boss/endboss/answer", json={
        "question_id": "eb1", "user_answer": "B", "phase": 1,
        "my_hp": 1200, "boss_hp": 1800, "project": "account",
    })
    assert r.status_code == 200, r.text
    assert r.json()["is_correct"] is True
    rows = _read_attempts()
    assert len(rows) == 1 and rows[0]["mode"] == "endboss" and rows[0]["is_correct"] is True
    print("\n[T0] /boss/endboss/answer ->", r.status_code, "| endboss attempt 기록 OK")


# ─────────────────────────────────────────────────────────────────────────────
# T1. 정답/오답 섞어 풀면 매번 기록
# ─────────────────────────────────────────────────────────────────────────────
def test_mixed_correct_wrong_all_recorded(monkeypatch):
    # question_id 정규화용 풀
    monkeypatch.setattr(ATT, "load_questions_by_category",
                        lambda category, course_level=None, unit=None: [{"question_id": "q1"}, {"question_id": "q2"}])
    for qid, correct in [("q1", True), ("q2", False)]:
        r = client.post("/attempts", json={
            "question_id": qid, "unit": 7, "stage": "7-1", "level": "beginner",
            "mode": "quiz", "is_correct": correct,
        })
        assert r.status_code == 200, r.text
    rows = _read_attempts()
    by = {a["question_id"]: a["is_correct"] for a in rows}
    assert len(rows) == 2 and by == {"q1": True, "q2": False}
    print("[T1] 정답/오답 2건 모두 기록:", by)


# ─────────────────────────────────────────────────────────────────────────────
# T2. AI 피드백 실패해도 오답 attempt 는 남음
# ─────────────────────────────────────────────────────────────────────────────
def test_attempt_survives_ai_feedback_failure(monkeypatch):
    monkeypatch.setattr(ATT, "load_questions_by_category",
                        lambda category, course_level=None, unit=None: [{"question_id": "q3"}])
    # 1) 오답 채점 순간 attempt 기록 (AI 피드백과 무관한 별도 호출)
    r = client.post("/attempts", json={
        "question_id": "q3", "unit": 7, "stage": "7-1", "level": "beginner",
        "mode": "quiz", "is_correct": False,
    })
    assert r.status_code == 200

    # 2) 이제 AI 피드백을 강제로 실패/타임아웃 (ask_claude 의 실패 계약: success=False)
    async def _fail(*a, **k):
        return {"success": False, "feedback": ""}
    monkeypatch.setattr(QUIZ, "ask_claude", _fail)
    fb = client.post("/quiz/ai-feedback", json={
        "question_id": "q3", "question": "Q?", "correct_answer": "x",
        "user_answer": "y", "level": "beginner",
    })
    assert fb.status_code == 200
    assert fb.json()["is_ai_fallback"] is True  # 피드백은 실패(fallback)

    # 3) 그래도 attempt(오답)는 그대로 1건 보존
    rows = _read_attempts()
    assert len(rows) == 1 and rows[0]["question_id"] == "q3" and rows[0]["is_correct"] is False
    print("[T2] AI 피드백 실패(is_ai_fallback=True)에도 오답 attempt 보존 OK")


# ─────────────────────────────────────────────────────────────────────────────
# T3. 오답복습 only_wrong → 실제 틀린 문제만 (셔플 폴백 없음, latest 기준)
# ─────────────────────────────────────────────────────────────────────────────
def test_only_wrong_returns_exactly_wrong(monkeypatch):
    pool = [{"question_id": f"q{i}", "question": f"Q{i}", "unit": 7} for i in range(1, 6)]
    monkeypatch.setattr(TRAIN, "load_questions_by_category",
                        lambda category, course_level=None, unit=None: list(pool))
    # q2: 과거 정답 → 이후 오답(최신) | q4: 오답 | q1: 정답
    _seed_attempts([
        {"user_id": "u1", "question_id": "q2", "unit": 7, "level": "beginner", "mode": "quiz", "is_correct": True,  "answered_at": "2026-06-01T00:00:00+09:00"},
        {"user_id": "u1", "question_id": "q2", "unit": 7, "level": "beginner", "mode": "quiz", "is_correct": False, "answered_at": "2026-06-20T00:00:00+09:00"},
        {"user_id": "u1", "question_id": "q4", "unit": 7, "level": "beginner", "mode": "quiz", "is_correct": False, "answered_at": "2026-06-10T00:00:00+09:00"},
        {"user_id": "u1", "question_id": "q1", "unit": 7, "level": "beginner", "mode": "quiz", "is_correct": True,  "answered_at": "2026-06-10T00:00:00+09:00"},
    ])
    r = client.get("/train/review", params={"unit": 7, "course_level": "beginner", "only_wrong": True})
    assert r.status_code == 200
    ids = sorted(q["question_id"] for q in r.json())
    assert ids == ["q2", "q4"], ids  # latest 오답만, q1(정답) 제외, q3/q5(미시도) 제외

    # 대조군: only_wrong=false 는 폴백 패딩으로 5개 전부
    r2 = client.get("/train/review", params={"unit": 7, "course_level": "beginner", "only_wrong": False})
    assert len(r2.json()) == 5
    print("[T3] only_wrong 결과:", ids, "| only_wrong=false 개수:", len(r2.json()))


# ─────────────────────────────────────────────────────────────────────────────
# T4. 유닛별 정답률 = 실제 정오답 (is_completed 무관)
# ─────────────────────────────────────────────────────────────────────────────
def test_accuracy_from_attempts_not_completion():
    # progress 는 비어있음(완료 0) — 그래도 정답률은 attempts 로 계산돼야 함
    _seed_attempts([
        {"user_id": "u1", "question_id": "q1", "unit": 7, "level": "beginner", "mode": "quiz", "is_correct": True,  "answered_at": "2026-06-10T00:00:00+09:00"},
        {"user_id": "u1", "question_id": "q2", "unit": 7, "level": "beginner", "mode": "quiz", "is_correct": False, "answered_at": "2026-06-10T00:00:00+09:00"},
        {"user_id": "u1", "question_id": "q3", "unit": 7, "level": "beginner", "mode": "quiz", "is_correct": True,  "answered_at": "2026-06-10T00:00:00+09:00"},
        {"user_id": "u1", "question_id": "q4", "unit": 7, "level": "beginner", "mode": "quiz", "is_correct": True,  "answered_at": "2026-06-10T00:00:00+09:00"},
        {"user_id": "u1", "question_id": "q5", "unit": 8, "level": "beginner", "mode": "quiz", "is_correct": False, "answered_at": "2026-06-10T00:00:00+09:00"},
    ])
    r = client.get("/train/accuracy", params={"course_level": "beginner"})
    assert r.status_code == 200
    by_unit = {row["unit"]: row["pct"] for row in r.json()}
    assert by_unit == {7: 75, 8: 0}, by_unit  # 7: 3/4=75%, 8: 0/1=0%
    print("[T4] attempts 기반 유닛 정답률:", by_unit, "(progress 완료=0인데도 계산됨)")
