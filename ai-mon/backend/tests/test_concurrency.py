"""C-1 동시성 회귀 테스트.

mutate_user_atomic 표준 원자 쓰기 경로가 게임 보상의 check-then-act(nonce 소비·
일일 캡)를 저장과 같은 임계구역에서 평가하는지 검증한다. (JSON 모드)

- 동일 토큰 동시 /game/clear 2회 → 정확히 1회만 지급(나머지는 nonce 거부)
- 서로 다른 토큰 2개(정상 2판) → 둘 다 지급, 카운터 원자적
"""
import sys
import os
import json
import threading
import base64
import hmac
import hashlib

import pytest

# Add backend directory to python path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

# 앱 모듈 import 전에 필수 환경변수 보장 (utils 가 기동 시 SECRET_KEY 를 강제함)
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

from fastapi import HTTPException
from routers import utils as U
from routers import game as G
from routers import mission as MI
from routers.utils import today_kst, iso_week


def _make_token(game_id: str, user_id: str, ts: int, nonce: str) -> str:
    """game.py 와 동일한 형식의 HMAC 서명 토큰 생성 (테스트용, ts 조작 가능)."""
    payload = {"game_id": game_id, "user_id": user_id, "ts": ts, "nonce": nonce}
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig = hmac.new(U.SECRET_KEY.encode(), raw, hashlib.sha256).digest()
    body = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    mac = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{body}.{mac}"


def _read_user(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)[0]


@pytest.fixture
def temp_user(monkeypatch, tmp_path):
    """실제 데이터 파일을 건드리지 않도록 USERS_FILE 을 임시 파일로 리디렉트.
    다른 테스트 모듈이 먼저 utils 를 import 해 USE_SUPABASE=True 로 고정될 수 있으므로
    명시적으로 False 패치.
    """
    users_file = tmp_path / "users.json"
    users_file.write_text(
        json.dumps([{
            "id": "u1", "xp": 0, "crowns": 0, "lv": 1,
            "character": "slime", "titles": [], "game_rewards": {},
        }]),
        encoding="utf-8",
    )
    monkeypatch.setattr(U, "USERS_FILE", str(users_file))
    monkeypatch.setattr(U, "USE_SUPABASE", False)
    return str(users_file)


def test_same_token_concurrent_clear_grants_once(temp_user):
    """동일 토큰 동시 /game/clear 2회 → 1회만 지급, 나머지는 nonce 거부."""
    past = int(U.now_kst().timestamp()) - 100  # 최소 경과시간(elapsed floor) 통과
    token = _make_token("runner", "u1", past, "NONCE-SAME")

    results, errors = [], []

    def call():
        req = G.GameClearRequest(game_id="runner", distance=600, game_token=token)
        try:
            results.append(G.game_clear(req, {"id": "u1"}))
        except HTTPException as e:
            errors.append(e.detail)

    t1 = threading.Thread(target=call)
    t2 = threading.Thread(target=call)
    t1.start(); t2.start(); t1.join(); t2.join()

    # 정확히 한 번만 보상, 다른 한 번은 nonce 이미 사용 거부
    assert len(results) == 1, f"expected 1 reward, got {results}"
    assert results[0]["xp_awarded"] == 350
    assert len(errors) == 1 and "already used" in errors[0]

    # 영속 상태에 이중 가산 없음
    u = _read_user(temp_user)
    assert u["xp"] == 350
    assert u["game_rewards"]["runner_today_count"] == 1


def test_two_distinct_tokens_both_grant(temp_user):
    """서로 다른 토큰 2개(정상 2판) → 둘 다 지급, 카운터 원자적."""
    past = int(U.now_kst().timestamp()) - 100
    ta = _make_token("runner", "u1", past, "NONCE-A")
    tb = _make_token("runner", "u1", past, "NONCE-B")

    results, errors = [], []

    def call(tk):
        req = G.GameClearRequest(game_id="runner", distance=600, game_token=tk)
        try:
            results.append(G.game_clear(req, {"id": "u1"}))
        except HTTPException as e:
            errors.append(e.detail)

    t1 = threading.Thread(target=call, args=(ta,))
    t2 = threading.Thread(target=call, args=(tb,))
    t1.start(); t2.start(); t1.join(); t2.join()

    # 서로 다른 세션이므로 둘 다 지급
    assert len(results) == 2 and errors == [], f"results={results} errors={errors}"
    u = _read_user(temp_user)
    assert u["xp"] == 700
    assert u["game_rewards"]["runner_today_count"] == 2


