# AI-MON Supabase 마이그레이션 계획

> 작성일: 2026-06-22 / 최종 수정: 2026-06-22 (2차)  
> 목적: JSON 파일 기반 데이터 저장 → Supabase(PostgreSQL) 전환  
> 병행 작업: Refresh Token 도입 / 깃허브 배지 SVG API

---

## 현재 상태

| 항목 | 현황 |
|---|---|
| 데이터 저장 | `users.json`, `progress.json`, `wrong_answers.json` |
| 인증 | JWT (access token 1개, 24시간 만료) |
| 동시성 처리 | 파일 락 (fcntl/msvcrt) — 스케일 한계 있음 |
| 이메일 | `sendgrid`, `apscheduler` requirements에 있으나 미연동 |

---

## 목표

1. **DB 마이그레이션** — JSON 파일 → Supabase PostgreSQL
2. **Refresh Token** — access 30분 / refresh 30일 구조로 전환
3. **깃허브 배지 SVG API** — `/badge/{user_id}` 엔드포인트 (독립 작업)

---

## 브랜치 전략

```
main (현재 JSON 버전, 프로덕션 유지)
  └── feature/supabase-migration
  └── feature/github-badge  ← 독립 진행 가능
```

---

## PHASE 0 — 준비 (1~2일)

