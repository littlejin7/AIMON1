# backend/ 작업 규칙 (CLAUDE.md)

AI-MON 백엔드(FastAPI)에서 유저 상태를 다루거나 새 엔드포인트를 추가할 때 반드시 지켜야 하는
규칙을 모았다. 듀얼 스토리지(JSON 파일 ↔ Supabase)를 `USE_SUPABASE` 플래그 하나로 전환하는
구조라서, 두 백엔드 모두에서 동시성/lost-update 안전성을 깨지 않는 것이 핵심이다.

핵심 코드는 [`routers/utils.py`](routers/utils.py)에 모여 있다. 아래 규칙은 모두 그 파일의
구현을 전제로 한다.

---

## 1. 듀얼 스토리지 쓰기 규칙 — `mutate_user_atomic()` 만 사용

**유저 상태(`users` 테이블/`users.json`)를 바꾸는 모든 쓰기는 반드시
[`mutate_user_atomic(user_id, mutator)`](routers/utils.py) 경로를 쓴다.**

- `save_user()`를 핸들러에서 **직접 호출하지 않는다.** (신규 코드 금지)
- 이유: `save_user()`는 "요청 시작 시점에 읽은 user" 기준으로 delta-merge 하므로,
  같은 유저에 대한 동시 요청에서 **lost update / 가드 이중 통과**가 발생할 수 있다.
  `mutate_user_atomic()`은 가드 검사 → 변경 → 저장을 **같은 임계구역**에서 수행한다:
  - JSON: `file_lock(USERS_FILE)` 안에서 재읽기→변경→원자적 write
    (`_mutate_user_atomic_json`)
  - Supabase: `version` 컬럼 기반 낙관적 동시성(CAS) + 최대 5회 재시도
    (`_mutate_user_atomic_supabase`). 매 시도마다 fresh 재읽기 후 `mutator` 재평가.

### mutator 작성 규칙
```python
def mutator(u: dict) -> dict:
    # u 는 '영속 상태에서 새로 읽은' user. 여기서 가드 검사·변경을 모두 한다.
    ...                     # u 를 제자리(in-place)에서 변경
    return result           # 호출부로 돌려줄 값
# 어떤 예외든 raise 하면 write 가 일어나지 않는다 → 안전한 no-op
```
- `mutator`는 **부수효과 없이** `u`만 제자리 변경하고, 저장은 `mutate_user_atomic`이 한다.
- 외부 호출(Claude/이메일 등 비결정적·느린 작업)은 mutator **밖**에서 먼저 끝내고,
  그 결과만 mutator 안에서 user에 반영한다. (mutator는 CAS 재시도로 여러 번 실행될 수 있음)
- 실패 신호: 대상 없음 → `UserNotFoundError`, 쓰기 충돌/거부 → `UserSaveError`.
  핸들러에서 잡아 적절한 HTTP 응답으로 변환한다.

> 예외(레거시): 일부 핸들러는 아직 완전 원자화되지 않았다(코드 내 `M-4` 등으로 표기).
> 신규 작업에서 그 패턴을 따라가지 말고 `mutate_user_atomic`으로 작성한다.

---

## 2. user 컬럼 분류표 (numeric / jsonb / other)

Supabase 경로에서 변경분을 **어떻게 병합하는지**를 결정하는 분류다. 출처는
`save_user()`의 `numeric_cols` / `jsonb_cols` 정의([`routers/utils.py`](routers/utils.py)).
**user에 새 필드를 추가하면 이 표를 반드시 갱신**해야 동시성 병합이 올바르게 동작한다.

| 분류 | 병합 방식 | 컬럼 |
| --- | --- | --- |
| **numeric** | delta(차분) 적용 — 동시 증가가 합산됨 | `xp`, `crowns`, `lv`, `streak`, `daily_free_attempts`, `ai_feedback_count` |
| **jsonb** | dict 깊은 병합 (`_merge_dicts`) | `max_unlocked_unit`, `completed_units`, `awarded_crown_units`, `earned_streak_milestones`, `titles`, `game_rewards`, `seen_questions`, `endboss_cleared_levels`, `miniboss_cleared_stages` |
| **other** | 마지막 쓰기 우선(전체 치환) | 위 두 분류에 없는 모든 필드 (`character`, `course_level`, `token_version`, `version`, 등) |

