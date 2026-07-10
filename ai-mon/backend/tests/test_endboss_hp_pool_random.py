"""P1 회귀: 엔드보스 HP=1800 통일, Phase 3 최소 문제 수 검증, 실제 랜덤 셔플.

세 가지 불일치를 고정한다:
1. BOSS_HP_INIT=1800 — Phase1(5)+Phase2(4)=9문제를 모두 통과해야 Phase3 진입.
2. /start 는 phase3 풀이 PHASE3_MAX_TRIES(3) 미만이면 왕관 차감 전에 거부한다.
3. pick_batch_unseen 은 앞에서부터 자르지 않고 실제로 섞어서 선택한다.
"""
import os
import sys
import threading

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import asyncio
import pytest
from fastapi import HTTPException

import routers.endboss as E
import routers.utils as U
from routers.battle_session import get_endboss_session, verify_battle_token


def _make_user(**overrides):
    user = {
        "id": "u1",
        "username": "endboss-user",
        "nickname": "EndBossUser",
        "email": "endboss@example.com",
        "course_level": "beginner",
        "crowns": 20,
        "endboss_cleared_levels": [],
        "max_unlocked_unit": {"beginner": 9},
        "seen_questions": {},
    }
    user.update(overrides)
    return user


def _mc_q(phase, i, project="account", answer="A"):
    return {
        "question_id": f"p{phase}_{project}_q{i}", "project": project, "phase": phase,
        "type": "multiple_choice", "question": f"Q{phase}-{i}", "answer": answer,
        "feedback": {"correct": "ok", "incorrect": "no"}, "hint": "h", "explanation": "e",
    }


def _full_pool(project="account", phase3_count=3):
    return (
        [_mc_q(1, i, project) for i in range(1, 6)]
        + [_mc_q(2, i, project) for i in range(1, 5)]
        + [_mc_q(3, i, project) for i in range(1, phase3_count + 1)]
    )


def _answer(user, token, qid, phase, answer="A", **overrides):
    return asyncio.run(E.endboss_answer(
        None,
        E.AnswerRequest(question_id=qid, user_answer=answer, phase=phase,
                        battle_token=token, project="account", **overrides),
        user=user,
    ))


# ══════════════════════════ HP · Phase 전환 ══════════════════════════

def test_start_boss_hp_is_1800(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: _full_pool())
    user = _make_user()
    U.save_users([user])

    start = E.endboss_start(E.StartRequest(project="account"), user=user)
    assert start["boss_hp"] == 1800 == E.BOSS_HP_INIT


def test_phase1_five_corrects_leave_boss_hp_800(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "ATTEMPTS_FILE", str(tmp_path / "attempts.json"))
    monkeypatch.setattr(U.limiter, "enabled", False)
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: _full_pool())
    user = _make_user()
    U.save_users([user])

    start = E.endboss_start(E.StartRequest(project="account"), user=user)
    token = start["battle_token"]

    res = None
    for q in start["phase1_questions"]:
        res = _answer(user, token, q["question_id"], 1)
        assert res["is_correct"] is True

    assert res["boss_hp"] == 800
    assert res["phase3_ready"] is False   # phase1 완료만으로는 phase3 진입 불가


def test_total_eight_corrects_leave_boss_hp_200_no_phase3(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "ATTEMPTS_FILE", str(tmp_path / "attempts.json"))
    monkeypatch.setattr(U.limiter, "enabled", False)
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: _full_pool())
    user = _make_user()
    U.save_users([user])

    start = E.endboss_start(E.StartRequest(project="account"), user=user)
    token = start["battle_token"]

    p12 = start["phase1_questions"] + start["phase2_questions"]
    res = None
    for q in p12[:8]:
        phase = 1 if q["question_id"].startswith("p1") else 2
        res = _answer(user, token, q["question_id"], phase)

    assert res["boss_hp"] == 200
    assert res["phase3_ready"] is False


def test_ninth_correct_drops_boss_hp_to_zero_and_unlocks_phase3(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "ATTEMPTS_FILE", str(tmp_path / "attempts.json"))
    monkeypatch.setattr(U.limiter, "enabled", False)
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: _full_pool())
    user = _make_user()
    U.save_users([user])

    start = E.endboss_start(E.StartRequest(project="account"), user=user)
    token = start["battle_token"]

    p12 = start["phase1_questions"] + start["phase2_questions"]
    assert len(p12) == 9
    results = []
    for q in p12:
        phase = 1 if q["question_id"].startswith("p1") else 2
        results.append(_answer(user, token, q["question_id"], phase))

    for r in results[:8]:
        assert r["phase3_ready"] is False
    assert results[8]["boss_hp"] == 0
    assert results[8]["phase3_ready"] is True    # 9번째 정답에서만 게이트 개방


