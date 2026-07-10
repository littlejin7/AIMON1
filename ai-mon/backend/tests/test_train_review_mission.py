"""P0 회귀: d_review(review_done) 미션은 '실제 오답의 reviewed=False→True 전환'에서만 오른다.

이전 버그: POST /train/reviewed 가 일치하는 오답 기록이 없거나 이미 reviewed=true여도
무조건 bump_mission("review_done") 을 호출해, 존재하지 않는 question_id·타 유저
오답 ID·중복 호출로 d_review 진척이 부풀 수 있었다.

수정: mark_wrong_answer_reviewed(user_id, question_id) 가 wrong_answers 스토리지의
단일 임계구역(JSON 파일락)에서 '실제 전환 여부'를 원자적으로 판정해 반환하고,
train.py 는 그 값이 True 일 때만 미션을 올린다.
"""
import os
import sys
import json
import threading

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import routers.train as T
import routers.utils as U


def _seed(tmp_path, monkeypatch, wrong_answers, users=None):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "WRONG_ANSWERS_FILE", str(tmp_path / "wrong_answers.json"))
    users = users or [{
        "id": "u1", "xp": 0, "crowns": 0, "lv": 1, "character": "slime", "titles": [],
    }]
    U.save_users(users)
    (tmp_path / "wrong_answers.json").write_text(
        json.dumps(wrong_answers, ensure_ascii=False), encoding="utf-8",
    )


def _d_review(user_id="u1"):
    user = U.get_user_by_id(user_id)
    return (user.get("missions") or {}).get("daily", {}).get("progress", {}).get("d_review", 0)


def _reviewed_flags(question_id, user_id="u1"):
    wrong = U.load_wrong_answers()
    return [
        wa["reviewed"] for wa in wrong
        if wa.get("user_id") == user_id and wa.get("question_id") == question_id
    ]


def _call(question_id, user_id="u1"):
    return T.mark_question_reviewed(
        T.ReviewedRequest(question_id=question_id), user_ref={"id": user_id},
    )


# 1) reviewed=false인 실제 오답을 복습하면 d_review +1
def test_real_wrong_answer_review_increments_d_review(tmp_path, monkeypatch):
    _seed(tmp_path, monkeypatch, [
        {"id": "wa1", "user_id": "u1", "question_id": "q1", "reviewed": False},
    ])
    resp = _call("q1")
    assert resp == {"success": True}
    assert _d_review() == 1
    assert _reviewed_flags("q1") == [True]


# 2) 같은 문제를 다시 복습해도 추가 증가 없음
def test_reviewing_same_question_again_does_not_increment_again(tmp_path, monkeypatch):
    _seed(tmp_path, monkeypatch, [
        {"id": "wa1", "user_id": "u1", "question_id": "q1", "reviewed": False},
    ])
    _call("q1")
    assert _d_review() == 1
    resp = _call("q1")
    assert resp == {"success": True}   # 멱등 응답 계약 유지
    assert _d_review() == 1


# 3) 존재하지 않는 question_id는 증가 없음
def test_nonexistent_question_id_does_not_increment(tmp_path, monkeypatch):
    _seed(tmp_path, monkeypatch, [
        {"id": "wa1", "user_id": "u1", "question_id": "q1", "reviewed": False},
    ])
    resp = _call("q-does-not-exist")
    assert resp == {"success": True}
    assert _d_review() == 0


# 4) 다른 사용자의 오답 ID는 증가 없음
def test_other_users_wrong_answer_does_not_increment_and_is_untouched(tmp_path, monkeypatch):
    _seed(
        tmp_path, monkeypatch,
        [{"id": "wa2", "user_id": "u2", "question_id": "q1", "reviewed": False}],
        users=[
            {"id": "u1", "xp": 0, "crowns": 0, "lv": 1, "character": "slime", "titles": []},
            {"id": "u2", "xp": 0, "crowns": 0, "lv": 1, "character": "slime", "titles": []},
        ],
    )
    resp = _call("q1", user_id="u1")   # u1 이 u2 소유의 q1 오답 id를 시도
    assert resp == {"success": True}
    assert _d_review(user_id="u1") == 0
    assert _d_review(user_id="u2") == 0
    # u2 소유 레코드는 변경되지 않음(타 유저가 건드릴 수 없음)
    assert _reviewed_flags("q1", user_id="u2") == [False]


# 5) 동시 복습 요청 두 개에도 한 번만 증가
def test_concurrent_duplicate_review_requests_increment_once(tmp_path, monkeypatch):
    _seed(tmp_path, monkeypatch, [
        {"id": "wa1", "user_id": "u1", "question_id": "q1", "reviewed": False},
    ])

    results = []

    def call():
        results.append(_call("q1"))

    t1 = threading.Thread(target=call)
    t2 = threading.Thread(target=call)
    t1.start(); t2.start(); t1.join(); t2.join()

    assert results == [{"success": True}, {"success": True}]
    assert _d_review() == 1
    assert _reviewed_flags("q1") == [True]


# 6) 기존 오답 복습 응답 계약 유지 (모든 경로에서 {"success": True})
def test_response_contract_is_always_success_true(tmp_path, monkeypatch):
    _seed(tmp_path, monkeypatch, [
        {"id": "wa1", "user_id": "u1", "question_id": "q1", "reviewed": False},
    ])
    assert _call("q1") == {"success": True}                 # 실제 전환
    assert _call("q1") == {"success": True}                 # 이미 리뷰됨(멱등)
    assert _call("no-such-question") == {"success": True}   # 존재하지 않음
