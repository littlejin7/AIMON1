---

## title: AI MON — 엔드보스 설계version: "2.0"status:
current-with-known-riskssource_of_truth: GitHub main branch implementation and
backend/data/endbosslast_verified_commit: 830c0da32a3a2400bfa019e523448a506be74b7clast_verified_at: 2026-07-11

# AI-MON 엔드보스 설계

>
> 초급·중급·고급 코스의 최종 종합전, 코스 승급, 진화, 인증 보상을 담당하는 엔드보스 구현 기준
>

---

## 0. 문서 목적

이 문서는 다음 내용을 현재 구현 기준으로 정의합니다.

- 엔드보스 해금과 레벨 사다리
- 코스별 프로젝트 선택
- 3페이즈 전투
- 문제 데이터와 채점
- 도전 비용과 보상
- 진화와 코스 승급
- 프론트·백엔드 상태 계약
- 현재 확인된 보안·정합성 문제
- 수정 우선순위와 회귀 테스트

실제 코드와 충돌하면 다음 파일이 우선합니다.

```text
backend/routers/endboss.py  
backend/data/endboss/  
frontend/src/pages/EndBoss/
```

관련 문서:

- `AI_MON_PROPOSAL.md`
- `AI_MON_PIPELINE.md`
- `AI_MON_SCHEMA.md`
- `AI_MON_MISSIONS.md`

---

## 1. 현재 상태 요약


| 항목                  | 현재 구현                                                                           |
|-------------------------|-----------------------------------------------------------------------------------------|
| 경로                  | `/boss/endboss`                                                                         |
| 데이터               | `backend/data/endboss/{course_level}.json`                                              |
| 코스                  | beginner / intermediate / advanced                                                      |
| 프로젝트            | 코스별 4개                                                                          |
| 전투                  | Phase 1~3                                                                               |
| 도전 비용           | 매 시작 시 왕관 3개                                                              |
| 힌트                  | 사용 불가                                                                           |
| 보상                  | `BOSS_CLEAR_REWARD=15000` 기준 코인 15,000 + 누적 랭킹점수 15,000 + 왕관 15 |
| GP                      | 지급하지 않음                                                                     |
| 칭호                  | 코스별 1개                                                                          |
| 진화                  | 초급→1, 중급→2, 고급→3                                                      |
| 중복 보상           | `endboss_cleared_levels`                                                                |
| 미션                  | 최초 클리어 시 `boss_clear`                                                       |
| 현재 서버 보스 HP | 1,400                                                                                   |
| 현재 플레이어 HP  | 1,200                                                                                   |
| 현재 주요 위험    | 서버 권위 전투 세션 없음, `/clear` 승리 증명 없음                       |


---

## 2. 서비스 내 역할

엔드보스는 일반 보스보다 범위가 큽니다.

```text
Unit 1~8 학습  
↓  
Unit 8 유닛보스 클리어  
↓  
엔드보스 해금  
↓  
프로젝트 선택  
↓  
3페이즈 종합전  
↓  
코스별 최초 클리어  
├─ 코인·랭킹·왕관  
├─ 칭호  
├─ 진화 단계 상승  
├─ 다음 코스 승급  
└─ 인증카드 상태
```

엔드보스 클리어는 캐릭터 진화의 유일한 트리거입니다.

---

## 3. 레벨 사다리

### 3-1. 표시 상태


| 상태       | 의미                                      | 진입                                 |
|--------------|---------------------------------------------|---------------------------------------:|
| `cleared`    | 해당 코스 엔드보스 클리어        | 가능                                 |
| `recognized` | 레벨 테스트 배치보다 낮은 코스 | 가능                                 |
| `current`    | 현재 진행 코스                        | Unit 8 보스 조건 충족 시 가능 |
| `locked`     | 아직 해금되지 않은 상위 코스    | 불가                                 |


### 3-2. 선택 가능 레벨

선택 가능한 레벨은 다음 합집합입니다.

```text
엔드보스 클리어 이력으로 해금된 레벨  
+  
현재 course_level 이하의 레벨
```

예:

```text
course_level = intermediate  
endboss_cleared_levels = []
```