# ─────────────────────── M-1: 미션 claimed 동시성 무결성 ───────────────────────
# 보스/엔드보스/미니보스/소셜로그인/ai-feedback 의 미션 쓰기를 mutate_user_atomic 으로
# 전환한 효과를 검증. 동시 claim / 동시 이벤트 쓰기에서 claimed 가 유실(=재수령)되지
# 않아야 한다. (전환 전 save_user delta-merge 경로에서는 missions 가 덮어써졌음)

@pytest.fixture
def mission_user(monkeypatch, tmp_path):
    """d_quiz3 완료(progress=3)·미수령 상태의 유저를 임시 파일에 준비."""
    users_file = tmp_path / "users.json"
    users_file.write_text(
        json.dumps([{
            "id": "u1", "xp": 0, "crowns": 0, "lv": 1,
            "character": "slime", "titles": [],
            "missions": {
                "daily":  {"date": today_kst(), "progress": {"d_quiz3": 3}, "claimed": []},
                "weekly": {"week": iso_week(), "progress": {}, "claimed": [], "login_days": []},
            },
        }]),
        encoding="utf-8",
    )
    monkeypatch.setattr(U, "USERS_FILE", str(users_file))
    monkeypatch.setattr(U, "USE_SUPABASE", False)
    return str(users_file)


def test_concurrent_double_claim_grants_once(mission_user):
    """동일 완료 미션을 동시 2회 claim → 정확히 1회만 보상(재수령 없음). (M-1)"""
    results, errors = [], []

    def call():
        try:
            results.append(MI.claim_mission(MI.ClaimRequest(mission_id="d_quiz3"), {"id": "u1"}))
        except HTTPException as e:
            errors.append(e.detail)

    t1 = threading.Thread(target=call)
    t2 = threading.Thread(target=call)
    t1.start(); t2.start(); t1.join(); t2.join()

    granted = [r for r in results if r.get("xp_awarded", 0) > 0]
    already = [r for r in results if r.get("already_claimed")]
    assert len(granted) == 1, f"expected exactly 1 reward, results={results} errors={errors}"
    assert granted[0]["xp_awarded"] == 300
    assert len(already) == 1, f"expected 1 already_claimed, results={results}"

    u = _read_user(mission_user)
    assert u["xp"] == 300                                        # 이중 지급 없음
    assert u["missions"]["daily"]["claimed"].count("d_quiz3") == 1


def test_claim_survives_concurrent_event(mission_user):
    """claim 과 다른 미션 이벤트(stage_clear bump)가 동시 실행돼도 claimed 가
    유실되지 않고(재수령 불가) 이벤트 진척도 보존된다. (M-1 핵심 증거)"""
    from routers.missions_core import bump_mission

    def do_claim():
        try:
            MI.claim_mission(MI.ClaimRequest(mission_id="d_quiz3"), {"id": "u1"})
        except HTTPException:
            pass

    def do_event():
        # progress.py 가 mutator 안에서 하는 것과 동일한 미션 쓰기
        def mutator(u):
            bump_mission(u, "stage_clear")
            return None
        U.mutate_user_atomic("u1", mutator)

    t1 = threading.Thread(target=do_claim)
    t2 = threading.Thread(target=do_event)
    t1.start(); t2.start(); t1.join(); t2.join()

    u = _read_user(mission_user)
    # 이벤트 쓰기가 claim 의 claimed 를 덮어쓰지 않음
    assert "d_quiz3" in u["missions"]["daily"]["claimed"]
    assert u["xp"] == 300
    # 이벤트 진척도 보존 (goal=3 상한 유지)
    assert u["missions"]["daily"]["progress"]["d_quiz3"] == 3

    # 사후 재claim → 이미 받음 (재수령 없음)
    r = MI.claim_mission(MI.ClaimRequest(mission_id="d_quiz3"), {"id": "u1"})
    assert r["already_claimed"] is True
    assert _read_user(mission_user)["xp"] == 300