### Supabase 프로젝트 생성
- [supabase.com](https://supabase.com) 에서 프로젝트 2개 생성
  - `aimon-dev` (개발용, 무료 플랜)
  - `aimon-prod` (프로덕션용)
- `SUPABASE_URL`, `SUPABASE_KEY` 발급

### .env 추가
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your-anon-key
USE_SUPABASE=false
```

### 브랜치 생성
> ⚠️ 현재 main 브랜치만 존재. Phase 0에서 반드시 먼저 생성.
```bash
git checkout -b feature/supabase-migration
```

### supabase 패키지 설치
> ⚠️ 현재 미설치 확인됨. Phase 0에서 설치 필요.
```bash
pip install supabase==2.31.0
```
`requirements.txt`에도 추가:
```
supabase==2.31.0
```

### JSON 파일 백업
```
backend/data/backup/
  ├── users_backup_20260622.json
  ├── progress_backup_20260622.json
  └── wrong_answers_backup_20260622.json
```

---

## PHASE 1 — 테이블 설계 & 생성 (1일)

Supabase 대시보드 → SQL Editor에서 실행.

### 테이블 1: users
```sql
create table users (
  id uuid primary key,
  username text unique not null,
  password text,
  nickname text,
  email text,
  role text default 'student',
  course_level text default 'beginner',
  is_level_tested boolean default false,
  marketing_agreed boolean default false,
  character text default 'slime',
  lv integer default 1,
  xp integer default 0,
  crowns integer default 5,
  streak integer default 0,
  last_login text,
  daily_free_attempts integer default 2,
  last_free_attempt_date text,
  ai_feedback_count integer default 0,
  token_version integer default 1,
  group_id uuid,                              -- nullable, 일부 유저에 없음 OK
  equipped_title text,                        -- users.json엔 없으나 추가해도 무방
  endboss_cleared_levels jsonb default '[]',  -- ⚠️ 누락 컬럼 추가 (endboss.py 사용 중)
  miniboss_cleared_stages jsonb default '[]', -- ⚠️ 누락 컬럼 추가 (miniboss.py 사용 중)
  seen_questions jsonb default '{}',          -- ⚠️ 동적 키 통합 (아래 주의사항 참고)
  max_unlocked_unit jsonb default '{"beginner":1,"intermediate":1,"advanced":1}',
  completed_units jsonb default '{"beginner":0,"intermediate":0,"advanced":0}',
  awarded_crown_units jsonb default '[]',
  earned_streak_milestones jsonb default '[]',
  titles jsonb default '[]',
  game_rewards jsonb default '{}',
  created_at timestamptz default now()
);
```

#### ⚠️ seen_questions 동적 키 통합 주의사항

라우터에서 user 객체에 동적으로 붙이는 키들이 있어 PostgreSQL 개별 컬럼으로 받을 수 없음:

| 원래 키 패턴 | 발생 위치 | 통합 후 |
|---|---|---|
| `unitboss_seen_{unit_num}` (ex. `unitboss_seen_1`) | boss.py | `seen_questions.unitboss_seen_1` |
| `endboss_seen_questions` | endboss.py | `seen_questions.endboss_seen_questions` |
| `miniboss_seen_questions` | miniboss.py | `seen_questions.miniboss_seen_questions` |
| `boss_seen_questions` (레거시) | users.json | `seen_questions.boss_seen_questions` |

**라우터 코드 수정 필요:** `user["unitboss_seen_1"]` → `user["seen_questions"]["unitboss_seen_1"]` 형태로 접근 방식 변경. Phase 2에서 처리.

---

### 테이블 2: refresh_tokens (신규)
```sql
create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  token text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
```

### 테이블 3: reset_tokens (⚠️ 기존 플랜 누락 — 추가)
> `utils.py`에 `load_reset_tokens` / `save_reset_tokens` 존재 확인됨. 비밀번호 재설정 기능에서 사용 중.
```sql
create table reset_tokens (
  email text primary key,
  token text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
```

> ⚠️ **데이터 구조 주의:** 현재 `reset_tokens.json`은 `{ "email": { "token": ..., "expires_at": ... } }` 형태의 **dict**로 저장됨.  
> Supabase 전환 시 `.execute().data`는 **list** 반환 → `auth.py`에서 이메일로 조회하는 코드를 `next(filter(...))` 방식으로 변경 필요. Phase 2에서 처리.

### 테이블 4: progress
```sql
create table progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  unit integer not null,
  stage text not null,
  score integer default 0,
  is_completed boolean default false,
  checkpoint text,
  course_level text default 'beginner',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, unit, stage, course_level)
);
```

> ⚠️ **마이그레이션 데이터 주의:** 현재 `progress.json` 73개 레코드 전부 `course_level` 필드 없음.  
> import 전 마이그레이션 스크립트에서 반드시 기본값 처리 필요:
> ```python
> for p in progress:
>     if 'course_level' not in p:
>         p['course_level'] = 'beginner'
> ```

### 테이블 5: wrong_answers
```sql
create table wrong_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  question_id text,
  user_answer text,
  feedback text,
  ai_explanation text,
  reviewed boolean default false,
  timestamp text,
  created_at timestamptz default now()
);
```

> ℹ️ 컬럼은 **실제 라우터 저장 코드 기준**으로 정의됨 (`quiz.py`·`boss.py`의 `save_wrong_answer_item` 호출).
> 코드가 쓰는 필드: `id`, `user_id`, `question_id`, `user_answer`, `feedback`, `ai_explanation`, `timestamp`, `reviewed`.
> 코드가 읽는 필드: `/train` 복습은 `reviewed`·`question_id`, AI 피드백 캐시는 `ai_explanation`(1순위)·`feedback`(폴백).
> `question`·`correct_answer`·`course_level`은 라우터가 저장/조회하지 않으므로 컬럼에서 제외했다
> (`boss.py /answer`는 `ai_explanation` 없이 저장하므로 해당 컬럼은 nullable 유지).
> 데이터 실측(2026-06-25, 라이브 Supabase `wrong_answers` 기준): 전체 186건
> (예: `tester_wang` 9건). 과거 문서의 "0개 레코드" 서술은 오기였으며 실제로는 데이터가 쌓여 있다.

### 함수 1: update_user_atomic (원자적 유저 정보 업데이트 RPC)
> 동시성 처리 중 Read-Modify-Write 경합에 따른 데이터 유실(Lost Update)을 방지하기 위한 DB 수준 RPC입니다.
```sql
create or replace function update_user_atomic(
  p_user_id uuid,
  p_numeric_deltas jsonb,
  p_jsonb_merges jsonb,
  p_other_updates jsonb
) returns void as $$
declare
  v_key text;
  v_val jsonb;
  v_sql text;