표시:


| 레벨       | 상태     |
|--------------|------------|
| beginner     | recognized |
| intermediate | current    |
| advanced     | locked     |


### 3-3. 현재 코스 해금

현재 코스 엔드보스는 다음 조건으로 해금됩니다.

```text
max_unlocked_unit[course_level] > 8
```

즉, 해당 코스 Unit 8 유닛보스 클리어 후 다음 유닛 해금 값이 9 이상이 된 상태입니다.

### 3-4. 하위 코스 인정 진입

레벨 테스트 결과가 intermediate 또는 advanced라면 하위 코스를 직접 도전할 수 있습니다.

이는 하위 코스의 Unit 1~8 진행을 강제하지 않는 “진행 인정” 정책입니다.

### 3-5. 이미 클리어한 코스

`endboss_cleared_levels`에 포함된 코스는 다시 진입할 수 있습니다.

재도전은 가능하지만 클리어 보상은 다시 지급되지 않습니다.

---

## 4. 코스별 프로젝트

### Beginner


| ID          | 표시명           |
|-------------|---------------------|
| `account`   | 가계부 시스템 |
| `wordchain` | 끝말잇기 봇    |
| `grade`     | 성적 관리기    |
| `gpa`       | 학점 계산기    |


### Intermediate


| ID           | 표시명                  |
|--------------|----------------------------|
| `todo`       | TODO 매니저             |
| `contact`    | 연락처 앱              |
| `log_parser` | 로그 파서              |
| `weather`    | 날씨 API 클라이언트 |


### Advanced


| ID               | 표시명                     |
|------------------|-------------------------------|
| `ai_agent`       | AI 에이전트               |
| `async_api`      | 비동기 API 클라이언트 |
| `fastapi_server` | FastAPI AI 서버             |
| `langchain_bot`  | LangChain RAG 봇             |


프로젝트는 문제 필터 키입니다.

```text
course_level + project + phase
```

조합으로 해당 배틀의 문제 풀을 결정합니다.

---

## 5. 데이터 파일

```text
backend/data/endboss/  
├─ beginner.json  
├─ intermediate.json  
└─ advanced.json
```

과거 `finalboss` 명칭의 데이터 디렉터리는 현재 사용하지 않습니다.