# ─────────── M-4: 유닛보스 보상 동시 이중 제출 → 정확히 1회 지급 ───────────
# 보상 중복가드를 progress(별도 스토리지)에서 user 컬럼 unitboss_cleared_units 로 이전한
# 효과 검증. '검사→지급→append' 가 mutate_user_atomic 임계구역 안에서 원자적이라
# 동시 제출에도 XP(+3000)·왕관(+1)이 정확히 1회만 지급돼야 한다.
import asyncio
import copy
from types import SimpleNamespace
from starlette.requests import Request
from routers import boss as B
from routers.battle_session import make_battle_token, BATTLE_TOKEN_TTL

# 직접일치(객관식) 채점 경로 → Claude 호출 없이 is_correct=True.
# 클리어 판정은 클라 boss_hp 가 아니라 '서버 세션 정답 누적'이 required 도달 시 → won.
# 테스트는 required=1 세션을 시드해 1정답에 won 되도록 한다(동시성 이중지급 가드 검증 목적).
_UNITBOSS_Q = {
    "question_id": "ub2", "question": "다음 중 옳은 것은?", "quiz_category": "unit_boss",
    "type": "multiple_choice", "answer": "A", "unit": 2, "stage": "2-boss",
    "feedback": {"correct": "정답"},
}


def _seed_session(unit=2, user_id="u1", required=1):
    """배틀 토큰 + (required 도달 직전) 세션 dict 를 만든다. 1정답에 won 되도록 required=1."""
    token, sid = make_battle_token("unitboss", unit, None, user_id)
    now_ts = int(U.now_kst().timestamp())
    sessions = {sid: {
        "sid": sid, "mode": "unitboss", "unit": unit, "stage": None,
        "required": required, "max_wrong": 3, "correct_qids": [], "wrong": 0,
        "status": "active", "exp": now_ts + BATTLE_TOKEN_TTL,
    }}
    return token, sessions


def _boss_req(token):
    # my_hp/boss_hp 는 더 이상 받지 않는다(클라 권위 제거). battle_token 으로 서버 세션 식별.
    return B.BossAnswerRequest(question_id="ub2", user_answer="A",
                               battle_token=token, unit=2)


def _fake_request():
    return Request({
        "type": "http", "method": "POST", "path": "/boss/answer",
        "headers": [], "query_string": b"", "client": ("127.0.0.1", 1234),
    })


def _call_boss(token):
    """submit_boss_answer(async) 를 동기 호출."""
    return asyncio.run(B.submit_boss_answer(
        _fake_request(), _boss_req(token), {"id": "u1", "course_level": "beginner"}
    ))


@pytest.fixture
def unitboss_user(monkeypatch, tmp_path):
    token, sessions = _seed_session()
    users_file = tmp_path / "users.json"
    users_file.write_text(
        json.dumps([{
            "id": "u1", "xp": 0, "crowns": 0, "lv": 1, "character": "slime",
            "titles": [], "ai_feedback_count": 0, "course_level": "beginner",
            "completed_units": {"beginner": 0, "intermediate": 0, "advanced": 0},
            "max_unlocked_unit": {"beginner": 1, "intermediate": 1, "advanced": 1},
            "unitboss_cleared_units": [],
            "battle_sessions": sessions,
        }]),
        encoding="utf-8",
    )
    progress_file = tmp_path / "progress.json"
    progress_file.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(U, "USERS_FILE", str(users_file))
    monkeypatch.setattr(U, "PROGRESS_FILE", str(progress_file))
    monkeypatch.setattr(U, "USE_SUPABASE", False)
    monkeypatch.setattr(U.limiter, "enabled", False)          # 레이트리밋 우회
    monkeypatch.setattr(B, "load_questions_by_category", lambda *a, **k: [_UNITBOSS_Q])
    return str(users_file), token


