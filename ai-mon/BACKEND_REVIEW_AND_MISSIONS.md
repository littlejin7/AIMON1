---
title: AI-MON 백엔드 리뷰 & 데일리/위클리 미션 설계
author: 팀장 리뷰 (지혜원)
date: 2026-06-24
---

# AI-MON 백엔드 리뷰 & 미션 시스템 설계

> 코드 정독 기준: `backend/main.py`, `routers/*`, `services/*`, `scheduler.py`, 설계문서 4종.
> 심각도: 🔴 즉시 / 🟠 다음 스프린트 / 🟡 리팩토링 백로그

---

## A. 한눈에 보는 우선순위 (TL;DR)

| # | 항목 | 심각도 | 분류 |
|---|---|---|---|
| 1 | `SECRET_KEY` 하드코딩 폴백 (`aimon-dev-secret-key`) | 🔴 | 보안 |
| 2 | 비밀번호 재설정 6자리 코드 brute-force (rate limit 없음) | 🔴 | 보안 |
| 3 | `/code/*` Claude 호출 rate limit 없음 → API 비용 폭탄 | 🔴 | 보안/비용 |
| 4 | 게임 보상 클라이언트 `distance` 무검증 → XP 어뷰징 | 🔴 | 무결성 |
| 5 | read-modify-write 동시성 (lost update) | 🟠 | 동시성 |
| 6 | XP·카운터 다중 가산 + serialize 재계산 드리프트 | 🟠 | 무결성 |
| 7 | AI 채점 실패 시 유저 오답 처리(HP 손실) | 🟠 | 견고성 |
| 8 | wrong_answers 스키마 ↔ Supabase 테이블 불일치 | 🟠 | 마이그레이션 |
| 9 | 캐릭터 진화/레벨업 로직 5곳 복붙 | 🟡 | 구조 |
| 10 | 정적 문제 JSON 매 요청 디스크 재로드 | 🟡 | 성능 |

---

## B. 보안 (Security)

### 🔴 B-1. JWT SECRET_KEY 하드코딩 폴백
`utils.py:27`
```python
SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
```
환경변수 미설정 시 누구나 토큰을 위조해 **임의 유저로 로그인** 가능. 운영에서 가장 위험.
- 조치: 폴백 제거하고 미설정 시 **기동 실패(raise)** 처리. 최소 32바이트 랜덤 키. `.env`는 이미 `.gitignore`에 있는지 재확인.

### 🔴 B-2. 비밀번호 재설정 코드 brute-force
`auth.py:246 reset_password` — 6자리 숫자(100만 경우의 수) 토큰인데 **rate limit·시도 횟수 제한 없음**. 10분 안에 자동화로 전수 대입 가능.
- 조치: `/auth/reset-password`, `/auth/forgot-password`에 `@limiter.limit` 적용 (예: `5/hour` per IP+email). 토큰을 6자리 숫자 대신 URL-safe 32자 토큰으로, 실패 N회 시 토큰 무효화.

### 🔴 B-3. `/code/submit`·`/code/hint`·일부 보스 힌트 rate limit 누락
Claude를 호출하는 엔드포인트 중 `code.py`의 두 핸들러는 limiter가 없음. 로그인만 하면 무한 호출 → **Anthropic 비용 폭탄**.
- 조치: Claude 호출 모든 핸들러에 limiter 일괄 적용. 입력 길이 제한(`code`, `user_answer` 예: 4000자) 추가 — 토큰 비용 + 프롬프트 인젝션 방어.

### 🔴 B-4. 미니게임 보상 클라이언트 신뢰
`game.py:94` runner는 클라이언트가 보낸 `distance`로 XP 차등 지급, 검증 없음. `distance=99999` 보내면 매번 최대 XP, 하루 5회. aipang도 결과 무검증 왕관 1개.
- 조치: 서버가 게임 세션 토큰(start 시 발급) + 합리적 상한/속도 검증을 두거나, 최소한 distance 상한·일일 XP 캡을 서버에서 강제.

### 🟠 B-5. forgot-password 이메일 폭탄
rate limit 없어 타인 이메일로 무한 발송 가능(SendGrid 비용 + 스팸). B-2와 함께 처리.

