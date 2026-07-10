---
title: AI MON — 엔드보스 설계
version: "2.1"
status: current
last_updated: 2026-07-11
implementation_report_commit: 047e4c7fe2fd3689225ebf0758fc340f77c82d3b
source_of_truth:
  - backend/routers/endboss.py
  - backend/routers/battle_session.py
  - backend/data/endboss/
  - frontend/src/pages/EndBoss/
---

# AI-MON 엔드보스 설계

> 초급·중급·고급 코스의 최종 종합전, 코스 승급, 진화, 인증 보상을 담당하는 엔드보스 구현 기준

---

## 0. 문서 목적

이 문서는 현재 엔드보스 구현을 기준으로 다음 사항을 정의한다.

- 엔드보스 해금과 레벨 사다리
- 코스별 프로젝트 선택
- Phase 1~3 전투 구조
- HP·문제 수·페이즈 전환 규칙
- 서버 권위 전투 세션
- 도전 비용과 보상
- 문제 출제와 재도전 정책
- 프론트·백엔드 API 계약
- 진화와 코스 승급
- 회귀 테스트와 배포 전 검증 기준
- 과거 보안·정합성 문제의 해결 이력

실제 코드와 문서가 충돌하면 다음 구현 파일을 우선한다.

```text
backend/routers/endboss.py
backend/routers/battle_session.py
backend/data/endboss/
frontend/src/pages/EndBoss/
```

관련 문서:

```text
docs/design/AI_MON_PROPOSAL.md
docs/design/AI_MON_PIPELINE.md
docs/design/AI_MON_SCHEMA.md
docs/design/AI_MON_MISSIONS.md
docs/ops/supabase-schema-apply-checklist.md
```

---

## 1. 현재 상태 요약

| 항목 | 현재 구현 |
|---|---|
| API 경로 | `/boss/endboss` |
| 데이터 경로 | `backend/data/endboss/{course_level}.json` |
| 코스 | beginner / intermediate / advanced |
| 프로젝트 | 코스별 4개 |
| 전투 | Phase 1~3 |
| Phase 1 | 5문제 |
| Phase 2 | 4문제 |
| Phase 3 | 최대 3회 |
| 최대 문제 수 | 12문제 |
| 보스 시작 HP | 1,800 |
| 플레이어 시작 HP | 1,200 |
| 정답 피해 | 보스 HP -200 |
| 오답 피해 | 플레이어 HP -400 |
| Phase 3 진입 | Phase 1~2 총 9정답 후 |
| 도전 비용 | 시작 시 왕관 3개 |
| 전투 권위 | 서버 세션 |
| 보상 조건 | 서버 세션 `status == "won"` |
| 최초 클리어 보상 | 코인 15,000 + 누적 랭킹점수 15,000 + 왕관 15 |
| GP | 지급하지 않음 |
| 칭호 | 코스별 1개 |
| 진화 | 초급→1, 중급→2, 고급→3 |
| 중복 보상 방지 | `endboss_cleared_levels` + 세션 consume |
| 문제 선택 | unseen 우선 + 실제 랜덤 셔플 |
| Phase 3 데이터 검증 | 프로젝트별 최소 3개 |
| Supabase 스키마 추가 | 불필요. 기존 `battle_sessions` JSONB 내부 사용 |

---

## 2. 서비스 내 역할

엔드보스는 한 코스의 최종 종합전이다.

```text
Unit 1~8 학습
  ↓
Unit 8 유닛보스 클리어
  ↓
엔드보스 해금
  ↓
프로젝트 선택
  ↓
Phase 1: 기본 구현·출력 이해
  ↓
Phase 2: 오류 분석·수정
  ↓
Phase 3: 최종 구현 문제
  ↓
서버 세션 status=won
  ↓
클리어 처리
  ├─ 코인·랭킹점수·왕관
  ├─ 칭호
  ├─ 진화 단계 상승
  ├─ 다음 코스 승급
  └─ 인증 상태 갱신
```

엔드보스 클리어는 코스 단위 진화의 트리거다.

---

## 3. 레벨 사다리

### 3-1. 상태

| 상태 | 의미 | 진입 |
|---|---|---:|
| `cleared` | 해당 코스 엔드보스 클리어 | 가능 |
| `recognized` | 레벨 테스트 배치보다 낮은 코스 | 가능 |
| `current` | 현재 진행 코스 | 해금 조건 충족 시 가능 |
| `locked` | 아직 해금되지 않은 상위 코스 | 불가 |

