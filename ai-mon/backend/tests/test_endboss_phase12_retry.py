import os
import sys
import random

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import routers.endboss as E
import routers.utils as U


def _phase_q(phase: int, i: int, project: str = "account"):
    return {
        "question_id": f"p{phase}_q{i}",
        "project": project,
        "phase": phase,
        "type": "multiple_choice",
        "question": f"Phase{phase} Question {i}",
        "answer": "A",
        "feedback": {"correct": "ok", "wrong": "no"},
        "hint": "hint",
        "explanation": "explanation",
    }


def _all_questions():
    # phase1: 10개(5개씩 두 배치), phase2: 8개(4개씩 두 배치), phase3: 3개(길이 체크 통과용)
    qs = [_phase_q(1, i) for i in range(1, 11)]
    qs += [_phase_q(2, i) for i in range(1, 9)]
    qs += [_phase_q(3, i) for i in range(1, 4)]
    return qs


def _seed_user(tmp_path, monkeypatch):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    user = {
        "id": "user-1",
        "username": "endboss-user",
        "nickname": "EndBossUser",
        "email": "endboss@example.com",
        "course_level": "beginner",
        "crowns": 100,
        "max_unlocked_unit": {"beginner": 9},
        "seen_questions": {},
    }
    U.save_users([user])
    return user


def test_endboss_phase12_retry_avoids_repeat_until_pool_exhausted_then_reopens(tmp_path, monkeypatch):
    user = _seed_user(tmp_path, monkeypatch)
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: _all_questions())
    # shuffle 무력화 → 매 호출 시 안 본 문제 중 원래 순서 그대로 앞에서부터 뽑힘(결정적 검증용)
    monkeypatch.setattr(random, "shuffle", lambda x: None)

    req = E.StartRequest(project="account")

    first = E.endboss_start(req, user=user)
    second = E.endboss_start(req, user=user)
    third = E.endboss_start(req, user=user)

    first_p1 = {q["question_id"] for q in first["phase1_questions"]}
    second_p1 = {q["question_id"] for q in second["phase1_questions"]}
    first_p2 = {q["question_id"] for q in first["phase2_questions"]}
    second_p2 = {q["question_id"] for q in second["phase2_questions"]}

    # 1회차와 2회차는 풀(phase1=10, phase2=8)이 정확히 두 배치를 커버하므로 겹치지 않아야 한다.
    assert first_p1.isdisjoint(second_p1)
    assert first_p2.isdisjoint(second_p2)

    # 3회차는 풀이 소진되어 재오픈되므로 다시 처음 배치와 겹칠 수 있다(재오픈 확인용 — 예외 없이 5/4개 반환).
    assert len(third["phase1_questions"]) == 5
    assert len(third["phase2_questions"]) == 4