### 5-1. 문제 객체

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
"choices": [  
"A. 선택지"  
],  
"answer": "A",  
"explanation": "해설",  
"feedback": {  
"correct": "정답 피드백",  
"incorrect": "오답 피드백"  
}  
}
```

### 5-2. 레거시 명칭

파일과 라우터는 `endboss`이지만 현재 문제의 `quiz_category`는 `final_boss`입니다.

```text
경로·API: endboss  
데이터 카테고리: final_boss
```

일괄 치환 전 로더, 테스트, 데이터 제작 도구를 확인해야 합니다.

### 5-3. 문제 조회 보안

클라이언트에 전달할 때 다음 필드를 제거합니다.

- `answer`
- `feedback`
- `hint`
- `explanation`

정답은 답안 제출 후 결과 화면에 필요한 범위로만 반환합니다.

---

## 6. 페이즈 구조

### 6-1. Phase 1 — 분석전


| 항목        | 값                          |
|---------------|------------------------------|
| 출제 수    | 5                            |
| 문제 성격 | 코드 읽기·개념 판단 |
| HP            | 사용                       |
| 정답        | 보스 HP 감소             |
| 오답        | 플레이어 HP 감소       |


### 6-2. Phase 2 — 역전전


| 항목        | 값                                 |
|---------------|-------------------------------------|
| 출제 수    | 최대 4                            |
| 문제 성격 | 오류 찾기·코드 완성        |
| HP            | 사용                              |
| 정답        | 보스 HP 감소                    |
| 오답        | 플레이어 HP 감소              |
| 전환        | 보스 HP가 0 이하이면 Phase 3 |


### 6-3. Phase 3 — 결정타


| 항목        | 값                     |
|---------------|-------------------------|
| 1회 출제   | 1문제                 |
| 최대 오답 | 3회                    |
| 정답        | 즉시 전투 클리어 |
| 오답        | 새 문제 출제       |
| HP            | 사용하지 않음     |
| UI            | 하트 3개             |


### 6-4. 문제 수 표현

프론트 인트로에는 “3페이즈·총 12문제”가 표시됩니다.

의도된 최대 구성:

```text
Phase 1: 5  
Phase 2: 4  
Phase 3: 최대 3  
합계: 최대 12
```

그러나 현재 서버 보스 HP가 1,400이므로 모든 Phase 1 문제를 맞히면 Phase 2에서 2문제 정답 후 Phase 3로 전환됩니다.

현재 서버 동작의 실제 최대 정답 경로:

```text
Phase 1 정답 5회 → 보스 HP 400  
Phase 2 정답 2회 → 보스 HP 0  
Phase 3 진입
```

따라서 Phase 1~2의 9문제를 반드시 모두 푸는 설계와 현재 HP 상수가 일치하지 않습니다.

---

## 7. 코스별 문제 유형


| 페이즈 | Beginner                           | Intermediate                     | Advanced                      |
|-----------|------------------------------------|----------------------------------|-------------------------------|
| Phase 1   | `output_select`, `multiple_choice` | `output_select`, `fill_in_blank` | `fill_in_blank`, `error_find` |
| Phase 2   | `error_find`                       | `error_find`                     | `code_input`                  |
| Phase 3   | `fill_in_blank`                    | `code_input`                     | `code_input`                  |


현재 백엔드 `PHASE_TYPES` 상수는 설계 정보로 존재하지만, 답안 제출 시 문제 유형을 강제 검증하는 게이트로 사용되지는 않습니다.

---

## 8. 채점

### 8-1. 직접 채점

다음 유형은 서버 원본 정답과 직접 비교합니다.

- `output_select`
- `multiple_choice`
- `error_find`
- `fill_in_blank`
- `code_multi_input`

### 8-2. Claude 채점

`code_input`은 Claude JSON 채점을 사용합니다.


| 코스       | 정답 기준                                              |
|--------------|------------------------------------------------------------|
| Beginner     | 핵심 로직 중심, 0 또는 100                         |
| Intermediate | 기능 60% + 구조·효율 40%, 60점 이상              |
| Advanced     | 기능 50% + 구조 30% + 예외·엣지 20%, 70점 이상 |


### 8-3. 채점 실패

AI 채점 실패 시:

- HP를 변경하지 않음
- Phase 3 시도 횟수를 올리지 않음
- 클리어·실패 처리하지 않음

### 8-4. 풀이 기록

채점 성공 시 `attempts`에 저장합니다.

```json
{  
"mode": "endboss",  
"stage": "endboss-p1",  
"level": "advanced",  
"is_correct": true  
}
```

---

## 9. HP 규칙

현재 백엔드:


| 값                    | 수치             |
|------------------------|-------------------:|
| 보스 시작 HP       | 1,400              |
| 플레이어 시작 HP | 1,200              |
| 정답 피해          | 200                |
| 오답 피해          | 400                |
| 플레이어 패배    | HP 0 이하        |
| Phase 3 진입         | 보스 HP 0 이하 |


현재 전투 컴포넌트의 HP 게이지 최대값도 1,400 / 1,200입니다.

그러나 상위 `EndBoss.jsx`의 초기화 상수는 아직 1,800 / 1,200입니다.

### 9-1. 결정 필요

#### 선택 A — Phase 1~2 전체 9문제 강제

```text
보스 HP = 1,800  
정답 피해 = 200
```

- 기존 기획 의도와 일치
- Phase 1 5개 + Phase 2 4개를 모두 정답 처리해야 Phase 3
- `EndBoss.jsx`, `EndBossBattle.jsx`, 백엔드 상수 통일 필요

#### 선택 B — 현재 1,400 유지

- Phase 2가 조기 종료될 수 있음을 설계에 명시
- 인트로의 “총 12문제” 표현 수정
- Phase 2의 남은 문제를 건너뛰는 UX 확인

현재 제품 설명과 문제 구성상 선택 A가 더 일관되지만, 코드 변경 전 팀 결정이 필요합니다.

---

## 10. 전투 시작

### 10-1. 요청

```json
{  
"project": "account",  
"target_level": "beginner"  
}
```

### 10-2. 서버 처리

```text
레벨 결정  
  ↓  