def test_unitboss_concurrent_double_submit_grants_once_json(unitboss_user):
    """JSON(file_lock): 동시 유닛보스 제출 2회 → XP·왕관 정확히 1회.

    같은 배틀 토큰으로 동시 2회 제출. 첫 제출이 세션을 won(required=1) + 보상지급하고
    unitboss_cleared_units 에 기록하면, 둘째는 fresh 상태에서 이미 won/cleared 라 무지급.
    """
    users_file, token = unitboss_user
    results, errors = [], []

    def call():
        try:
            results.append(_call_boss(token))
        except Exception as e:  # noqa
            errors.append(repr(e))

    t1 = threading.Thread(target=call)
    t2 = threading.Thread(target=call)
    t1.start(); t2.start(); t1.join(); t2.join()

    assert errors == [], f"errors={errors}"
    granted = [r for r in results if r.get("xp_awarded") == 3000]
    assert len(granted) == 1, f"보상이 정확히 1회가 아님: {[r.get('xp_awarded') for r in results]}"
    assert granted[0]["crowns_awarded"] == 1

    u = _read_user(users_file)
    assert u["xp"] == 3000, f"XP 이중 지급: {u['xp']}"
    assert u["crowns"] == 1, f"왕관 이중 지급: {u['crowns']}"
    assert u["unitboss_cleared_units"] == ["beginner-2"]
    assert u["completed_units"]["beginner"] == 1


class _FakeCASClient:
    """Supabase optimistic-concurrency(version CAS) 가짜 클라이언트.
    users 단일 행 store + version 검사. stale_queue 에 넣어둔 스냅샷으로
    '형제 요청이 커밋하기 전에 읽은 stale 상태' 를 결정적으로 재현한다.
    progress 테이블은 빈 결과/no-op."""
    def __init__(self, user: dict):
        self.user = user
        self.stale_queue = []

    def table(self, name):
        return _FakeCASTable(self, name)


class _FakeCASTable:
    def __init__(self, sb, name):
        self.sb = sb; self.name = name
        self._mode = None; self._payload = None; self._eqs = {}

    def select(self, *a, **k): self._mode = "select"; return self
    def update(self, obj): self._mode = "update"; self._payload = obj; return self
    def upsert(self, obj): self._mode = "upsert"; self._payload = obj; return self
    def eq(self, col, val): self._eqs[col] = val; return self

    def execute(self):
        if self.name == "progress":
            return SimpleNamespace(data=[] if self._mode == "select" else [self._payload])
        # users
        if self._mode == "select":
            if self.sb.stale_queue:
                return SimpleNamespace(data=[dict(self.sb.stale_queue.pop(0))])
            return SimpleNamespace(data=[dict(self.sb.user)])
        if self._mode == "update":
            if self._eqs.get("version") == self.sb.user.get("version", 0):
                merged = {**self.sb.user, **self._payload, "id": "u1"}
                self.sb.user = merged
                return SimpleNamespace(data=[dict(merged)])
            return SimpleNamespace(data=[])   # CAS 충돌 → 재시도 유발
        return SimpleNamespace(data=[self._payload])