### 3-2. 선택 가능한 레벨

선택 가능한 레벨은 다음 합집합으로 결정한다.

```text
엔드보스 클리어 이력으로 해금된 레벨
+
현재 course_level 이하 레벨
```

예:

```text
course_level = intermediate
endboss_cleared_levels = []
```

| 레벨 | 상태 |
|---|---|
| beginner | recognized |
| intermediate | current |
| advanced | locked |

### 3-3. 현재 코스 해금

현재 코스 엔드보스는 다음 조건으로 해금된다.

```text
max_unlocked_unit[course_level] > 8
```

즉, 해당 코스 Unit 8 유닛보스를 클리어해 다음 유닛 값이 9 이상인 상태다.

### 3-4. 하위 코스 인정 진입

레벨 테스트 결과가 intermediate 또는 advanced인 사용자는 하위 코스 엔드보스에 직접 진입할 수 있다.

이는 하위 코스 Unit 1~8 진행을 강제하지 않는 인정 정책이다.

### 3-5. 이미 클리어한 코스

이미 클리어한 코스도 재도전할 수 있다.

단, 최초 클리어 보상은 다시 지급하지 않는다.

---

## 4. 코스별 프로젝트

### Beginner

| ID | 표시명 |
|---|---|
| `account` | 가계부 시스템 |
| `wordchain` | 끝말잇기 봇 |
| `grade` | 성적 관리기 |
| `gpa` | 학점 계산기 |

### Intermediate

| ID | 표시명 |
|---|---|
| `todo` | TODO 매니저 |
| `contact` | 연락처 앱 |
| `log_parser` | 로그 파서 |
| `weather` | 날씨 API 클라이언트 |

### Advanced

| ID | 표시명 |
|---|---|
| `ai_agent` | AI 에이전트 |
| `async_api` | 비동기 API 클라이언트 |
| `fastapi_server` | FastAPI AI 서버 |
| `langchain_bot` | LangChain RAG 봇 |

문제 풀은 다음 조합으로 결정한다.

```text
course_level + project + phase
```

다른 프로젝트의 문제는 현재 프로젝트의 수량 검증이나 출제에 합산하지 않는다.

---

## 5. 문제 데이터

### 5-1. 파일 구조

```text
backend/data/endboss/
├─ beginner.json
├─ intermediate.json
└─ advanced.json
```

과거 `finalboss/` 데이터 경로는 현재 사용하지 않는다.

### 5-2. 기본 문제 객체

```json
{
  "question_id": "endboss_beg_account_p1_001",
  "quiz_category": "final_boss",
  "is_boss": true,
  "project": "account",
  "phase": 1,
  "stage": "final",
  "unit": 9,
  "course_level": "beginner",
  "difficulty": "medium",
  "type": "output_select",
  "question": "문제 본문",
  "options": ["A", "B", "C", "D"],
  "answer": "B",
  "explanation": "해설"
}
```

### 5-3. 필수 식별값

각 문제는 최소한 다음 값을 가져야 한다.

```text
question_id
course_level
project
phase
type
question
answer
```

`question_id`는 전역적으로 중복되지 않아야 한다.

### 5-4. 시작 전 최소 문제 수

프로젝트별 전투 시작 조건:

| Phase | 최소 문제 수 |
|---|---:|
| Phase 1 | 5 |
| Phase 2 | 4 |
| Phase 3 | 3 |

Phase 3는 최대 3회 시도를 보장해야 하므로 최소 3문제가 필요하다.

문제 수 검증은 반드시 다음 작업보다 먼저 수행한다.

```text
왕관 차감
seen_questions 변경
battle_token 발급
battle_session 생성
```

데이터가 부족하면 전투를 시작하지 않고 사용자 상태를 변경하지 않는다.

---

## 6. 코스별 문제 유형

### Beginner

| Phase | 유형 |
|---|---|
| 1 | `output_select`, `multiple_choice` |
| 2 | `error_find` |
| 3 | `fill_in_blank` |

### Intermediate

| Phase | 유형 |
|---|---|
| 1 | `output_select`, `fill_in_blank` |
| 2 | `error_find` |
| 3 | `code_input` |