begin
  v_sql := 'update users set ';
  
  -- 1. 카운터성 수치 컬럼 원자적 증가 (coalesce + delta)
  for v_key, v_val in select * from jsonb_each(p_numeric_deltas) loop
    v_sql := v_sql || quote_ident(v_key) || ' = coalesce(' || quote_ident(v_key) || ', 0) + ' || (v_val::text) || ', ';
  end loop;
  
  -- 2. JSONB 컬럼 머지 (coalesce + merge ||)
  for v_key, v_val in select * from jsonb_each(p_jsonb_merges) loop
    v_sql := v_sql || quote_ident(v_key) || ' = coalesce(' || quote_ident(v_key) || ', ''{}''::jsonb) || ' || quote_literal(v_val::text) || '::jsonb, ';
  end loop;
  
  -- 3. 기타 일반 필드 덮어쓰기
  for v_key, v_val in select * from jsonb_each(p_other_updates) loop
    v_sql := v_sql || quote_ident(v_key) || ' = ' || 
      case jsonb_typeof(v_val)
        when 'string' then quote_literal(v_val#>>'{}')
        when 'boolean' then (v_val::text)
        when 'null' then 'null'
        else quote_literal(v_val::text) || '::jsonb'
      end || ', ';
  end loop;
  
  -- 트레일링 쉼표 제거
  if right(v_sql, 2) = ', ' then
    v_sql := left(v_sql, length(v_sql) - 2);
  else
    return;
  end if;
  
  v_sql := v_sql || ' where id = ' || quote_literal(p_user_id::text) || '::uuid';
  
  execute v_sql;
end;
$$ language plpgsql;
```

### 함수 2: mutate_user_atomic 용 version 컬럼 (낙관적 락, C-1)
> `utils.py`의 표준 원자 쓰기 경로 `mutate_user_atomic()` 가 Supabase 모드에서 사용하는 낙관적 동시성(CAS) 가드. check-then-act(게임 nonce 소비·일일 캡·미션 claimed/login_days append)를 fresh 상태 기준으로 원자화한다. **이 컬럼이 없으면 Supabase 모드에서 mutate_user_atomic 이 동작하지 않는다.**
```sql
-- users 테이블에 version 컬럼 추가 (앱이 version+1 로 갱신, WHERE version = read_version 가드)
alter table users add column if not exists version bigint not null default 0;
```
앱 측 동작(참고): `select * ... ; update users set ..., version = read_version + 1 where id = ? and version = read_version`.
갱신 행이 0이면(그 사이 다른 쓰기 발생) fresh 재읽기 후 mutator 재실행(최대 5회). 초과 시 `UserSaveError`.

> (선택) nonce 소비를 단일 SQL 가드로도 가능: `update users set game_rewards = jsonb_set(coalesce(game_rewards,'{}'),'{used_tokens,<nonce>}', to_jsonb(<expiry>)) where id=? and not (coalesce(game_rewards->'used_tokens','{}') ? '<nonce>') returning 1;` — 0행이면 이미 사용된 nonce. 현재 구현은 version CAS 경로로 일원화.

---

## PHASE 2 — 추상화 레이어 교체 (2~3일)

> 라우터 코드는 건드리지 않음. `utils.py`의 load/save 함수만 교체.

### requirements.txt 추가
```
supabase==2.4.0
```

### utils.py 상단 — 클라이언트 초기화
```python
from supabase import create_client
import os

USE_SUPABASE = os.getenv("USE_SUPABASE", "false") == "true"

if USE_SUPABASE:
    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_KEY")
    )
```

### ⚠️ seen_questions 접근 방식 변경 (라우터 수정 필요)

`boss.py`, `endboss.py`, `miniboss.py`에서 user에 직접 동적 키를 붙이던 방식을 `seen_questions` jsonb 안으로 이동:

```python
# 기존 (boss.py)
seen_key = f"unitboss_seen_{unit_num}"
user[seen_key] = seen + [chosen["question_id"]]