분류 규칙:
- **카운터/누적 수치**는 numeric. 동시 요청이 각자 +1 해도 둘 다 반영돼야 하는 값.
- **누적 집합/맵(중복 없이 추가되거나 레벨별로 쌓이는 구조)**은 jsonb. dict로 깊은 병합된다.
  단, jsonb 컬럼이라도 값이 dict가 아니면 other처럼 전체 치환된다(`save_user` 참고).
- **스칼라 상태값**(덮어써도 되는 최신값)은 other.

---

## 3. 보상 지급은 "중복 가드 → 변경 → 저장"을 같은 임계구역에서

XP·크라운·칭호·유닛 해금·미션 진척 등 **보상 지급은 반드시 `mutate_user_atomic`의 mutator
안에서** 다음 순서로 한 덩어리로 처리한다.

1. **중복 가드 검사** — 이미 지급/클리어/claim 했는지 `u`(fresh 상태) 기준으로 확인
   (예: nonce 일회성, 일일 캡, 미션 `claimed`, `awarded_crown_units` / `endboss_cleared_levels`
   포함 여부, `login_days` 등).
2. **변경** — 가드를 통과한 경우에만 user를 변경. XP는 [`apply_xp(user, ...)`](routers/utils.py)를
   쓴다(레벨 재계산·진화·칭호·미션 훅을 in-place로 처리하며 내부에서 저장하지 않음).
3. **저장** — mutator 반환 후 `mutate_user_atomic`이 원자적으로 커밋.

가드와 변경이 같은 임계구역(JSON: file_lock / Supabase: CAS) 안에 있어야, 동시 요청에서도
가드가 항상 **최신 커밋 상태** 기준으로 평가되어 이중 지급이 없다. 가드 검사를 mutator
밖에서 미리 하고 변경만 안에서 하면 **TOCTOU(검사-사용 간극)로 이중 지급**이 생긴다.

참고 구현: [`routers/boss.py`](routers/boss.py)의 유닛보스 보상 mutator
(피드백 카운트 + 칭호 + XP/크라운/유닛 해금을 한 mutator에서 처리).

---

## 4. 새 엔드포인트: 외부 호출에는 `@limiter.limit` 필수

Claude(LLM) 호출, 이메일 발송, 그 외 외부 API 호출을 하는 **모든 새 엔드포인트는
[`limiter`](routers/utils.py)로 레이트리밋을 건다.**

```python
from routers.utils import limiter
from fastapi import Request

@router.post("/something")
@limiter.limit("10/minute;100/day")
async def handler(request: Request, ...):   # request: Request 인자 필수
    ...
```

- `limiter`는 `key_func=get_user_id_or_ip` — 로그인 사용자는 user_id, 아니면 IP 기준.
- `@limiter.limit(...)` 데코레이터를 쓰려면 핸들러에 **`request: Request` 인자가 반드시**
  있어야 한다(slowapi 요구사항).
- 대상이 되는 외부 호출 경로:
  - Claude: [`services/claude_service.py`](services/claude_service.py)의 `ask_claude_json` 등
  - 이메일: [`services/email_service.py`](services/email_service.py)
- 한도는 비용·남용 가능성에 맞춰 정한다. 기존 엔드포인트 예시:
  힌트 `10/minute;100/day`, 답안 채점 `30/minute;100/day` ([`routers/boss.py`](routers/boss.py)).

---

### 빠른 체크리스트 (PR 전)
- [ ] 유저 상태 변경에 `save_user()` 직접 호출이 없는가? → `mutate_user_atomic` 사용
- [ ] 보상의 중복 가드·변경·저장이 한 mutator 안에 있는가?
- [ ] user에 새 필드를 추가했다면 §2 분류표(numeric/jsonb/other)에 반영했는가?
- [ ] Claude/이메일/외부 호출 엔드포인트에 `@limiter.limit`과 `request: Request`가 있는가?
