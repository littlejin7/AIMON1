"""
서버 권위 전투 세션 (A·B 어뷰징 방어)

기획 확정: 전투 클리어는 클라가 보낸 my_hp/boss_hp 가 아니라 **서버가 센 정답 누적**으로
결정한다. game.py 의 `_make_game_token` 과 동일한 패턴(HMAC 서명·만료·소유자)으로
/start 에서 배틀 토큰을 발급하고, 정답 누적·오답 누적을 user.battle_sessions[sid] 에
영속한다. /answer 는 서버 채점 결과로 세션 카운트를 올리고, 필요정답수(required) 도달
시에만 status="won" 으로 전환한다. 보상은 status=="won" 일 때만 허용한다.

클라가 보내는 my_hp/boss_hp 는 더 이상 권위가 없다 — 응답의 표시용 HP 는 서버 세션
카운트에서 파생한다.

저장 규칙(CLAUDE.md §1·§3): 세션 변형 헬퍼(create_session/apply_answer/consume_session)는
부수효과 없이 user dict 를 제자리 변경만 하고, 저장은 호출부의 `mutate_user_atomic`
임계구역이 책임진다. 가드(세션 존재·소유자·만료·status)는 항상 fresh user 기준으로
평가되어 동시 요청에도 이중 통과가 없다.

battle_sessions 는 신규 jsonb user 컬럼이다(CLAUDE.md §2 표 갱신 + save_user jsonb_cols 등록).
"""

import base64
import hashlib
import hmac
import json
import re
import secrets
from typing import Optional

from fastapi import HTTPException

from routers.utils import SECRET_KEY, now_kst

# 한 전투 세션의 최대 수명(초). 발급 후 이 시간 내 /answer·/clear 만 유효.
BATTLE_TOKEN_TTL = 1800  # 30분


# ── 토큰 (game.py _make_game_token 과 동일한 서명 규약) ───────────────────────

def _sign(raw: bytes) -> str:
    sig = hmac.new(SECRET_KEY.encode(), raw, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).decode().rstrip("=")


def make_battle_token(mode: str, unit: Optional[int], stage: Optional[str], user_id: str) -> tuple[str, str]:
    """배틀 토큰과 세션 id(sid)를 만든다. sid 는 server-generated nonce 라 위조 불가."""
    sid = secrets.token_urlsafe(12)
    payload = {
        "mode": mode,
        "unit": unit,
        "stage": stage,
        "user_id": user_id,
        "sid": sid,
        "ts": int(now_kst().timestamp()),
    }
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    body = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    return f"{body}.{_sign(raw)}", sid


def verify_battle_token(token: str, user_id: str, mode: str) -> dict:
    """토큰 서명·소유자·모드·만료를 검증하고 payload(dict)를 반환. 실패 시 400."""
    try:
        body, mac = token.split(".", 1)
        raw = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
        got = base64.urlsafe_b64decode(mac + "=" * (-len(mac) % 4))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid battle token")

    expected = hmac.new(SECRET_KEY.encode(), raw, hashlib.sha256).digest()
    if not hmac.compare_digest(expected, got):
        raise HTTPException(status_code=400, detail="Invalid battle token signature")

    payload = json.loads(raw.decode())
    if payload.get("user_id") != user_id or payload.get("mode") != mode:
        raise HTTPException(status_code=400, detail="Battle token mismatch")

    age = int(now_kst().timestamp()) - int(payload.get("ts", 0))
    if age < 0 or age > BATTLE_TOKEN_TTL:
        raise HTTPException(status_code=400, detail="Battle token expired")

    return payload


# ── 세션 상태 (user.battle_sessions[sid]) ────────────────────────────────────

def _sessions(u: dict) -> dict:
    sessions = u.get("battle_sessions")
    if not isinstance(sessions, dict):
        sessions = {}
    return sessions


def _prune(sessions: dict, now_ts: int) -> dict:
    """만료된 세션 제거 (user 객체 비대화 방지)."""
    return {
        sid: s for sid, s in sessions.items()
        if isinstance(s, dict) and isinstance(s.get("exp"), int) and s["exp"] > now_ts
    }


def _view(sess: dict) -> dict:
    """라우터로 돌려줄 세션 스냅샷 (표시용 HP 는 라우터가 자기 상수로 파생)."""
    return {
        "sid": sess.get("sid"),
        "correct": len(sess.get("correct_qids", [])),
        "wrong": int(sess.get("wrong", 0)),
        "required": int(sess.get("required", 0)),
        "max_wrong": int(sess.get("max_wrong", 0)),
        "status": sess.get("status", "active"),
    }


def create_session(u: dict, sid: str, mode: str, unit: Optional[int],
                   stage: Optional[str], required: int, max_wrong: int) -> None:
    """배틀 세션을 생성/초기화한다. (mutator 안에서 호출 — 제자리 변경)"""
    now_ts = int(now_kst().timestamp())
    sessions = _prune(_sessions(u), now_ts)
    sessions[sid] = {
        "sid": sid,
        "mode": mode,
        "unit": unit,
        "stage": stage,
        "required": int(required),
        "max_wrong": int(max_wrong),
        "correct_qids": [],   # 정답 처리된 distinct question_id (같은 문제 반복 정답 카운트 방지)
        "wrong": 0,
        "status": "active",
        "exp": now_ts + BATTLE_TOKEN_TTL,
    }
    u["battle_sessions"] = sessions