해금 확인  
  ↓  
왕관 3개 확인  
  ↓  
문제 데이터 로드  
  ↓  
Phase 1 최소 5개 확인  
  ↓  
Phase 2 최소 4개 확인  
  ↓  
왕관 차감  
  ↓  
Phase 1·2 문제 선정  
  ↓  
Phase 3 첫 문제 선정  
  ↓  
seen_questions 저장
```

### 10-3. 응답

```json
{  
"phase": 1,  
"project": "account",  
"phase1_questions": [],  
"phase2_questions": [],  
"phase3_first_question": {},  
"my_hp": 1200,  
"boss_hp": 1400,  
"crowns_left": 2  
}
```

### 10-4. 문제 선정

Phase 1·2:

- 이전에 안 본 문제 우선
- 풀 소진 시 이력 초기화
- 현재 구현은 배열 앞쪽부터 선택하며 실제 랜덤 shuffle은 수행하지 않음

Phase 3:

- 첫 문제는 풀의 첫 번째 문제
- 오답 시 seen 이력에서 다음 미출제 문제 선택
- 전부 소진 시 현재 문제를 제외하고 재오픈

---

## 11. 답안 제출

### 11-1. 현재 요청

```json
{  
  "question_id": "endboss_beg_account_p1_001",  
  "user_answer": "A",  
  "phase": 1,  
  "my_hp": 1200,  
  "boss_hp": 1400,  
  "phase3_tries": 0,  
  "project": "account",  
  "target_level": "beginner"  
}
```

### 11-2. 현재 응답

```json
{  
"is_correct": true,  
"score": 100,  
"feedback": "정답입니다.",  
"my_hp": 1200,  
"boss_hp": 1200,  
"is_fail": false,  
"phase3_ready": false,  
"phase3_tries": 0,  
"is_clear": false,  
"next_phase3_question": null,  
"correct_answer": "A"  
}
```

### 11-3. 현재 권위 구조

현재 서버는 요청의 다음 값을 범위 안으로 제한한 뒤 계산에 사용합니다.

- `my_hp`
- `boss_hp`
- `phase3_tries`
- `phase`
- `project`

이는 값의 최대·최소만 막을 뿐, 실제 이전 서버 상태와 이어지는지는 검증하지 않습니다.

---

## 12. 클리어 처리

### 12-1. 요청

```json
{  
  "project": "account",  
  "target_level": "beginner"  
}
```

### 12-2. 최초 클리어

한 원자적 사용자 변경 안에서 처리합니다.

```text
endboss_cleared_levels 확인  
↓  
왕관 15개  
↓  
evolution_stage 상승  
↓  
character 파생  
↓  
코스 칭호  
↓  
코인 15,000  
↓  
누적 랭킹점수 15,000  
↓  
boss_clear 미션 이벤트  
↓  
클리어 레벨 기록  
↓  
다음 코스 승급  
↓  
seen 초기화
```

### 12-3. 재클리어

이미 `endboss_cleared_levels`에 있으면:

- 보상 없음
- 진화 변화 없음
- 미션 진척 없음
- `already_cleared=true`

---

## 13. 보상


| 보상              | Beginner | Intermediate | Advanced |
|---------------------|---------:|-------------:|---------:|
| 코인              | 15,000   | 15,000       | 15,000   |
| 누적 랭킹점수 | 15,000   | 15,000       | 15,000   |
| GP                  | 0        | 0            | 0        |
| 왕관              | 15       | 15           | 15       |


레거시 응답 `xp_awarded`는 15,000을 반환할 수 있지만 실제 신규 XP는 증가하지 않습니다.

### 13-1. 칭호


| 코스       | ID             | 표시명     |
|--------------|----------------|---------------|
| Beginner     | `rookie_coder` | 코드 ROOKIE |
| Intermediate | `ace_coder`    | ACE 코더    |
| Advanced     | `ai_master`    | AI 마스터  |


### 13-2. 미션

코스별 최초 클리어는:

```text
event_type = boss_clear
```

를 발생시켜 위클리 `w_boss2` 진척에 포함됩니다.

---

## 14. 진화


| 엔드보스 | 목표 `evolution_stage` | 캐릭터       |
|--------------|-------------------------:|-----------------|
| Beginner     | 1                        | `robot`         |
| Intermediate | 2                        | `speech_bubble` |
| Advanced     | 3                        | `final_ghost`   |


진화는 `max()`로 처리하므로 하위 코스를 재클리어해도 강등되지 않습니다.

```text
현재 단계 2  
+ Beginner 엔드보스 클리어  
→ max(2, 1)  
→ 단계 2 유지
```

Advanced 클리어 후부터 GP 기반 레벨 성장이 활성화됩니다.

엔드보스 자체는 GP를 지급하지 않습니다.

---

## 15. 코스 승급

클리어 후 `promote_course_level_from_endboss()`가 실행됩니다.

대표 흐름:

```text
Beginner 엔드보스 최초 클리어  
  ↓  