### 🟠 B-6. 소셜 OAuth 외부 호출 타임아웃 없음
`auth.py` google/naver/kakao의 `requests.post/get`에 `timeout` 없음 → 외부 지연 시 워커 점유. Claude 호출도 동일.
- 조치: 모든 외부 호출에 `timeout=(3, 10)`. 가능하면 동기 `requests` 대신 `httpx`(이미 의존성에 있음) 비동기.

### 🟡 B-7. access token 폐기 불가
`logout`은 refresh token만 삭제. access(30분)는 만료까지 유효 — MVP 허용 가능하나, 강제 로그아웃/밴 시나리오에선 토큰 블랙리스트나 token_version 필요.

### 🟡 B-8. PII 로그 노출
`user.py:51,65` `print("PATCH /user/me payload", ...)` 가 닉네임 등 페이로드를 stdout에. 운영 로그 제거 + 구조적 로깅(logging 모듈) 도입.

---

## C. 데이터 무결성 & 동시성

### 🟠 C-1. Read-Modify-Write 경합 (lost update)
거의 모든 핸들러가 `get_user_by_id → 객체 수정 → save_user` 패턴. JSON 모드의 `file_lock`은 **파일 쓰기 순간만** 보호하고 read→modify→write 전체 트랜잭션은 보호하지 못함. Supabase 모드의 `upsert(전체 객체)`도 동일하게 **마지막 쓰기 승리**.
- 시나리오: 보스 클리어 응답과 게임 보상이 거의 동시 도착 → 한쪽 XP/왕관 증가분 유실.
- 조치(JSON): save_user를 "락 안에서 재로드→해당 필드만 갱신→저장"으로. (Supabase): 카운터성 컬럼은 upsert 대신 원자적 증가(RPC/`update ... set xp = xp + n`) 또는 낙관적 락(version 컬럼).

### 🟠 C-2. XP·카운터 다중 가산 + 재계산 드리프트
`completed_stages`, `boss_cleared`가 login/progress/boss/miniboss 여러 곳에서 `+1` 되는 동시에 `serialize_user`에서 progress 기반으로 다시 계산해 `max()` 보정. 저장값과 계산값이 어긋날 수밖에 없는 구조.
- 조치: **단일 진실 공급원(SSOT)** 결정. progress 테이블을 진실로 삼고 카운터는 항상 파생(serialize에서만 계산)하거나, 반대로 카운터만 쓰고 재계산 제거. 둘 다 쓰지 말 것.

### 🟠 C-3. 유닛 완료/왕관 판정 취약점
`progress.py:96~116` 총 스테이지 수를 `lessons.json.stages`에서 읽되 없으면 문제데이터로 추정, 실패 시 **하드코딩 7**. 현재 lessons.json은 `boss_stage: null`, unit별 stages가 6/7 등 제각각 → 폴백 7이 걸리면 6스테이지 유닛은 왕관이 **영원히 미지급**.
- 조치: lessons 데이터에 stages/boss_stage 정합성 보장 + 폴백 상수 제거(데이터 없으면 에러 로깅).

### 🟠 C-4. wrong_answers 스키마 불일치 (마이그레이션 블로커)
코드가 저장하는 필드: `feedback, ai_explanation, reviewed, timestamp`.
마이그레이션 플랜의 테이블 컬럼: `question, correct_answer, course_level` (서로 안 맞음). `reviewed`/`ai_explanation`가 없으면 `/train` 복습 플로우가 깨짐.
- 조치: 실제 코드 기준으로 테이블 DDL 재작성 후 컷오버.

### 🟡 C-5. 날짜/타임존 혼용
`created_at`은 UTC(`utcnow().isoformat()`), streak·일일리셋은 KST(`utcnow()+9h`). 한 객체 안에 두 기준 공존 → 통계·정렬 시 버그 소지. `now_kst()` 헬퍼로 통일하고 저장은 timezone-aware ISO로.

---

## D. 견고성 & 에러 처리