### Advanced

| Phase | 유형 |
|---|---|
| 1 | `fill_in_blank`, `error_find` |
| 2 | `code_input` |
| 3 | `code_input` |

---

## 7. 전투 구조

### 7-1. 전체 흐름

```text
/start
  ↓
서버 세션 생성
  ↓
Phase 1 문제 5개
  ↓
Phase 2 문제 4개
  ↓
총 9정답으로 boss_hp=0
  ↓
Phase 3 최대 3회
  ↓
정답이면 status=won
  ↓
/clear
  ↓
보상 지급 후 세션 consume
```

### 7-2. 최대 문제 수

```text
Phase 1 5문제
+
Phase 2 4문제
+
Phase 3 최대 3문제
=
총 최대 12문제
```

### 7-3. Phase 1

- 5문제를 출제한다.
- 정답 1개당 보스 HP를 200 감소시킨다.
- 5정답 후 보스 HP는 800이다.
- Phase 1 완료만으로 Phase 3에 진입할 수 없다.

### 7-4. Phase 2

- 4문제를 출제한다.
- 정답 1개당 보스 HP를 200 감소시킨다.
- Phase 1과 합쳐 총 9정답일 때 보스 HP가 0이 된다.
- 9번째 정답 이후에만 Phase 3를 개방한다.

### 7-5. Phase 3

- 프로젝트별 최종 구현 문제를 사용한다.
- 최대 3회 시도한다.
- Phase 1~2 HP 게이트를 통과한 세션만 답안을 받을 수 있다.
- 정답이면 세션 `status`를 `won`으로 전환한다.
- 최대 횟수 소진 시 패배 처리한다.

---

## 8. HP 규칙

### 8-1. 상수

```python
BOSS_HP_INIT = 1800
MY_HP_INIT = 1200
BOSS_HP_DELTA = 200
MY_HP_DELTA = 400
PHASE3_MAX_TRIES = 3
```

### 8-2. 정답

Phase 1~2 정답:

```text
boss_hp = max(0, boss_hp - 200)
```

### 8-3. 오답

Phase 1~2 오답:

```text
my_hp = max(0, my_hp - 400)
```

### 8-4. 수치 흐름

| 누적 정답 | 보스 HP | 상태 |
|---:|---:|---|
| 0 | 1,800 | Phase 1 시작 |
| 1 | 1,600 | Phase 1 |
| 2 | 1,400 | Phase 1 |
| 3 | 1,200 | Phase 1 |
| 4 | 1,000 | Phase 1 |
| 5 | 800 | Phase 1 완료 |
| 6 | 600 | Phase 2 |
| 7 | 400 | Phase 2 |
| 8 | 200 | Phase 2 |
| 9 | 0 | Phase 3 개방 |

### 8-5. 권위 원칙

HP와 Phase 3 횟수는 서버 세션 값이 권위다.

클라이언트가 다음 값을 임의로 보내더라도 전투 결과에 사용하지 않는다.

```text
my_hp
boss_hp
phase3_tries
```

프론트의 HP 값은 표시용이다.

---

## 9. 서버 권위 전투 세션

### 9-1. 목적

서버 세션은 다음 어뷰징을 차단한다.

- `/clear` 직접 호출
- `boss_hp=1` 위조
- `phase3_tries=0` 반복
- 다른 프로젝트 세션 재사용
- 다른 레벨 세션 재사용
- 같은 승리 세션으로 보상 반복 수령
- 동일 문제 반복 제출로 정답 수 증가

### 9-2. 저장 위치

```text
user.battle_sessions[sid]
```

기존 `battle_sessions` JSONB 내부에 엔드보스 세션을 중첩 저장한다.

별도 Supabase 컬럼 추가는 필요하지 않다.

### 9-3. 토큰

`/start`는 HMAC 서명된 `battle_token`을 발급한다.

토큰은 최소한 다음 정보를 결합한다.

```text
mode=endboss
user_id
sid
level
project
issued_at
```

토큰 검증 항목:

- 서명
- 사용자 소유권
- mode
- 만료
- 세션 존재 여부
- 레벨 일치
- 프로젝트 일치

### 9-4. 세션 상태

```text
active
  ↓
won 또는 lost
  ↓
consumed
```

의미:

| 상태 | 의미 |
|---|---|
| `active` | 전투 진행 중 |
| `won` | Phase 3 정답 완료 |
| `lost` | 패배 또는 시도 소진 |
| `consumed` | 보상 처리 완료 |

현재 구현에서 consume은 세션 제거 방식으로 처리할 수 있다.

### 9-5. 엔드보스 세션에 필요한 정보

논리적으로 다음 값이 서버에 유지되어야 한다.

```text
sid
mode
level
project
boss_hp
my_hp
phase
phase3_tries
served_question_ids
answered_question_ids
correct_question_ids
status
expires_at
```

실제 저장 형식은 구현에 맞추되, 클라이언트 값으로 재구성하지 않는다.

---

## 10. 전투 시작 — `POST /boss/endboss/start`

### 10-1. 요청

논리 요청:

```json
{
  "project": "account",
  "target_level": "beginner"
}
```

### 10-2. 처리 순서

```text
1. 사용자 인증
2. target_level 해석
3. 엔드보스 해금 확인
4. 프로젝트 유효성 확인
5. Phase 1 문제 풀 생성
6. Phase 2 문제 풀 생성
7. Phase 3 문제 풀 생성
8. 문제 수 5/4/3 검증
9. mutate_user_atomic 진입
10. 최신 왕관 잔액 확인
11. 왕관 3개 차감
12. unseen 우선 랜덤 문제 선택
13. seen_questions 저장
14. battle_token 발급
15. 엔드보스 세션 생성
16. 시작 응답 반환
```

### 10-3. 원자성

다음 작업은 하나의 원자적 임계구역 안에서 처리한다.

```text
최신 왕관 확인
왕관 차감
seen_questions 갱신
세션 생성
```

동시 시작 요청 두 개가 들어와도 잔액이 3개라면 하나만 성공해야 한다.

### 10-4. 실패 안전성

Phase 3 문제가 2개뿐인 경우:

```text
왕관 차감 없음
seen_questions 변경 없음
battle_session 생성 없음
battle_token 사용 가능한 상태 생성 없음
```

### 10-5. 응답

논리 응답:

```json
{
  "battle_token": "signed-token",
  "boss_hp": 1800,
  "my_hp": 1200,
  "phase": 1,
  "phase1_questions": [],
  "phase2_questions": []
}
```

실제 필드명은 현재 API 구현을 따른다.

---

## 11. 답안 제출 — `POST /boss/endboss/answer`

### 11-1. 요청 원칙

필수 권위 입력:

```text
battle_token
question_id
user_answer
phase
project
target_level
```

다음 클라이언트 값은 서버 계산의 권위로 사용하지 않는다.

```text
my_hp
boss_hp
phase3_tries
```

레거시 호환을 위해 요청 모델에 남아 있더라도 무시해야 한다.

### 11-2. 처리 순서

```text
1. 사용자 인증
2. battle_token 검증
3. fresh user 상태 로드
4. 서버 세션 조회
5. 세션 level/project/status 검증
6. question_id가 현재 세션에 발급된 문제인지 검증
7. 서버 정답 데이터로 채점
8. 서버 세션 HP·phase·tries 변경
9. 다음 문제 또는 전투 결과 반환
```

### 11-3. Phase 1~2

정답:

```text
boss_hp -200
```

오답:

```text
my_hp -400
```

### 11-4. Phase 3 게이트

Phase 3 답안은 다음 조건에서만 유효하다.

```text
서버 세션 boss_hp <= 0
+
Phase 1~2 총 9정답 완료
+
세션 status == active
```

클라이언트가 phase를 3으로 보내는 것만으로 진입할 수 없다.

### 11-5. Phase 3 승리

정답이면:

```text
status = won
```

오답이면:

```text
phase3_tries += 1
```

최대 시도 횟수는 서버 세션이 관리한다.

---

## 12. 클리어 — `POST /boss/endboss/clear`

### 12-1. 보상 조건

다음 조건을 모두 만족해야 한다.

```text
유효한 사용자
+
유효한 battle_token
+
해당 사용자의 엔드보스 세션
+
세션 level 일치
+
세션 project 일치
+
세션 status == won
```

### 12-2. 처리 순서