# 변경 후
seen_questions = user.get("seen_questions", {})
seen_questions[f"unitboss_seen_{unit_num}"] = seen + [chosen["question_id"]]
user["seen_questions"] = seen_questions
```

이 패턴이 boss.py / endboss.py / miniboss.py 전체에 적용되어야 함. Phase 2에서 처리.

### ⚠️ save_users 비효율 주의
현재 플랜의 `save_users`는 유저 1명 변경에도 전체 리스트를 순회하며 upsert 반복.  
운영 중 문제는 없으나, Phase 2에서 아래 방식으로 교체 권장:

```python
# 비효율 (현재 플랜)
def save_users(users):
    for user in users:
        supabase.table("users").upsert(user).execute()  # 전체 순회

# 권장 (개별 유저 단위 저장)
def save_user(user: dict):
    supabase.table("users").upsert(user).execute()
```

라우터에서 `save_users(users)` 호출 부분을 `save_user(u)` 로 점진적으로 교체.

### load/save 함수 교체
```python
def load_users():
    if USE_SUPABASE:
        return supabase.table("users").select("*").execute().data
    return _load_json_locked(USERS_FILE, [])

def save_users(users):
    if USE_SUPABASE:
        for user in users:
            supabase.table("users").upsert(user).execute()
    else:
        _save_json_locked(USERS_FILE, users)

def load_progress():
    if USE_SUPABASE:
        return supabase.table("progress").select("*").execute().data
    return _load_json_locked(PROGRESS_FILE, [])

def save_progress(progress):
    if USE_SUPABASE:
        for p in progress:
            supabase.table("progress").upsert(p).execute()
    else:
        _save_json_locked(PROGRESS_FILE, progress)

def load_wrong_answers():
    if USE_SUPABASE:
        return supabase.table("wrong_answers").select("*").execute().data
    return _load_json_locked(WRONG_ANSWERS_FILE, [])

def save_wrong_answers(data):
    if USE_SUPABASE:
        for item in data:
            supabase.table("wrong_answers").upsert(item).execute()
    else:
        _save_json_locked(WRONG_ANSWERS_FILE, data)
```

> 파일 락 관련 코드(fcntl/msvcrt) 전부 삭제 가능.

---

## PHASE 3 — 라우터별 검증 (3~5일)

`USE_SUPABASE=true` 로컬에서 켜고 순서대로 테스트.

| Day | 검증 대상 | 확인 항목 |
|---|---|---|
| Day 1 | `/auth/register`, `/auth/login`, `/user/me` | 유저 생성, 로그인, 조회 |
| Day 2 | `/progress` GET/POST | XP 지급, 크라운 지급, 진행상황 저장 |
| Day 3 | `/quiz`, `/boss`, `/miniboss` | wrong_answers 저장, 복합 로직 |
| Day 4 | `/endboss`, `/train`, `/code`, `/titles`, `/game` | 나머지 전체 |
| Day 5 | End-to-end 전체 시나리오 | 회원가입 → 레슨 → 퀴즈 → 보스 클리어 → XP 확인 |

---

## PHASE 4 — Refresh Token 추가 (2~3일)

> Phase 3 완료 후 진행. `refresh_tokens` 테이블은 Phase 1에서 이미 생성됨.

### 토큰 만료 시간 변경
```python
ACCESS_TOKEN_EXPIRE_MINUTES = 30    # 기존 1440분 → 30분
REFRESH_TOKEN_EXPIRE_DAYS = 30      # 신규
```

### 신규 엔드포인트 (auth.py)
```python
# POST /auth/refresh
def refresh(refresh_token: str):
    # DB에서 토큰 조회 및 만료 확인
    # 새 access_token 발급
    # 기존 refresh_token 무효화 + 새 토큰 발급 (rotation)

# POST /auth/logout
def logout(authorization: str):
    # DB에서 해당 유저의 refresh_token 삭제