### 🟠 D-1. AI 채점 실패가 유저 패널티로 직결
`claude_service.ask_claude_json`은 파싱/네트워크 실패 시 `{is_correct: False, score: 0}` 반환. `boss.py`는 이를 그대로 받아 **내 HP -350**. Claude 일시 장애 = 유저가 부당하게 진다.
- 조치: AI 실패와 "오답"을 구분하는 플래그(`grading_failed`)를 두고, 실패 시 HP 차감 보류 + 재시도 안내. 채점은 가능하면 정답 직접매칭을 우선(이미 일부 적용됨)하고 AI는 보조로.

### 🟠 D-2. 광범위한 `except: pass`
`serialize_user`, ai-feedback 칭호 가산 등에서 예외를 통째로 삼킴 → 장애를 조용히 숨김. 최소한 `logger.exception` 남기기.

### 🟡 D-3. `@app.on_event` deprecated
FastAPI 0.111 기준 `startup/shutdown` 이벤트는 lifespan 컨텍스트로 이전 권장. 스케줄러 시작/종료를 lifespan으로.

### 🟡 D-4. endboss 칭호 영속화 검증 필요
`endboss.py`는 `CLEAR_TITLES`(titles.py와 별도 dict)로 rookie/ace/ai_master를 다루는데, 이 id들이 실제 `user["titles"]`에 append되어 저장되는지 확인 필요(미저장이면 칭호 미획득). titles.py `TITLE_DEFINITIONS`엔 이 3종이 없어 `check_and_award_titles` 경로로는 절대 안 들어감.

---

## E. 구조 / 유지보수 / 성능

### 🟡 E-1. 진화·레벨업 로직 5중 복붙
slime→robot→speech_bubble→final_ghost 블록이 login/progress/boss/miniboss/social에 그대로 반복. 규칙 바뀌면 5곳 수정.
- 조치: `apply_xp(user, amount) -> dict(events)` 헬퍼 하나로. XP 가산·레벨 재계산·진화·칭호 트리거를 캡슐화.

### 🟡 E-2. 정적 콘텐츠 매 요청 디스크 I/O
`load_questions_by_category`, `code.find_question`(전 카테고리·전 유닛 순회)이 요청마다 파일을 다시 읽음. 문제 JSON은 불변 → 기동 시 메모리 캐시(`@lru_cache` 또는 dict) 권장. find_question은 question_id 인덱스 맵으로 O(1).

### 🟡 E-3. 인증 헬퍼 이원화
`get_current_user` vs `verify_token + get_user_by_id`가 섞임. FastAPI `Depends(get_current_user)`로 통일하면 핸들러 보일러플레이트 제거 + Authorization 누락 처리 일관화.

### 🟡 E-4. 의존성/환경
`requirements.txt`엔 supabase==2.31.0 있으나 마이그레이션 문서는 2.4.0로 불일치. bcrypt==3.2.0 + passlib 1.7.4 조합은 최신 환경에서 경고 발생 가능 — 버전 정합성 점검.

### 🟡 E-5. 테스트 부재
보상·진화·왕관·동시성 같은 핵심 비즈니스 로직에 자동화 테스트가 없음. 최소 pytest로 progress/boss 보상 회귀 테스트부터.

---

## F. 권장 처리 순서 (스프린트 제안)

1. **이번 주(🔴):** B-1 SECRET_KEY, B-2/B-5 reset/forgot rate limit, B-3 code rate limit+입력제한, B-4 게임보상 검증.
2. **다음 스프린트(🟠):** C-1 동시성, C-2 카운터 SSOT 정리, C-4 wrong_answers 스키마(마이그레이션 전 필수), D-1 AI 채점 실패 분리.
3. **리팩토링 백로그(🟡):** E-1 진화 헬퍼, E-2 캐싱, E-3 Depends 통일, 테스트 도입, lifespan 전환.

---

# G. 데일리 / 위클리 미션 시스템 설계

기존 자산을 최대한 재활용하는 방향으로 설계. 이미 있는 것:
- `streak`, `last_login`(KST) — 출석 기반
- `game_rewards`(일일 카운트 패턴) — 일일 리셋 로직 레퍼런스
- progress / wrong_answers / boss·miniboss·game 이벤트 — 미션 진척 신호원
- `scheduler.py`(APScheduler, KST cron) — 위클리 리셋 스케줄에 활용