Intermediate 해금·진행 가능  
  
Intermediate 엔드보스 최초 클리어  
  ↓  
Advanced 해금·진행 가능  
  
Advanced 엔드보스 최초 클리어  
  ↓  
최종 진화 완료
```

클리어 이력은 `endboss_cleared_levels`가 단일 진실입니다.

---

## 16. 사용자 저장 상태

### `endboss_cleared_levels`

```json
[  
"beginner",  
"intermediate"  
]
```

용도:

- 중복 보상 방지
- 레벨 사다리 상태
- 코스 해금
- 진화
- 인증 상태

### `seen_questions`

```json
{  
  "endboss_p1_beginner_account": [],  
  "endboss_p2_beginner_account": [],  
  "endboss_beginner_account": [],  
  "endboss": []  
}
```

- P1·P2는 코스·프로젝트·페이즈별 키
- P3는 코스·프로젝트 키
- `endboss`는 레거시 호환 키

### 신규 별도 `endboss_seen_questions`

현재 별도 필드는 사용하지 않습니다.

기존 문서의 `endboss_seen_questions` 설명은 폐기합니다.

---

## 17. API

```text
GET  /boss/endboss/info  
POST /boss/endboss/start  
POST /boss/endboss/answer  
POST /boss/endboss/clear
```

### `GET /info`

주요 응답:

```json
{  
  "is_unlocked": true,  
  "crowns": 5,  
  "retry_cost": 3,  
  "cleared_levels": [],  
  "already_cleared": false,  
  "course_level": "beginner",  
  "unlocked_levels": [  
    "beginner"  
  ],  
  "levels": [  
    {  
      "level": "beginner",  
      "status": "current",  
      "enterable": true  
    }  
  ]  
}
```

---

## 18. 프론트 화면

### 인트로

- 레벨 사다리
- 프로젝트 선택
- 왕관 비용
- 힌트 불가
- 전투 구조
- 시작 버튼

### 전투

- Phase 전환 연출
- 문제 유형 배지
- 플레이어·보스 HP
- Phase 3 하트
- 정오답 피드백
- 제출 중 ref-lock

### 결과

- 성공·실패
- 코인·왕관
- 진화
- 칭호
- 다음 코스
- 재도전

---

## 19. 현재 P0 문제

### END-P0-1 — `/clear`에 승리 증명 없음

현재 `/boss/endboss/clear`는:

- 사용자
- 프로젝트
- 목표 레벨
- 중복 클리어 여부

만 확인합니다.

Phase 3 정답 또는 전투 승리 상태를 서버에서 확인하지 않습니다.

따라서 엔드보스가 해금된 사용자가 `/clear`를 직접 호출하면 최초 보상을 받을 수 있는 구조입니다.

#### 수정 원칙

유닛보스·미니보스와 동일한 서버 권위 세션을 사용합니다.

```text
/start  
↓  
서버 battle_token + sid 발급  
↓  
서버에 phase, HP, 출제 문제, 시도 횟수 저장  
↓  
/answer는 token 기반 상태 변경  
↓  
status=won  
↓  
/clear에서 won 확인  
↓  
보상 지급 후 세션 consume
```

### END-P0-2 — 클라이언트 HP·시도 횟수 신뢰

현재 `/answer`는 클라이언트가 보낸 다음 값을 계산 기준으로 사용합니다.

- `my_hp`
- `boss_hp`
- `phase3_tries`

가능한 위조 예:

```text
boss_hp=1 전송  
→ 정답 1회  
→ Phase 3 진입  
  