```text
1. 사용자 인증
2. 이미 클리어한 레벨인지 확인
3. battle_token 검증
4. fresh user 세션 조회
5. status == won 확인
6. 최초 클리어 보상 지급
7. 칭호·진화·승급 반영
8. endboss_cleared_levels 갱신
9. 세션 consume
10. 응답 반환
```

### 12-3. 리플레이 방지

보상 지급 후 세션을 consume한다.

같은 토큰으로 `/clear`를 반복 호출해도 보상을 다시 지급하지 않는다.

### 12-4. 이미 클리어한 레벨의 멱등 처리

이미 `endboss_cleared_levels`에 포함된 레벨은 보상 재지급 없이 멱등 응답할 수 있다.

이 경로는 과거 클리어 이력과 재도전 UX를 보존하기 위한 하위 호환이다.

---

## 13. 채점

### 13-1. 직접 채점

다음 유형은 서버에서 직접 비교한다.

```text
output_select
multiple_choice
error_find
fill_in_blank
```

허용 가능한 정규화:

- 앞뒤 공백 제거
- 대소문자 무시가 안전한 경우
- 선택지 기호와 전체 텍스트 호환
- `A`와 `A. 정답 텍스트` 호환

### 13-2. 코드 채점

`code_input`은 현재 채점 서비스 계약을 따른다.

단, 채점 결과만 서버 세션에 반영하며 클라이언트의 성공 플래그를 신뢰하지 않는다.

### 13-3. 중복 제출

같은 `question_id`를 반복 제출해도 정답 누적이 중복 증가하면 안 된다.

서버 세션의 answered/correct question id 집합으로 방어한다.

---

## 14. 문제 선택과 재도전

### 14-1. 기본 정책

```text
unseen 문제 우선
→ 후보 복사
→ random.shuffle
→ 필요한 개수 선택
→ 선택된 question_id를 seen에 저장
```

### 14-2. 원본 불변

셔플은 복사본에만 적용한다.

```python
candidates = list(unseen)
random.shuffle(candidates)
chosen = candidates[:count]
```

원본 JSON 로드 순서를 직접 변경하지 않는다.

### 14-3. 풀 소진

unseen 문제가 필요한 수보다 적으면 기존 정책대로 해당 풀을 재오픈할 수 있다.

```text
seen 초기화
→ 전체 풀 복사
→ 셔플
→ 필요한 수 선택
```

### 14-4. 테스트 안정성

운영 코드에 고정 seed를 넣지 않는다.

테스트는 순서 자체가 아니라 다음 조건을 검증한다.

- 개수
- 중복 없음
- unseen 우선
- 원본 불변
- monkeypatch된 셔플 결과 반영

---

## 15. 도전 비용

### 15-1. 비용

```text
왕관 3개
```

최초 도전과 재도전 모두 `/start` 기준으로 차감한다.

### 15-2. 잔액 부족

왕관이 3개 미만이면 시작을 거부한다.

### 15-3. 동시성

왕관이 정확히 3개인 상태에서 동시 `/start` 두 개가 들어오면:

```text
1개 성공
1개 실패
최종 왕관 0
음수 불가
실패 요청 세션 미생성
```

---

## 16. 보상

### 16-1. 최초 클리어 보상

```python
BOSS_CLEAR_REWARD = 15000
CLEAR_CROWNS = 15
```

| 보상 | 수량 |
|---|---:|
| 코인 | 15,000 |
| 누적 랭킹점수 | 15,000 |
| 왕관 | 15 |
| GP | 0 |

### 16-2. XP 호환 필드

레거시 응답에 `xp_awarded` 필드가 남아 있을 수 있다.

이는 응답 호환 필드일 뿐 신규 XP 시스템 지급을 의미하지 않는다.

### 16-3. 미션

최초 클리어 시 `boss_clear` 계열 미션 이벤트를 발생시킬 수 있다.

반복 클리어로 미션이 중복 증가하지 않도록 최초 클리어 여부를 기준으로 한다.

---

## 17. 칭호

| 코스 | ID | 표시명 |
|---|---|---|
| beginner | `rookie_coder` | 코드 ROOKIE |
| intermediate | `ace_coder` | ACE 코더 |
| advanced | `ai_master` | AI 마스터 |

칭호는 최초 클리어 때 지급한다.

---

## 18. 진화

| 코스 | 진화 단계 | 캐릭터 |
|---|---:|---|
| beginner | 1 | `robot` |
| intermediate | 2 | `speech_bubble` |
| advanced | 3 | `final_ghost` |