## G-1. 핵심 아이디어: "이벤트 → 미션 진척" 단방향 흐름
미션을 별도 폴링/집계로 만들지 말고, **학습 이벤트가 발생하는 지점에서 진척을 +1** 하는 이벤트 훅 방식. 모든 보상 핸들러가 이미 user를 들고 있으므로 한 줄 추가로 연동된다.

```
스테이지 클리어 ─┐
미니보스 클리어 ─┤
보스 클리어    ─┼─▶ progress_mission(user, event_type, amount)
오답 AI 피드백 ─┤        │  해당 event를 추적하는 활성 미션 진척 갱신
게임 클리어    ─┘        ▼
                   완료 시 reward 지급(XP/왕관) + claimed 플래그
```

## G-2. 데이터 모델

### 미션 정의(정적, `data/missions.json` — 콘텐츠팀이 관리)
```json
{
  "daily": [
    {"mission_id":"d_quiz3","title":"스테이지 퀴즈 3회 클리어","event":"stage_clear","goal":3,"reward":{"xp":300}},
    {"mission_id":"d_review","title":"오답 1개 복습","event":"review_done","goal":1,"reward":{"xp":150}},
    {"mission_id":"d_login","title":"오늘도 출석","event":"login","goal":1,"reward":{"crowns":1}}
  ],
  "weekly": [
    {"mission_id":"w_boss2","title":"보스 2회 처치","event":"boss_clear","goal":2,"reward":{"xp":1500,"crowns":2}},
    {"mission_id":"w_streak5","title":"주 5일 출석","event":"login_day","goal":5,"reward":{"xp":2000,"crowns":3}},
    {"mission_id":"w_ai5","title":"AI 피드백 5회 활용","event":"ai_feedback","goal":5,"reward":{"xp":800}}
  ]
}
```
`event` 타입은 **이미 존재하는 이벤트**에 매핑: `stage_clear`(progress), `boss_clear`(boss/endboss), `miniboss_clear`, `review_done`(train/reviewed), `ai_feedback`(quiz), `game_clear`(game), `login`/`login_day`(auth).

### 진척 저장 — user 객체에 임베드(JSON·Supabase 둘 다 호환)
별도 테이블 없이 `users.missions`(jsonb) 한 컬럼으로. 마이그레이션 부담 최소.
```json
"missions": {
  "daily":  {"date":"2026-06-24",
             "progress":{"d_quiz3":2,"d_review":1,"d_login":1},
             "claimed":["d_login"]},
  "weekly": {"week":"2026-W26",
             "progress":{"w_boss2":1,"w_ai5":3},
             "claimed":[],
             "login_days":["2026-06-22","2026-06-24"]}
}
```
- `date`/`week`가 현재 KST 날짜/ISO주차와 다르면 **접근 시 자동 리셋**(lazy reset). 스케줄러 의존을 줄여 단일 인스턴스가 아니어도 안전.
- `login_day` 같은 "하루 1회" 카운트는 날짜 집합으로 중복 방지.

## G-3. API 설계 (신규 `routers/mission.py`)
```
GET  /missions            오늘의 데일리 + 이번주 위클리 목록 + 내 진척/수령상태
POST /missions/claim      {mission_id} → 완료 검증 후 보상 지급(중복 방지)
```
진척 증가는 **별도 API 없이** 각 학습 핸들러 내부에서 호출(아래 헬퍼).

### 공통 헬퍼 (`routers/missions_core.py`)
```python
def now_kst(): ...
def iso_week(d): return d.strftime("%G-W%V")

def _ensure_period(user):
    today = now_kst().strftime("%Y-%m-%d")
    week  = iso_week(now_kst())
    m = user.setdefault("missions", {})
    d = m.setdefault("daily", {})
    if d.get("date") != today:
        d.update(date=today, progress={}, claimed=[])
    w = m.setdefault("weekly", {})
    if w.get("week") != week:
        w.update(week=week, progress={}, claimed=[], login_days=[])
    return m

def bump_mission(user, event, amount=1, day_key=None):
    """학습 이벤트 발생 시 호출. 활성 미션 진척만 갱신(보상은 claim에서)."""
    m = _ensure_period(user)
    for scope, defs in (("daily", DAILY_DEFS), ("weekly", WEEKLY_DEFS)):
        bucket = m[scope]
        for md in defs:
            if md["event"] != event:
                continue
            if md["event"] in ("login_day",) and day_key:
                days = bucket.setdefault("login_days", [])
                if day_key in days:
                    continue
                days.append(day_key)
                inc = 1
            else:
                inc = amount
            p = bucket["progress"]
            p[md["mission_id"]] = min(md["goal"], p.get(md["mission_id"], 0) + inc)
    # 주의: save_user는 호출부에서 1회만 (중복 저장 방지)
```