def apply_answer(u: dict, payload: dict, qid: str, is_correct: bool) -> dict:
    """서버 채점 결과(is_correct)로 세션 카운트를 갱신하고 스냅샷을 반환.

    - 정답: distinct qid 1건 누적 (같은 문제를 반복 정답해도 1회만 카운트 → 리플레이 방어)
    - 오답: wrong += 1
    - correct >= required → status="won"  /  wrong >= max_wrong → status="lost"
    이미 won/lost 인 세션은 멱등하게 현재 스냅샷만 반환(추가 변경 없음).
    세션 없음/만료 시 400.
    """
    now_ts = int(now_kst().timestamp())
    sessions = _prune(_sessions(u), now_ts)
    sid = payload.get("sid")
    sess = sessions.get(sid)
    if not sess:
        raise HTTPException(status_code=400, detail="전투 세션이 만료되었거나 존재하지 않습니다. 다시 시작해주세요.")

    if sess.get("status") in ("won", "lost"):
        u["battle_sessions"] = sessions  # prune 반영
        return _view(sess)

    correct_qids = sess.setdefault("correct_qids", [])
    if is_correct:
        if qid and qid not in correct_qids:
            correct_qids.append(qid)
    else:
        sess["wrong"] = int(sess.get("wrong", 0)) + 1

    if len(correct_qids) >= int(sess.get("required", 0)):
        sess["status"] = "won"
    elif int(sess.get("wrong", 0)) >= int(sess.get("max_wrong", 0)):
        sess["status"] = "lost"

    sessions[sid] = sess
    u["battle_sessions"] = sessions
    return _view(sess)


def get_session(u: dict, sid: str) -> Optional[dict]:
    """세션 스냅샷 조회 (만료분 prune 후). 없으면 None."""
    now_ts = int(now_kst().timestamp())
    sessions = _prune(_sessions(u), now_ts)
    u["battle_sessions"] = sessions
    sess = sessions.get(sid)
    return _view(sess) if sess else None


def consume_session(u: dict, sid: str) -> None:
    """클리어 보상 지급 후 세션을 제거한다. (mutator 안에서 호출)"""
    now_ts = int(now_kst().timestamp())
    sessions = _prune(_sessions(u), now_ts)
    sessions.pop(sid, None)
    u["battle_sessions"] = sessions


# ── 엔드보스 3-페이즈 세션 (phase1~2 HP 게이트 → phase3 승리) ──────────────────
# 엔드보스는 miniboss/unitboss 의 '정답 N개 누적 = 승리' 모델과 다르다:
#   phase1~2 는 보스 HP(정답으로 차감)·내 HP(오답으로 차감) 게이트이고, phase3 는
#   그 게이트를 통과(boss_hp<=0)한 뒤 정답 1개로 승리한다. 그래서 generic apply_answer
#   대신 페이즈를 아는 전용 apply 를 둔다. status: active → won / lost.
#
# 클리어 보상(endboss /clear)은 이 세션 status=="won" 일 때만 허용한다 — /answer 로
# phase3 를 실제로 맞혀야만 won 이 되므로, /clear 직접 호출로 보상 탈취가 불가능하다.

def create_endboss_session(u: dict, sid: str, level: str, project: str,
                           boss_hp_init: int, my_hp_init: int, phase3_max_tries: int) -> None:
    """엔드보스 전투 세션을 생성/초기화한다. (mutator 안에서 호출 — 제자리 변경)"""
    now_ts = int(now_kst().timestamp())
    sessions = _prune(_sessions(u), now_ts)
    sessions[sid] = {
        "sid": sid,
        "mode": "endboss",
        "level": level,
        "project": project,
        "boss_hp": int(boss_hp_init),
        "my_hp": int(my_hp_init),
        "correct_qids": [],            # phase1~2 distinct 정답 (같은 문제 반복 정답 → 보스 HP 이중 차감 방지)
        "phase3_tries": 0,
        "phase3_max_tries": int(phase3_max_tries),
        "phase3_unlocked": False,      # boss_hp<=0 도달 시 개방(=phase3 진입 허용). 승리 아님.
        "status": "active",
        "exp": now_ts + BATTLE_TOKEN_TTL,
    }
    u["battle_sessions"] = sessions


def _endboss_view(sess: dict) -> dict:
    """라우터로 돌려줄 엔드보스 세션 스냅샷 (표시용 HP 는 서버 세션이 소유)."""
    return {
        "sid": sess.get("sid"),
        "level": sess.get("level"),
        "project": sess.get("project"),
        "boss_hp": int(sess.get("boss_hp", 0)),
        "my_hp": int(sess.get("my_hp", 0)),
        "correct": len(sess.get("correct_qids", [])),
        "phase3_tries": int(sess.get("phase3_tries", 0)),
        "phase3_unlocked": bool(sess.get("phase3_unlocked", False)),
        "status": sess.get("status", "active"),
    }