def test_unitboss_concurrent_double_submit_grants_once_supabase(monkeypatch):
    """Supabase(가짜 CAS): 두 요청이 같은 stale 상태를 읽어도 CAS 가 1개만 커밋,
    패자는 재시도→이미 지급 확인→무지급. XP·왕관 정확히 1회."""
    token, sessions = _seed_session()
    store = {
        "id": "u1", "version": 0, "xp": 0, "crowns": 0, "lv": 1,
        "character": "slime", "titles": [], "ai_feedback_count": 0,
        "course_level": "beginner",
        "completed_units": {"beginner": 0, "intermediate": 0, "advanced": 0},
        "max_unlocked_unit": {"beginner": 1, "intermediate": 1, "advanced": 1},
        "unitboss_cleared_units": [],
        "battle_sessions": sessions,
    }
    fake = _FakeCASClient(store)
    monkeypatch.setattr(U, "USE_SUPABASE", True)
    monkeypatch.setattr(U, "supabase", fake)
    monkeypatch.setattr(U.limiter, "enabled", False)
    monkeypatch.setattr(B, "load_questions_by_category", lambda *a, **k: [_UNITBOSS_Q])

    # 첫 제출 전의 stale 스냅샷(v0, 미지급·세션 active) — 둘째 제출의 첫 CAS 시도가 이걸 읽게 한다.
    # battle_sessions 가 중첩 dict 이므로 deepcopy 로 독립 스냅샷을 떠야 한다(공유 ref 변형 방지).
    stale_v0 = copy.deepcopy(store)

    r1 = _call_boss(token)                  # 정상 커밋 → store v1, 보상 지급(세션 won)
    fake.stale_queue.append(stale_v0)       # 둘째 요청이 '커밋 전 stale' 을 읽도록 주입
    r2 = _call_boss(token)                   # 첫 CAS 시도(stale) 실패 → 재시도 → 이미 지급 → 무지급

    assert r1["xp_awarded"] == 3000 and r1["crowns_awarded"] == 1
    assert r2["xp_awarded"] == 0 and r2["crowns_awarded"] == 0, "CAS 패자가 이중 지급됨"
    assert fake.user["xp"] == 3000, f"XP 이중 지급: {fake.user['xp']}"
    assert fake.user["crowns"] == 1, f"왕관 이중 지급: {fake.user['crowns']}"
    assert fake.user["unitboss_cleared_units"] == ["beginner-2"]
    assert fake.user["completed_units"]["beginner"] == 1


def test_unitboss_legacy_progress_no_double_grant(unitboss_user, monkeypatch):
    """레거시 호환: 과거 progress 가드로 이미 클리어된 유저(progress.is_completed=True,
    unitboss_cleared_units 비어있음)가 재제출해도 재지급 없이 컬럼만 백필."""
    users_file, token = unitboss_user
    # progress 에 '2-boss' 완료 레코드를 미리 심는다(과거 세션에서 클리어한 상태 재현).
    progress_file = os.path.join(os.path.dirname(users_file), "progress.json")
    with open(progress_file, "w", encoding="utf-8") as f:
        json.dump([{
            "id": "p1", "user_id": "u1", "unit": 2, "stage": "2-boss",
            "score": 100, "is_completed": True, "course_level": "beginner",
        }], f)

    r = _call_boss(token)
    assert r["xp_awarded"] == 0 and r["crowns_awarded"] == 0, "레거시 유저 재지급됨"
    u = _read_user(users_file)
    assert u["xp"] == 0 and u["crowns"] == 0
    assert u["unitboss_cleared_units"] == ["beginner-2"], "백필 안 됨(멱등 가드 기록)"


# ───────── /boss/start 진입 비용 차감 동시성 (save_user→mutate_user_atomic) ─────────
# /start 의 왕관/무료 횟수 차감을 mutate_user_atomic 임계구역으로 옮긴 효과 검증.
# 동시 진입 시 read→check→write race 없이 정확히 차감되거나 잔액 부족분이 정확히 차단돼야 한다.
# (전환 전 save_user delta-merge 경로에서는 두 요청이 같은 잔액을 읽어 가드가 이중 통과 가능)
_START_Q = {"question_id": "sq1", "question": "Q", "type": "multiple_choice",
            "answer": "A", "unit": 1, "stage": "1-boss"}