### 연동 지점 (한 줄씩 추가)
| 이벤트 | 파일/위치 | 추가 호출 |
|---|---|---|
| 스테이지 클리어 | `progress.py` award_xp 분기 | `bump_mission(user,"stage_clear")` |
| 보스 클리어 | `boss.py` is_clear & award | `bump_mission(u,"boss_clear")` |
| 미니보스 클리어 | `miniboss.py` clear | `bump_mission(user,"miniboss_clear")` |
| 오답 복습 | `train.py` reviewed | `bump_mission(...,"review_done")` |
| AI 피드백 | `quiz.py` ai-feedback | `bump_mission(...,"ai_feedback")` |
| 게임 클리어 | `game.py` clear | `bump_mission(...,"game_clear")` |
| 출석 | `auth.py` update_login_streak | `bump_mission(...,"login", day_key=today)` |

> 핵심: 이미 user를 로드·저장하는 지점이라 **추가 I/O 없음**. C-1 동시성 개선과 함께 적용하면 진척 유실도 방지.

## G-4. 보상 지급 (claim) — 멱등성 보장
```python
@router.post("/claim")
def claim(req, authorization):
    user = get_current_user(authorization)
    m = _ensure_period(user)
    md, scope = find_def(req.mission_id)        # daily/weekly 정의 조회
    bucket = m[scope]
    if req.mission_id in bucket["claimed"]:
        raise HTTPException(400, "이미 수령한 미션입니다.")
    if bucket["progress"].get(req.mission_id,0) < md["goal"]:
        raise HTTPException(400, "아직 완료되지 않았습니다.")
    bucket["claimed"].append(req.mission_id)
    apply_reward(user, md["reward"])            # E-1 공통 XP/왕관 헬퍼 재사용
    save_user(user)
    return {"reward": md["reward"], "user": serialize_user(user)}
```
- 진척 자동증가 ≠ 자동지급. **유저가 수령 버튼을 눌러야 지급**(클레임 UX + 중복방지 단순화).
- `claimed` 배열로 멱등성. 기간 리셋 시 자동 초기화.

## G-5. 리셋 전략
- **데일리:** lazy reset(접근 시 날짜 비교) 기본. KST 자정 기준 자동 전환 — 스케줄러 불필요.
- **위클리:** ISO 주차(`%G-W%V`)로 월요일 시작. 동일하게 lazy reset.
- 선택: `scheduler.py`에 위클리 미공식 미션 푸시/리마인더 cron 추가 가능(이미 18시 streak 리마인더 패턴 존재).

## G-6. 마이그레이션·안전장치
- `users.missions` 없으면 `_ensure_period`가 생성 → 기존 유저 무중단.
- 미션 정의 JSON은 정적 콘텐츠 → Supabase 미투입(레슨 데이터와 동일 원칙).
- 미션 정의 변경 시: 진행 중 유저의 진척 키가 사라지면 단순 무시되도록 방어(존재하는 mission_id만 노출).

## G-7. 단계적 도입 로드맵
1. `missions.json` + `missions_core.py` + `GET/POST /missions` (데일리 3종만).
2. 7개 연동 지점에 `bump_mission` 추가 + 회귀 테스트.
3. 위클리 3종 + login_day 집합 로직.
4. 프론트: 홈 대시보드에 미션 위젯(진척바 + 수령 버튼) — `game_rewards` UI 패턴 재사용.
5. (선택) 미션 리마인더 cron, 시즌/이벤트 미션 확장.