원칙:

```text
evolution_stage를 저장
→ character는 stage에서 파생
```

이미 더 높은 진화 단계에 도달한 사용자를 낮은 단계로 되돌리지 않는다.

---

## 19. 코스 승급

엔드보스 최초 클리어 후 다음 코스를 해금한다.

개념:

```text
beginner 클리어
→ intermediate 접근 가능

intermediate 클리어
→ advanced 접근 가능

advanced 클리어
→ 최종 과정 완료
```

실제 승급은 `promote_course_level_from_endboss()`와 현재 커리큘럼 정책을 따른다.

---

## 20. 사용자 저장 상태

엔드보스 관련 주요 필드:

```text
course_level
max_unlocked_unit
endboss_cleared_levels
seen_questions
battle_sessions
crown
coin_balance
total_coin_earned
ranking_score
weekly_ranking_score
evolution_stage
character
titles
```

### 20-1. `endboss_cleared_levels`

예:

```json
["beginner", "intermediate"]
```

### 20-2. `seen_questions`

레벨·프로젝트·페이즈별 키를 사용한다.

예:

```text
endboss_beginner_account
endboss_p1_beginner_account
endboss_p2_beginner_account
```

### 20-3. `battle_sessions`

예시 개념:

```json
{
  "sid": {
    "mode": "endboss",
    "level": "beginner",
    "project": "account",
    "boss_hp": 1800,
    "my_hp": 1200,
    "phase": 1,
    "phase3_tries": 0,
    "status": "active",
    "exp": 0
  }
}
```

실제 저장 구조는 구현을 따른다.

---

## 21. API 요약

### `GET /boss/endboss/info`

목적:

- 선택한 레벨 상태
- 해금 여부
- 왕관 수
- 클리어 레벨
- 레벨 사다리 상태

### `POST /boss/endboss/start`

목적:

- 문제 풀 검증
- 왕관 원자 차감
- 랜덤 문제 선택
- `battle_token` 발급
- 서버 세션 생성

### `POST /boss/endboss/answer`

목적:

- 토큰 검증
- 서버 채점
- 서버 세션 HP·Phase·시도 횟수 갱신
- 승패 결정

### `POST /boss/endboss/clear`

목적:

- `won` 세션 검증
- 최초 클리어 보상
- 진화·칭호·승급
- 세션 consume

---

## 22. 프론트 화면

주요 파일:

```text
frontend/src/pages/EndBoss/EndBoss.jsx
frontend/src/pages/EndBoss/EndBossBattle.jsx
frontend/src/pages/EndBoss/EndBossIntro.jsx
```

### 22-1. HP

프론트 상수:

```text
BOSS_HP_INIT = 1800
BOSS_HP_MAX = 1800
MY_HP_INIT = 1200
MY_HP_MAX = 1200
```

백엔드 응답 이후에도 게이지 최대값이 1,800으로 유지되어야 한다.

### 22-2. 토큰 보관

`/start`에서 받은 `battle_token`을 전투 생명주기 동안 유지한다.

같은 토큰을 다음 요청에 전달한다.

```text
/answer
/clear
```

### 22-3. 재도전

재도전 시:

```text
새 /start 요청
→ 왕관 3개 차감
→ 새 battle_token
→ 새 서버 세션
→ HP 1,800/1,200 초기화
```

이전 세션의 HP나 Phase를 재사용하지 않는다.

### 22-4. 안내 문구

전투 안내는 다음과 일치해야 한다.

```text
Phase 1: 5문제
Phase 2: 4문제
Phase 3: 최대 3문제
총 최대 12문제
```

---

## 23. 오류 처리

권장 사용자 메시지:

| 상황 | 메시지 |
|---|---|
| 해금되지 않음 | 엔드보스가 아직 해금되지 않았습니다. |
| 왕관 부족 | 왕관이 부족합니다. |
| 문제 데이터 부족 | 엔드보스 문제 데이터가 부족합니다. 잠시 후 다시 시도해주세요. |
| 토큰 오류 | 전투 정보가 올바르지 않습니다. 다시 시작해주세요. |
| 세션 만료 | 전투 세션이 만료되었습니다. 다시 시작해주세요. |
| Phase 3 우회 | 아직 최종 페이즈에 진입할 수 없습니다. |
| 승리 전 clear | 전투 승리 후 클리어할 수 있습니다. |