def test_phase3_correct_after_gate_wins(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "ATTEMPTS_FILE", str(tmp_path / "attempts.json"))
    monkeypatch.setattr(U.limiter, "enabled", False)
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: _full_pool())
    user = _make_user()
    U.save_users([user])

    start = E.endboss_start(E.StartRequest(project="account"), user=user)
    token = start["battle_token"]
    p12 = start["phase1_questions"] + start["phase2_questions"]
    for q in p12:
        phase = 1 if q["question_id"].startswith("p1") else 2
        _answer(user, token, q["question_id"], phase)

    p3q = start["phase3_first_question"]
    res = _answer(user, token, p3q["question_id"], 3)
    assert res["is_clear"] is True

    p = U.get_user_by_id("u1")
    sid = verify_battle_token(token, "u1", E.MODE)["sid"]
    assert get_endboss_session(p, sid)["status"] == "won"


def test_client_supplied_boss_hp_is_ignored(monkeypatch, tmp_path):
    """클라가 boss_hp=1 을 보내도 서버 세션 계산에 영향 없음."""
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "ATTEMPTS_FILE", str(tmp_path / "attempts.json"))
    monkeypatch.setattr(U.limiter, "enabled", False)
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: _full_pool())
    user = _make_user()
    U.save_users([user])

    start = E.endboss_start(E.StartRequest(project="account"), user=user)
    token = start["battle_token"]
    q = start["phase1_questions"][0]

    res = _answer(user, token, q["question_id"], 1, boss_hp=1, my_hp=1, phase3_tries=99)
    assert res["boss_hp"] == 1800 - E.BOSS_HP_DELTA   # 클라 위조값 무시, 서버 계산값만 사용


def test_client_supplied_phase3_tries_is_ignored(monkeypatch, tmp_path):
    """클라가 phase3_tries 를 조작해도 서버 세션 카운트만 사용된다."""
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "ATTEMPTS_FILE", str(tmp_path / "attempts.json"))
    monkeypatch.setattr(U.limiter, "enabled", False)
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: _full_pool())
    user = _make_user()
    U.save_users([user])

    start = E.endboss_start(E.StartRequest(project="account"), user=user)
    token = start["battle_token"]
    p12 = start["phase1_questions"] + start["phase2_questions"]
    for q in p12:
        phase = 1 if q["question_id"].startswith("p1") else 2
        _answer(user, token, q["question_id"], phase)

    p3q = start["phase3_first_question"]
    # 오답 + 조작된 phase3_tries=99 를 보내도 서버 세션은 1회만 증가한다.
    res = _answer(user, token, p3q["question_id"], 3, answer="WRONG", phase3_tries=99)
    assert res["phase3_tries"] == 1
    assert res["is_fail"] is False


# ══════════════════════════ Phase 3 문제 수 검증 ══════════════════════════

def test_start_succeeds_with_three_phase3_questions(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: _full_pool(phase3_count=3))
    user = _make_user()
    U.save_users([user])

    start = E.endboss_start(E.StartRequest(project="account"), user=user)
    assert start["battle_token"]


def test_start_rejected_with_two_phase3_questions(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: _full_pool(phase3_count=2))
    user = _make_user()
    U.save_users([user])

    with pytest.raises(HTTPException) as exc:
        E.endboss_start(E.StartRequest(project="account"), user=user)
    assert exc.value.status_code == 404


def test_rejected_start_does_not_deduct_crowns(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: _full_pool(phase3_count=2))
    user = _make_user(crowns=20)
    U.save_users([user])

    with pytest.raises(HTTPException):
        E.endboss_start(E.StartRequest(project="account"), user=user)

    p = U.get_user_by_id("u1")
    assert p["crowns"] == 20


def test_rejected_start_does_not_change_seen_questions(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: _full_pool(phase3_count=2))
    user = _make_user(seen_questions={"marker": True})
    U.save_users([user])

    with pytest.raises(HTTPException):
        E.endboss_start(E.StartRequest(project="account"), user=user)

    p = U.get_user_by_id("u1")
    assert p["seen_questions"] == {"marker": True}


def test_rejected_start_creates_no_battle_session(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: _full_pool(phase3_count=2))
    user = _make_user()
    U.save_users([user])

    with pytest.raises(HTTPException):
        E.endboss_start(E.StartRequest(project="account"), user=user)

    p = U.get_user_by_id("u1")
    assert not (p.get("battle_sessions") or {})


def test_phase3_pool_does_not_count_other_project_questions(monkeypatch, tmp_path):
    """다른 프로젝트(wordchain)의 phase3 문제를 account phase3 풀 크기에 합산하지 않는다."""
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    pool = (
        [_mc_q(1, i, "account") for i in range(1, 6)]
        + [_mc_q(2, i, "account") for i in range(1, 5)]
        + [_mc_q(3, i, "account") for i in range(1, 2)]        # account phase3: 1개뿐
        + [_mc_q(3, i, "wordchain") for i in range(1, 5)]      # wordchain phase3: 4개(무관)
    )
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: pool)
    user = _make_user()
    U.save_users([user])

    with pytest.raises(HTTPException) as exc:
        E.endboss_start(E.StartRequest(project="account"), user=user)
    assert exc.value.status_code == 404