phase3_tries=0 반복 전송  
→ 최대 3회 제한 우회
```

범위 clamp는 연속 상태 위조를 막지 못합니다.

#### 수정 원칙

요청에서 제거:

```text
my_hp  
boss_hp  
phase3_tries
```

서버 세션에서 파생해 응답만 반환합니다.

### END-P0-3 — 문제·페이즈·프로젝트 소유 검증 없음

현재 `question_id`로 전체 레벨 문제에서 문제를 찾은 뒤, 요청의 `phase`와 `project`를 별도로 사용합니다.

반드시 검증해야 할 항목:

- 해당 question_id가 현재 세션에서 출제됐는지
- 문제의 `phase`가 요청 단계와 같은지
- 문제의 `project`가 배틀 프로젝트와 같은지
- 같은 문제를 반복 정답 처리하지 않았는지
- target_level이 시작 레벨과 같은지

---

## 20. 현재 P1 문제

### END-P1-1 — HP 상수 불일치


| 위치                      | 값   |
|-----------------------------|------:|
| 백엔드 `BOSS_HP_INIT`    | 1,400 |
| `EndBossBattle` 최대 HP   | 1,400 |
| `EndBoss.jsx` 초기 상수 | 1,800 |
| 과거 기획               | 1,800 |


한 곳의 응답 또는 공통 설정을 단일 진실로 사용해야 합니다.

### END-P1-2 — 9문제 설계와 HP 계산 불일치

보스 HP 1,400이면 7정답에 Phase 3가 열립니다.

Phase 1~2 전 문제를 필수로 만들려면 1,800이 필요합니다.

### END-P1-3 — 왕관 차감 원자성

`/start`는 현재 사용자 객체에서 왕관을 검사한 뒤 직접 차감하고 `save_user()`합니다.

동시 시작 요청에서:

- 둘 다 잔액 검사를 통과
- 왕관이 중복 차감
- 음수 또는 의도하지 않은 상태

가능성을 제거하려면 검사·차감·seen 기록을 `mutate_user_atomic` 안에 둬야 합니다.

### END-P1-4 — Phase 3 문제 수 검증 없음

`/start`는 P1 최소 5개, P2 최소 4개만 검사합니다.

P3 문제가 없더라도 시작할 수 있습니다.

최대 3회 새 문제를 보장하려면 프로젝트별 P3 최소 3개를 검증해야 합니다.

### END-P1-5 — 문제 선정 설명과 구현 불일치

주석은 shuffle이라고 적혀 있지만 현재 함수는 배열 순서대로 앞 문제를 선택합니다.

- 랜덤 출제를 원하면 실제 shuffle 필요
- 고정 출제를 원하면 문구 수정 필요

---

## 21. 수정 권장 순서

```text
1. 서버 권위 Endboss 세션 도입  
2. /clear 승리 세션 검증  
3. 클라이언트 HP·phase3_tries 제거  
4. 문제·페이즈·프로젝트·레벨 검증  
5. 시작 비용과 세션 생성을 원자 처리  
6. HP 1,400 vs 1,800 제품 결정  
7. 프론트·백엔드 HP 단일화  
8. Phase 3 문제 수 검증  
9. 문제 선정 정책 정리  
10. 레거시 final_boss 명칭 정리 검토
```

보상 밸런스와 애니메이션보다 1~5가 우선입니다.

---

## 22. 서버 세션 권장 구조

```json
{  
"sid": "server-nonce",  
"mode": "endboss",  
"user_id": "uuid",  
"level": "beginner",  
"project": "account",  
"phase": 1,  
"my_hp": 1200,  
"boss_hp": 1800,  
"phase3_tries": 0,  
"served_qids": [],  
"answered_qids": [],  
"status": "active",  
"exp": 1780000000  
}
```

허용 상태:

- `active`
- `won`
- `lost`
- `consumed`

### 상태 전환

```text
active  
  ├─ HP 0 → lost  
  ├─ Phase 3 3오답 → lost  
  └─ Phase 3 정답 → won  
  