로그에는 레벨·프로젝트·문제 수·세션 ID를 남길 수 있지만 정답과 민감정보는 출력하지 않는다.

---

## 24. 해결 완료 이력

### END-P0-1 — `/clear` 직접 호출 보상

과거 문제:

```text
실제 승리 증명 없이 /clear 호출 가능
```

해결:

```text
battle_token + 서버 세션 status=won 검증
→ 보상 지급
→ consume
```

### END-P0-2 — 클라이언트 HP 조작

과거 문제:

```text
boss_hp=1 전송
→ 한 번 정답 후 Phase 3 진입 가능
```

해결:

```text
HP는 서버 세션만 사용
클라이언트 HP는 비권위 표시값
```

### END-P0-3 — Phase 3 횟수 조작

과거 문제:

```text
phase3_tries=0 반복 전송
→ 최대 시도 제한 우회
```

해결:

```text
phase3_tries를 서버 세션에서만 증가
```

### END-P0-4 — 승리 세션 재사용

과거 문제:

```text
같은 clear 요청으로 보상 반복 가능성
```

해결:

```text
보상 지급 후 세션 consume
endboss_cleared_levels로 최초 보상 재확인
```

### END-P1-1 — 왕관 TOCTOU

과거 문제:

```text
왕관 확인과 차감이 분리
→ 동시 시작 요청이 모두 통과할 가능성
```

해결:

```text
mutate_user_atomic 내부에서 최신 잔액 확인·차감·세션 생성
```

### END-P1-2 — HP 1,400/1,800 불일치

과거 문제:

```text
백엔드 1,400
프론트 일부 1,800
```

해결:

```text
백엔드와 프론트 게이지를 1,800으로 통일
```

### END-P1-3 — Phase 3 문제 풀 미검증

과거 문제:

```text
Phase 3 문제가 부족해도 왕관 차감 후 시작 가능
```

해결:

```text
Phase 3 최소 3개를 왕관 차감 전에 검증
```

### END-P1-4 — 주석과 실제 셔플 불일치

과거 문제:

```text
주석은 셔플
실제 구현은 배열 앞부분 선택
```

해결:

```text
후보 복사본에 random.shuffle 적용
```

---

## 25. 회귀 테스트 기준

### 25-1. 서버 권위

- 세션 없이 `/clear` → 차단
- active 세션 `/clear` → 차단
- won 세션 `/clear` → 보상
- 보상 후 같은 세션 재사용 → 중복 보상 없음
- 다른 사용자 토큰 → 차단
- 다른 레벨 토큰 → 차단
- 다른 프로젝트 토큰 → 차단
- 만료 토큰 → 차단

### 25-2. HP·Phase

- 시작 boss HP = 1,800
- 시작 my HP = 1,200
- Phase 1 5정답 후 boss HP = 800
- 총 8정답 후 boss HP = 200
- 총 9정답 후 boss HP = 0
- 8정답 상태에서 Phase 3 불가
- 9정답 후 Phase 3 가능
- Phase 3 정답 후 `status=won`
- 클라이언트 `boss_hp=1` 무시
- 클라이언트 `phase3_tries=99` 무시

### 25-3. 문제 풀

- Phase 1이 5개 미만이면 시작 실패
- Phase 2가 4개 미만이면 시작 실패
- Phase 3가 3개 미만이면 시작 실패
- 데이터 부족 시 왕관 차감 없음
- 데이터 부족 시 seen 변경 없음
- 데이터 부족 시 세션 생성 없음
- 다른 프로젝트 문제를 합산하지 않음

### 25-4. 랜덤 출제

- 필요한 개수만 선택
- 한 배치 안에 question_id 중복 없음
- unseen 충분 시 seen 문제 미선택
- unseen 부족 시 재오픈 정책 유지
- 원본 pool 순서 불변
- 실제 셔플 결과 반영
- 테스트는 랜덤 확률에 의존하지 않음

### 25-5. 왕관 동시성

- 왕관 3개에서 동시 시작 두 건
- 한 건만 성공
- 최종 왕관 0
- 왕관 음수 불가
- 실패 요청 세션 미생성

### 25-6. 보상