@pytest.fixture
def start_user_factory(monkeypatch, tmp_path):
    """USERS_FILE 을 임시 파일로 리디렉트하고 진입 비용 필드로 유저를 준비한다.
    last_free_attempt_date 를 오늘로 세팅해 일일 리셋이 무료 횟수를 되돌리지 않게 한다."""
    users_file = tmp_path / "users.json"
    progress_file = tmp_path / "progress.json"
    today = U.now_kst().strftime("%Y-%m-%d")
    monkeypatch.setattr(U, "USERS_FILE", str(users_file))
    monkeypatch.setattr(U, "PROGRESS_FILE", str(progress_file))
    monkeypatch.setattr(U, "USE_SUPABASE", False)
    monkeypatch.setattr(B, "load_questions_by_category", lambda *a, **k: [_START_Q])

    # unit1(7스테이지) 전 스테이지 완료 시드 → assert_boss_access 진행도 조건 충족
    progress_file.write_text(json.dumps([
        {"user_id": "u1", "unit": 1, "stage": f"1-{i}",
         "is_completed": True, "course_level": "beginner"}
        for i in range(1, 8)
    ]), encoding="utf-8")

    def _make(**fields):
        user = {
            "id": "u1", "xp": 0, "lv": 1, "crowns": 0, "character": "slime",
            "course_level": "beginner", "daily_free_attempts": 0,
            "last_free_attempt_date": today, "seen_questions": {},
            "is_level_tested": True,
            "max_unlocked_unit": {"beginner": 99},
        }
        user.update(fields)
        users_file.write_text(json.dumps([user]), encoding="utf-8")
        return user

    return _make, str(users_file)


# 진입 게이트는 동시성 검증과 직교 → 핸들러에 넘기는 인라인 유저도 게이트를 통과시킨다.
_GATE_PASS = {"is_level_tested": True, "max_unlocked_unit": {"beginner": 99}}


def _start_concurrently(n=2):
    """start_boss_battle 를 n개 스레드로 동시 호출. (성공 결과들, 에러 detail들) 반환."""
    results, errors = [], []

    def call():
        try:
            results.append(B.start_boss_battle(
                unit="1", user={"id": "u1", "course_level": "beginner", **_GATE_PASS}))
        except HTTPException as e:
            errors.append((e.status_code, e.detail))

    threads = [threading.Thread(target=call) for _ in range(n)]
    for t in threads: t.start()
    for t in threads: t.join()
    return results, errors


def test_start_concurrent_two_crowns_deducts_exactly_two(start_user_factory):
    """무료 0 + 왕관 2, 동시 진입 2회 → 둘 다 성공, 왕관 정확히 0 (이중 통과 없음)."""
    make, uf = start_user_factory
    make(daily_free_attempts=0, crowns=2)

    results, errors = _start_concurrently(2)

    assert errors == [], f"동시 진입에서 차단 발생: {errors}"
    assert len(results) == 2, f"두 요청 모두 성공해야 함: {results}"
    u = _read_user(uf)
    assert u["crowns"] == 0, f"왕관이 정확히 2 차감되지 않음: {u['crowns']}"


def test_start_concurrent_one_crown_blocks_the_loser(start_user_factory):
    """무료 0 + 왕관 1, 동시 진입 2회 → 정확히 1개만 성공, 나머지 400. 왕관 0 (음수 방지)."""
    make, uf = start_user_factory
    make(daily_free_attempts=0, crowns=1)

    results, errors = _start_concurrently(2)

    assert len(results) == 1, f"정확히 1개만 성공해야 함: results={results} errors={errors}"
    assert len(errors) == 1 and errors[0][0] == 400, f"패자는 400 차단이어야 함: {errors}"
    assert "왕관" in errors[0][1]
    u = _read_user(uf)
    assert u["crowns"] == 0, f"왕관 잔액이 0이 아님(음수/이중차감): {u['crowns']}"


def test_start_concurrent_two_free_attempts(start_user_factory):
    """무료 2 + 왕관 0, 동시 진입 2회 → 둘 다 성공, 무료 0·왕관 0 (왕관 미사용)."""
    make, uf = start_user_factory
    make(daily_free_attempts=2, crowns=0)

    results, errors = _start_concurrently(2)

    assert errors == [], f"무료 2회 있는데 차단됨: {errors}"
    assert len(results) == 2
    u = _read_user(uf)
    assert u["daily_free_attempts"] == 0, f"무료 횟수가 정확히 2 차감되지 않음: {u['daily_free_attempts']}"
    assert u["crowns"] == 0, "무료가 남아있는데 왕관이 차감됨"