won  
  └─ clear 보상 → consumed
```

---

## 23. 회귀 테스트

### 해금·사다리

- 현재 코스 Unit 8 미완료 → 진입 불가
- Unit 8 보스 완료 → 진입 가능
- 하위 코스 recognized 진입
- 상위 코스 locked
- 클리어 코스 재진입
- 잘못된 target_level 400
- 선택 불가 target_level 403

### 시작

- 왕관 3개 차감
- 왕관 2개 이하 거부
- 동시 시작 2회 잔액 무결성
- 잘못된 프로젝트 거부
- P1 5개 미만 거부
- P2 4개 미만 거부
- P3 3개 미만 거부
- 정답 비공개
- 세션 토큰 소유자 검증

### 답안

- 서버 세션 HP만 사용
- 클라이언트 HP 필드 무시 또는 422
- 출제되지 않은 question_id 거부
- 다른 프로젝트 문제 거부
- 다른 페이즈 문제 거부
- 같은 문제 반복 정답 중복 피해 없음
- grading_failed 상태 변화 없음
- Phase 3 시도 횟수 서버 누적
- 3오답 실패
- 정답 즉시 won

### 클리어

- 전투 없이 `/clear` 거부
- active 세션 거부
- lost 세션 거부
- 다른 사용자 세션 거부
- won 세션만 보상
- 동시 clear 한 번만 지급
- 세션 consume 후 재사용 거부
- 코스별 재클리어 보상 없음

### 보상·진화

- 코인 15,000
- 누적 랭킹 15,000
- GP 0
- 왕관 15
- 코스 칭호
- `boss_clear` 미션 최초 1회
- 초급 진화 1
- 중급 진화 2
- 고급 진화 3
- 하위 재클리어 강등 없음
- 다음 코스 승급

### 프론트

- 백엔드 HP와 게이지 최대값 일치
- Phase 1→2 전환
- Phase 2→3 전환
- Phase 3 하트 서버 값 표시
- 제출 연타 차단
- API 실패 시 lock 해제
- 클리어 응답 후 사용자 상태 갱신
- 진화 연출 우선
- 재도전 시 상태 초기화

---

## 24. 구현 파일

### 백엔드

- `backend/routers/endboss.py`
- `backend/routers/battle_session.py`
- `backend/routers/user_state.py`
- `backend/routers/storage.py`
- `backend/routers/quiz.py`
- `backend/data/endboss/beginner.json`
- `backend/data/endboss/intermediate.json`
- `backend/data/endboss/advanced.json`

### 프론트엔드

- `frontend/src/pages/EndBoss/EndBoss.jsx`
- `frontend/src/pages/EndBoss/EndBossIntro.jsx`
- `frontend/src/pages/EndBoss/EndBossBattle.jsx`
- `frontend/src/pages/EndBoss/EndBossPhaseTransition.jsx`
- `frontend/src/pages/EndBoss/EndBossResult.jsx`
- `frontend/src/api/index.js`

---

## 25. 최종 설계 원칙

1. 엔드보스 승패는 서버 세션이 결정합니다.
2. 클라이언트 HP와 시도 횟수를 신뢰하지 않습니다.
3. 보상은 `won` 세션에서 정확히 한 번만 지급합니다.
4. 코스별 최초 클리어만 진화·칭호·재화를 지급합니다.
5. 하위 코스 재도전으로 진화 단계가 내려가지 않습니다.
6. 도전 비용 검사와 차감은 원자적으로 처리합니다.
7. 정답은 제출 전에 클라이언트로 보내지 않습니다.
8. 코스·프로젝트·페이즈·문제 소유 관계를 검증합니다.
9. HP와 문제 수 설계는 프론트·백엔드 한 기준을 사용합니다.
10. 운영 전 P0 서버 권위 문제를 먼저 해결합니다.


 