- 최초 클리어만 코인 15,000
- 최초 클리어만 랭킹점수 15,000
- 최초 클리어만 왕관 15
- GP 0
- 칭호 1회
- 진화 단계 정상
- 다음 코스 승급 정상
- 재호출 보상 중복 없음

### 25-7. 프론트

- 빌드 성공
- 첫 렌더 HP 1,800
- `/start` 응답 후 HP 튐 없음
- 재도전 HP 초기화
- 9문제 후 Phase 3 표시
- 같은 battle_token을 `/answer`, `/clear`에 사용
- 총 최대 12문제 안내 일치

---

## 26. 배포 전 수동 확인

자동 테스트와 별도로 실제 브라우저에서 확인한다.

```text
1. 왕관 3개 이상인 해금 계정 로그인
2. 프로젝트 선택
3. 시작 직후 왕관 3개 차감 확인
4. 보스 HP 1,800 확인
5. Phase 1 5문제 진행
6. Phase 1 종료 후 HP 800 확인
7. Phase 2 3문제 정답 후 HP 200 및 Phase 3 미진입 확인
8. Phase 2 마지막 문제 정답 후 Phase 3 진입 확인
9. Phase 3 정답 후 클리어 보상 확인
10. 새로고침·뒤로가기·중복 클릭으로 보상 중복 여부 확인
11. 재도전 시 새 토큰·새 세션·HP 초기화 확인
```

Supabase 환경에서는 다음도 확인한다.

```text
battle_sessions 저장
세션 consume
왕관 원자 차감
endboss_cleared_levels 갱신
coin_balance 갱신
ranking_score 갱신
evolution_stage 갱신
titles 갱신
```

---

## 27. 구현 파일

### 백엔드

```text
backend/routers/endboss.py
backend/routers/battle_session.py
backend/routers/utils.py
backend/routers/storage.py
backend/data/endboss/beginner.json
backend/data/endboss/intermediate.json
backend/data/endboss/advanced.json
```

### 프론트

```text
frontend/src/pages/EndBoss/EndBoss.jsx
frontend/src/pages/EndBoss/EndBossBattle.jsx
frontend/src/pages/EndBoss/EndBossIntro.jsx
frontend/src/api/index.js
```

### 주요 테스트

```text
backend/tests/test_endboss_clear_requires_win.py
backend/tests/test_endboss_phase12_retry.py
backend/tests/test_endboss_hp_pool_random.py
```

---

## 28. 변경 금지 원칙

다음은 별도 기획 승인 없이 변경하지 않는다.

- 도전 비용 왕관 3개
- 최초 클리어 코인 15,000
- 최초 클리어 랭킹점수 15,000
- 최초 클리어 왕관 15
- GP 0
- Phase 1 5문제
- Phase 2 4문제
- Phase 3 최대 3회
- 보스 HP 1,800
- 플레이어 HP 1,200
- 정답 피해 200
- 오답 피해 400
- 서버 권위 전투 세션
- `won` 세션만 보상
- 보상 후 세션 consume
- 코스별 칭호와 진화 단계
- 하위 코스 인정 진입 정책

---

## 29. 최종 설계 원칙

1. 전투 상태는 서버가 소유한다.
2. 클라이언트 HP·Phase·시도 횟수는 신뢰하지 않는다.
3. Phase 1~2 총 9정답 후에만 Phase 3를 연다.
4. 전투 데이터가 부족하면 비용을 차감하지 않는다.
5. 왕관 차감과 세션 생성은 원자적으로 처리한다.
6. 문제는 unseen을 우선하되 실제 랜덤으로 선택한다.
7. 승리 세션만 클리어 보상을 받을 수 있다.
8. 보상 지급 후 세션을 consume한다.
9. 최초 클리어 보상은 한 번만 지급한다.
10. 문서·테스트·프론트 표시값은 백엔드 SSOT와 일치시킨다.

---

## 30. 현재 검증 상태

구현 보고 기준:

```text
엔드보스 테스트: 73 passed
전체 백엔드 테스트: 494 passed
프론트 build: 성공
```

관련 구현 보고 커밋:

```text
047e4c7fe2fd3689225ebf0758fc340f77c82d3b
fix(endboss): align HP and validate phase pools
```

이 커밋이 원격 `main`에 push되었는지는 별도로 확인해야 한다.