def test_phase3_validation_scoped_to_selected_level_and_project(monkeypatch, tmp_path):
    """선택한 level+project 조합만 검증 — 다른 프로젝트는 통과 가능해야 한다."""
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    pool = (
        [_mc_q(1, i, "account") for i in range(1, 6)]
        + [_mc_q(2, i, "account") for i in range(1, 5)]
        + [_mc_q(3, i, "account") for i in range(1, 2)]        # account phase3 부족(1개)
        + [_mc_q(1, i, "wordchain") for i in range(1, 6)]
        + [_mc_q(2, i, "wordchain") for i in range(1, 5)]
        + [_mc_q(3, i, "wordchain") for i in range(1, 4)]      # wordchain phase3 충분(3개)
    )
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: pool)
    user = _make_user()
    U.save_users([user])

    with pytest.raises(HTTPException):
        E.endboss_start(E.StartRequest(project="account"), user=user)

    # 다른 프로젝트는 정상 시작
    start = E.endboss_start(E.StartRequest(project="wordchain"), user=user)
    assert start["battle_token"]


# ══════════════════════════ 랜덤 선택 (pick_batch_unseen) ══════════════════════════

def _pool(n, prefix="q"):
    return [{"question_id": f"{prefix}{i}"} for i in range(n)]


def test_pick_batch_unseen_returns_exact_count():
    pool = _pool(10)
    chosen, seen = E.pick_batch_unseen(pool, [], 4)
    assert len(chosen) == 4
    assert len(seen) == 4


def test_pick_batch_unseen_no_duplicates_in_batch():
    pool = _pool(10)
    chosen, _ = E.pick_batch_unseen(pool, [], 5)
    ids = [q["question_id"] for q in chosen]
    assert len(ids) == len(set(ids))


def test_pick_batch_unseen_prefers_unseen_when_sufficient():
    pool = _pool(10)
    already_seen = [f"q{i}" for i in range(5)]   # q0~q4 이미 봄
    chosen, new_seen = E.pick_batch_unseen(pool, already_seen, 3)
    ids = [q["question_id"] for q in chosen]
    assert all(qid not in already_seen for qid in ids)   # 안 본 문제(q5~q9)만 선택
    assert set(already_seen).issubset(set(new_seen))


def test_pick_batch_unseen_reopens_pool_when_unseen_insufficient():
    pool = _pool(5)
    already_seen = [f"q{i}" for i in range(4)]   # 5개 중 4개 봄 → unseen 1개뿐(count=3 요구)
    chosen, new_seen = E.pick_batch_unseen(pool, already_seen, 3)
    assert len(chosen) == 3                        # 재오픈되어 3개 채워짐
    # 재오픈 시 seen 은 이번에 선택된 것만 남는다(과거 seen 리셋)
    assert set(new_seen) == {q["question_id"] for q in chosen}


def test_pick_batch_unseen_does_not_mutate_original_pool_order():
    pool = _pool(10)
    original_order = [q["question_id"] for q in pool]
    E.pick_batch_unseen(pool, [], 5)
    assert [q["question_id"] for q in pool] == original_order


def test_pick_batch_unseen_follows_shuffle_result(monkeypatch):
    """random.shuffle 을 결정적으로 monkeypatch 해 실제 셔플 결과를 따르는지 검증."""
    pool = _pool(5)   # q0..q4

    def reverse_shuffle(lst):
        lst.reverse()

    monkeypatch.setattr(E.random, "shuffle", reverse_shuffle)
    chosen, _ = E.pick_batch_unseen(pool, [], 3)
    assert [q["question_id"] for q in chosen] == ["q4", "q3", "q2"]


def test_pick_batch_unseen_does_not_depend_on_random_probability():
    """순서 자체가 아니라 개수·중복없음·seen 정책만 검증(비결정 실패 방지)."""
    for _ in range(20):
        pool = _pool(8)
        chosen, new_seen = E.pick_batch_unseen(pool, [], 4)
        ids = [q["question_id"] for q in chosen]
        assert len(ids) == 4
        assert len(set(ids)) == 4
        assert set(ids).issubset({q["question_id"] for q in pool})


# ══════════════════════════ 왕관 동시성 회귀 ══════════════════════════

def test_concurrent_start_with_exactly_three_crowns_only_one_succeeds(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(E, "load_endboss_questions", lambda level: _full_pool())
    user = _make_user(crowns=E.RETRY_CROWN_COST)
    U.save_users([user])

    results, errors = [], []

    def call():
        try:
            results.append(E.endboss_start(E.StartRequest(project="account"), user=dict(user)))
        except HTTPException as e:
            errors.append(e.detail)

    t1 = threading.Thread(target=call)
    t2 = threading.Thread(target=call)
    t1.start(); t2.start(); t1.join(); t2.join()

    assert len(results) == 1, f"정확히 1개만 성공해야 함: results={results} errors={errors}"
    assert len(errors) == 1 and "왕관" in errors[0]

    p = U.get_user_by_id("u1")
    assert p["crowns"] == 0                       # 음수 아님, 정확히 소진
    sessions = p.get("battle_sessions") or {}
    assert len(sessions) == 1                       # 실패한 요청은 세션 생성 안 됨