```

### 프론트 작업 (싱크 필요)
- access token 만료(401) 시 자동으로 `/auth/refresh` 호출하는 인터셉터 추가
- refresh token도 만료 시 로그아웃 처리

---

## PHASE 5 — 컷오버 (1일, 새벽 트래픽 낮은 시간)

```
1. 점검 공지 (최소 30분 전)
2. JSON 파일 최종 백업
3. JSON → CSV 변환 후 Supabase 대시보드에서 import
4. 데이터 정합성 확인 (유저 수, XP, progress 샘플 10명 대조)
5. 서버 환경변수 USE_SUPABASE=true 변경 후 재시작
6. 핵심 플로우 실시간 확인 (로그인, 퀴즈, 보스)
7. 30분 모니터링 후 이상 없으면 완료
```

### 롤백 기준
- 5xx 에러율 5% 이상 → 즉시 `USE_SUPABASE=false` 복구

---

## 병렬 작업: 깃허브 배지 SVG API

> DB 불필요. `feature/github-badge` 브랜치로 Phase 2~3 진행 중 병렬 작업 가능.

### 엔드포인트
```python
# GET /badge/{user_id}
@router.get("/badge/{user_id}")
def get_badge(user_id: str):
    users = load_users()
    user = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(404)

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="320" height="90">
      <rect width="320" height="90" rx="10" fill="#0f0f1a"/>
      <text x="20" y="35" font-size="16" fill="#fff" font-family="monospace">
        🤖 {user['nickname']}
      </text>
      <text x="20" y="60" font-size="13" fill="#7c3aed" font-family="monospace">
        Lv.{user['lv']} · {user['xp']:,} XP · {user.get('boss_cleared', 0)} Bosses
      </text>
      <text x="20" y="80" font-size="11" fill="#666" font-family="monospace">
        AI-MON | aimon.kr
      </text>
    </svg>"""

    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "max-age=3600"}
    )
```

### 유저에게 제공하는 마크다운
```markdown
![AI-MON](https://api.aimon.kr/badge/{user_id})
```

> `Cache-Control: max-age=3600` 필수 — GitHub CDN(camo)이 캐싱 주기를 이 값 기준으로 결정함.

---

## PHASE 0 체크리스트

```
[ ] 1. Supabase 프로젝트 생성 (aimon-dev, aimon-prod)
[ ] 2. SUPABASE_URL, SUPABASE_KEY 발급 → .env에 추가 (USE_SUPABASE=false)
[ ] 3. git checkout -b feature/supabase-migration
[ ] 4. users.json / progress.json / wrong_answers.json 백업
[ ] 5. pip install supabase==2.4.0 → requirements.txt 반영
```

---

## 전체 타임라인

```
Week 1  │ PHASE 0 준비 + PHASE 1 테이블 생성
Week 2  │ PHASE 2 추상화 레이어 교체
        │ + feature/github-badge 병렬 진행
Week 3  │ PHASE 3 라우터별 검증
Week 4  │ PHASE 4 Refresh Token
Week 5  │ PHASE 5 컷오버 + 안정화 모니터링
```

---

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-06-22 | 초안 작성 |
| 2026-06-22 | users 테이블 누락 컬럼 2개 추가 (`boss_seen_questions`, `endboss_cleared_levels`), `reset_tokens` 테이블 추가, Phase 0 체크리스트 보완, `save_users` 비효율 주의사항 추가 |
| 2026-06-22 (2차) | users 테이블 추가 누락 컬럼 반영 (`endboss_cleared_levels`, `miniboss_cleared_stages`), 동적 키(`unitboss_seen_*` 등) → `seen_questions jsonb` 통합 설계, progress 73개 레코드 `course_level` 누락 마이그레이션 주의사항 추가, wrong_answers `course_level` 검증 항목 추가 |

---

## 레슨/문제 JSON은 Supabase 안 넣음

`lessons.json`, `questions/` 폴더는 읽기 전용 정적 콘텐츠.  
DB에 넣을 필요 없음 — 파일 그대로 유지.