def get_endboss_session(u: dict, sid: str) -> Optional[dict]:
    """엔드보스 세션 스냅샷 조회 (만료분 prune 후). 없으면 None."""
    now_ts = int(now_kst().timestamp())
    sessions = _prune(_sessions(u), now_ts)
    u["battle_sessions"] = sessions
    sess = sessions.get(sid)
    return _endboss_view(sess) if sess else None


def apply_endboss_answer(u: dict, payload: dict, qid: str, phase: int, is_correct: bool,
                         *, boss_hp_delta: int, my_hp_delta: int) -> dict:
    """서버 채점 결과(is_correct)로 엔드보스 세션을 갱신하고 스냅샷을 반환.

    phase 1~2:
      - 정답: distinct qid 1건당 boss_hp -= delta (같은 문제 반복 정답은 무카운트 → 리플레이 방어)
      - 오답: my_hp -= delta
      - my_hp<=0 → status="lost"  /  boss_hp<=0 → phase3_unlocked=True (승리 아님)
    phase 3:
      - phase3_unlocked 여야 유효(boss_hp<=0 게이트 통과 강제 — 우회 진입 차단)
      - 정답 → status="won"  /  오답 → phase3_tries+1, tries>=max → status="lost"
    이미 won/lost 인 세션은 멱등하게 현재 스냅샷만 반환. 세션 없음/만료 시 400.
    """
    now_ts = int(now_kst().timestamp())
    sessions = _prune(_sessions(u), now_ts)
    sid = payload.get("sid")
    sess = sessions.get(sid)
    if not sess:
        raise HTTPException(status_code=400, detail="전투 세션이 만료되었거나 존재하지 않습니다. 다시 시작해주세요.")

    if sess.get("status") in ("won", "lost"):
        u["battle_sessions"] = sessions  # prune 반영
        return _endboss_view(sess)

    if phase in (1, 2):
        correct_qids = sess.setdefault("correct_qids", [])
        if is_correct:
            if qid and qid not in correct_qids:
                correct_qids.append(qid)
                sess["boss_hp"] = max(0, int(sess.get("boss_hp", 0)) - int(boss_hp_delta))
        else:
            sess["my_hp"] = max(0, int(sess.get("my_hp", 0)) - int(my_hp_delta))

        if int(sess.get("my_hp", 0)) <= 0:
            sess["status"] = "lost"
        elif int(sess.get("boss_hp", 0)) <= 0:
            sess["phase3_unlocked"] = True
    else:
        # phase 3 — phase1~2 게이트(boss_hp<=0) 통과 후에만 유효. 우회 진입 시도 차단.
        if not sess.get("phase3_unlocked"):
            raise HTTPException(status_code=400, detail="아직 최종 관문에 진입할 수 없습니다.")
        if is_correct:
            sess["status"] = "won"
        else:
            sess["phase3_tries"] = int(sess.get("phase3_tries", 0)) + 1
            if sess["phase3_tries"] >= int(sess.get("phase3_max_tries", 3)):
                sess["status"] = "lost"

    sessions[sid] = sess
    u["battle_sessions"] = sessions
    return _endboss_view(sess)


# ── 객관식/단답 서버 채점 (boss·miniboss·attempts 공용) ──────────────────────

def grade_objective(user_answer: str, correct_answer: str) -> bool:
    """선택형/단답형 직접 채점. 기호만/전체텍스트 입력 모두 허용 (대소문자·공백 무시).

    boss.py 의 is_direct_match·miniboss.py 의 direct_grade 를 단일 구현으로 통합.
    code_input 등 비결정 채점(AI)이 필요한 유형에는 쓰지 않는다.
    """
    ua = (user_answer or "").strip()
    ca = (str(correct_answer) if correct_answer is not None else "").strip()
    if not ua:
        return False
    if ua == ca:
        return True
    if ua.lower() == ca.lower():
        return True
    # Choice UIs submit labels with the text ("A. p"), while some JSON answers
    # store only the answer text ("p"). Compare the text body as a fallback.
    option_label_re = re.compile(r"^[A-Ea-e][.)]\s+")
    ua_text = option_label_re.sub("", ua).strip()
    ca_text = option_label_re.sub("", ca).strip()
    if ua_text and ca_text:
        if ua_text == ca_text:
            return True
        if ua_text.lower() == ca_text.lower():
            return True
    # "A" vs "A. Bye" — 한쪽이 기호 1글자
    if len(ua) == 1 and ca.upper().startswith(ua.upper() + "."):
        return True
    if len(ca) == 1 and ua.upper().startswith(ca.upper() + "."):
        return True
    # "A. Bye" 처럼 앞 글자만 비교 (양쪽 첫 글자 기호 일치)
    if ua and ca and ua[0].upper() == ca.upper() and len(ca) == 1:
        return True
    return False
