---

## notion_page: [https://app.notion.com/p/AI-MON-MISSIONS-373ea473fb45813a8d91cd58551751ab](https://app.notion.com/p/AI-MON-MISSIONS-373ea473fb45813a8d91cd58551751ab)title: AI MON MISSIONSversion: "2.0"status: currentsource_of_truth: GitHub main branch code and backend/data/missions.jsonlast_verified_commit: 830c0da32a3a2400bfa019e523448a506be74b7clast_verified_at: 2026-07-11

# AI-MON 데일리·위클리 미션

>
> 실제 미션 정의, 진척 이벤트, 수동 보상 수령, 저장 구조, 홈 UI,  

> 동시성 방어와 현재 확인된 정합성 문제를 정리한 구현 기준 문서
>

---

## 0. 문서 목적

이 문서는 AI-MON 미션 시스템의 현재 동작을 설명합니다.

- 어떤 미션이 실제로 존재하는지
- 어떤 사용자 행동이 진척으로 계산되는지
- 데일리·위클리 기간이 언제 바뀌는지
- 보상이 어떤 재화로 지급되는지
- 수령이 어떻게 중복 방지되는지
- 홈 화면과 하단 내비게이션에 어떻게 표시되는지
- 현재 코드에서 보완해야 할 지점이 무엇인지

관련 문서:

- 전체 서비스: [`AI_MON_PROPOSAL.md`](./AI_MON_PROPOSAL.md)
- 시스템 흐름: [`AI_MON_PIPELINE.md`](./AI_MON_PIPELINE.md)
- 데이터 구조: [`AI_MON_SCHEMA.md`](./AI_MON_SCHEMA.md)

실제 동작이 문서와 충돌하면 GitHub `main` 브랜치의 코드와 `backend/data/missions.json`이 우선합니다.

---

## 1. 현재 구현 요약


| 항목               | 현재 상태                             |
|----------------------|-------------------------------------------|
| 데일리 미션     | 3종                                      |
| 위클리 미션     | 3종                                      |
| 진척 방식        | 사용자 행동 발생 시 이벤트 훅 |
| 데일리 기준     | KST 날짜                                |
| 위클리 기준     | KST 기준 ISO 주차                     |
| 기간 초기화     | 접근 시 lazy reset                     |
| 보상 수령        | 전 미션 수동 수령                  |
| 보상 저장        | `mutate_user_atomic`                      |
| 미션 정의        | `backend/data/missions.json`              |
| 사용자 진척     | `users.missions` JSONB                    |
| 프론트 표시     | 홈 `MissionWidget`                       |
| 수령 가능 알림 | 홈 탭 빨간 점                        |
| 별도 스케줄러  | 사용하지 않음                       |
| GP 지급            | 없음                                    |
| 레거시 보상 키 | `reward.xp`, `xp_awarded`                 |


### 핵심 원칙

```text
사용자 행동  
  ↓  
도메인 라우터가 이벤트 발생  
  ↓  
bump_mission(user, event)  
  ↓  
데일리·위클리 정의를 동시에 확인  
  ↓  
일치하는 미션만 progress 증가  
  ↓  
사용자가 홈에서 수령 버튼 클릭  
  ↓  
POST /missions/claim  
  ↓  
원자적 중복 검증·보상 지급
```

---

## 2. 현재 미션 6종

정적 정의 파일:

```text
backend/data/missions.json
```

---

## 3. 데일리 미션

### 3-1. 스테이지 퀴즈 3회 클리어


| 항목        | 값                                  |
|---------------|--------------------------------------|
| `mission_id`  | `d_quiz3`                            |
| 표시명     | 스테이지 퀴즈 3회 클리어   |
| 이벤트     | `stage_clear`                        |
| 목표        | 3                                    |
| 정의 보상 | `xp: 300`                            |
| 실제 지급 | 코인 300 + 누적 랭킹점수 300 |
| GP            | 0                                    |
| 수령        | 수동                               |

```json
{  
  "mission_id": "d_quiz3",  
  "title": "스테이지 퀴즈 3회 클리어",  
  "event": "stage_clear",  
  "goal": 3,  
  "reward": {  
    "xp": 300  
  }  
}
```

### 3-2. 오답 1개 복습


| 항목        | 값                                  |
|---------------|--------------------------------------|
| `mission_id`  | `d_review`                           |
| 표시명     | 오답 1개 복습                   |
| 이벤트     | `review_done`                        |
| 목표        | 1                                    |
| 정의 보상 | `xp: 150`                            |
| 실제 지급 | 코인 150 + 누적 랭킹점수 150 |
| GP            | 0                                    |
| 수령        | 수동                               |

```json
{  
"mission_id": "d_review",  
"title": "오답 1개 복습",  
"event": "review_done",  
"goal": 1,  
"reward": {  
"xp": 150  
}  
}
```

### 3-3. 오늘도 출석


| 항목        | 값                |
|---------------|--------------------|
| `mission_id`  | `d_login`          |
| 표시명     | 오늘도 출석   |
| 이벤트     | `login`            |
| 목표        | 1일               |
| 보상        | 왕관 1개        |
| 수령        | 수동             |
| 중복 방지 | `daily.login_days` |

```json
{  
  "mission_id": "d_login",  
  "title": "오늘도 출석",  
  "event": "login",  
  "goal": 1,  
  "reward": {  
    "crowns": 1  
  }  
}
```

> 
> 출석 미션은 자동 지급되지 않습니다. 로그인 시 진척만 완료되고 홈의 `수령하기` 버튼을 눌러야 왕관이 지급됩니다.
> 

---

## 4. 위클리 미션

### 4-1. 보스 2회 처치


| 항목        | 값                                                 |
|---------------|-----------------------------------------------------|
| `mission_id`  | `w_boss2`                                           |
| 표시명     | 보스 2회 처치                                  |
| 이벤트     | `boss_clear`                                        |
| 목표        | 2                                                   |
| 정의 보상 | `xp: 1500`, 왕관 2개                             |
| 실제 지급 | 코인 1,500 + 누적 랭킹점수 1,500 + 왕관 2 |
| GP            | 0                                                   |
| 수령        | 수동                                              |

```json
{  
"mission_id": "w_boss2",  
"title": "보스 2회 처치",  
"event": "boss_clear",  
"goal": 2,  
"reward": {  
"xp": 1500,  
"crowns": 2  
}  
}
```

현재 `boss_clear`를 발생시키는 대표 경로:

- 유닛보스 최초 클리어
- 엔드보스 코스별 최초 클리어

스테이지 미니보스는 `miniboss_clear` 이벤트를 사용하므로 `w_boss2`에 포함되지 않습니다.

### 4-2. 주 5일 출석


| 항목        | 값                                                 |
|---------------|-----------------------------------------------------|
| `mission_id`  | `w_streak5`                                         |
| 표시명     | 주 5일 출석                                     |
| 이벤트     | `login`                                             |
| 목표        | 서로 다른 5일                                  |
| 정의 보상 | `xp: 2000`, 왕관 3개                             |
| 실제 지급 | 코인 2,000 + 누적 랭킹점수 2,000 + 왕관 3 |
| GP            | 0                                                   |
| 수령        | 수동                                              |
| 중복 방지 | `weekly.login_days`                                 |

```json
{  
  "mission_id": "w_streak5",  
  "title": "주 5일 출석",  
  "event": "login",  
  "goal": 5,  
  "reward": {  
    "xp": 2000,  
    "crowns": 3  
  }  
}
```

같은 날 여러 번 로그인해도 1일만 계산합니다.

### 4-3. AI 피드백 5회 활용


| 항목        | 값                                  |
|---------------|--------------------------------------|
| `mission_id`  | `w_ai5`                              |
| 표시명     | AI 피드백 5회 활용             |
| 이벤트     | `ai_feedback`                        |
| 목표        | 5                                    |
| 정의 보상 | `xp: 800`                            |
| 실제 지급 | 코인 800 + 누적 랭킹점수 800 |
| GP            | 0                                    |
| 수령        | 수동                               |

```json
{  
"mission_id": "w_ai5",  
"title": "AI 피드백 5회 활용",  
"event": "ai_feedback",  
"goal": 5,  
"reward": {  
"xp": 800  
}  
}
```

진척 인정:

- 로그인 사용자
- Claude 호출 성공
- 비스트리밍 피드백 성공
- 스트리밍 피드백에서 실제 텍스트 생성 성공

진척 미인정:

- AI 호출 실패
- fallback 빈 응답
- 캐시된 기존 피드백 재조회
- 비로그인 사용자

---

## 5. 미션 정의 스키마

```json
{  
  "daily": [],  
  "weekly": []  
}
```

미션 객체:


| 필드          | 타입  | 필수    | 설명                                                          |
|-----------------|---------|----------:|-----------------------------------------------------------------|
| `mission_id`    | string  | O         | 전체 미션에서 고유한 ID                                |
| `title`         | string  | O         | 홈 표시명                                                   |
| `event`         | string  | O         | 진척 이벤트                                                |
| `goal`          | integer | O         | 완료 목표                                                   |
| `reward`        | object  | O         | 보상 정의                                                   |
| `reward.xp`     | integer | 선택    | 레거시 키, 코인·랭킹점수로 변환                   |
| `reward.coin`   | integer | 선택    | 프론트가 표시 지원하지만 현재 정의에는 없음  |
| `reward.crowns` | integer | 선택    | 왕관 보상                                                   |
| `auto_claim`    | boolean | 레거시 | 응답에는 전달 가능하나 현재 자동 수령 미지원 |


### 5-1. ID 규칙

```text
d_... → 데일리  
w_... → 위클리
```

`POST /missions/claim`은 ID가 `w_`로 시작하면 위클리, 아니면 데일리로 판단합니다.

따라서:

- 데일리 ID는 `d_` prefix를 사용합니다.
- 위클리 ID는 반드시 `w_` prefix를 사용합니다.
- 데일리와 위클리 전체에서 ID가 중복되면 안 됩니다.

### 5-2. 정의 로드 시점

`missions.json`은 백엔드 프로세스가 `missions_core` 모듈을 import할 때 읽습니다.

```text
프로세스 시작  
  ↓  
_load_defs()  
  ↓  
DAILY_DEFS / WEEKLY_DEFS 메모리 적재
```

운영 중 JSON만 수정해도 자동 hot reload되지 않을 수 있습니다. 배포 또는 서버 재시작이 필요합니다.

### 5-3. 파일 오류 정책

파일 누락 또는 JSON 파싱 오류가 발생하면 `_load_defs()`가 예외를 삼키고 빈 정의를 유지합니다.

결과:

```text
미션 API 서버 자체는 기동  
↓  
미션 목록이 비거나 진척이 no-op
```

운영에서는 미션 정의 수를 기동 로그 또는 헬스 체크로 검증하는 보완이 필요합니다.

---

## 6. 사용자 저장 구조

Supabase:

```text
users.missions jsonb
```

예시:

```json
{  
"daily": {  
"date": "2026-07-11",  
"progress": {  
"d_quiz3": 2,  
"d_review": 1,  
"d_login": 1  
},  
"claimed": [  
"d_review"  
],  
"login_days": [  
"2026-07-11"  
]  
},  
"weekly": {  
"week": "2026-W28",  
"progress": {  
"w_boss2": 1,  
"w_streak5": 3,  
"w_ai5": 4  
},  
"claimed": [],  
"login_days": [  
"2026-07-09",  
"2026-07-10",  
"2026-07-11"  
]  
}  
}
```

### 6-1. 데일리


| 필드       | 타입   | 설명                         |
|--------------|----------|--------------------------------|
| `date`       | string   | KST `YYYY-MM-DD`               |
| `progress`   | object   | `{mission_id: 현재값}`      |
| `claimed`    | string[] | 수령한 미션 ID            |
| `login_days` | string[] | 출석 중복 방지용 날짜 |


### 6-2. 위클리


| 필드       | 타입   | 설명                      |
|--------------|----------|-----------------------------|
| `week`       | string   | ISO 주차, 예: `2026-W28` |
| `progress`   | object   | `{mission_id: 현재값}`   |
| `claimed`    | string[] | 수령한 미션 ID         |
| `login_days` | string[] | 서로 다른 출석일     |


### 6-3. 진척 상한

```python
progress[mission_id] = min(current + amount, goal)
```

진척은 목표치를 초과하지 않습니다.

---

## 7. 기간 초기화

### 7-1. 데일리

```text
오늘 KST 날짜  
↓  
missions.daily.date와 비교  
├─ 같음 → 기존 진척 사용  
└─ 다름  
↓  
daily 객체 초기화  
↓  
date = 오늘  
progress = {}  
claimed = []
```

### 7-2. 위클리

```text
현재 KST ISO 주차  
  ↓  
missions.weekly.week와 비교  
  ├─ 같음 → 기존 진척 사용  
  └─ 다름  
       ↓  
    weekly 객체 초기화  
       ↓  
    week = 현재 주  
    progress = {}  
    claimed = []  
    login_days = []
```

### 7-3. Lazy reset

기간 변경은 스케줄러가 자정에 모든 사용자를 일괄 수정하는 방식이 아닙니다.

다음 시점에 `_ensure_period()`가 호출되면 현재 기간으로 초기화합니다.

- 미션 조회
- 미션 진척 이벤트
- 미션 보상 수령

### 7-4. 조회 시 저장

`GET /missions/`의 기간 보정은 메모리 객체에서만 수행하며 즉시 저장하지 않습니다.

```text
GET /missions/  
↓  
현재 기간으로 보정  
↓  
응답은 정상  
↓  
다음 이벤트 또는 claim 때 영속 저장
```

이 방식은 조회만으로 DB write를 만들지 않는 장점이 있습니다.

---

## 8. 이벤트 엔진

핵심 함수:

```python
bump_mission(user, event, amount=1, day_key=None)
```

### 8-1. 처리 순서

```text
DAILY_DEFS / WEEKLY_DEFS 존재 확인  
↓  
오늘 날짜·현재 주차 계산  
↓  
_ensure_period  
↓  
데일리 정의 순회  
↓  
event가 같은 미션 progress 증가  
↓  
위클리 정의 순회  
↓  
event가 같은 미션 progress 증가
```

### 8-2. 데일리·위클리 포함관계

하나의 이벤트가 데일리와 위클리 정의를 모두 순회합니다.

예:

```text
login 이벤트  
  ├─ d_login 진척  
  └─ w_streak5 진척
```

하지만 동일 이벤트를 쓰지 않는 미션까지 자동으로 증가하는 것은 아닙니다.

예:

```text
stage_clear  
├─ d_quiz3 증가  
└─ 위클리에는 stage_clear 정의가 없으므로 변화 없음
```

### 8-3. 로그인 날짜 중복 방지

데일리와 위클리는 각각 독립된 `login_days`를 사용합니다.

```text
login(day_key=2026-07-11)  
  ↓  
daily.login_days에 날짜 존재?  
  ├─ 예 → d_login 증가 안 함  
  └─ 아니오 → 날짜 추가 + d_login 증가  
  ↓  
weekly.login_days에 날짜 존재?  
  ├─ 예 → w_streak5 증가 안 함  
  └─ 아니오 → 날짜 추가 + w_streak5 증가
```

---

## 9. 실제 이벤트 연결


| 이벤트                                        | 발생 위치                       | 현재 미션          |
|--------------------------------------------------|-------------------------------------|------------------------|
| `stage_clear`                                    | `progress.py`                       | `d_quiz3`              |
| `review_done`                                    | `train.py /reviewed`                | `d_review`             |
| `login`                                          | `auth/_core.py update_login_streak` | `d_login`, `w_streak5` |
| `boss_clear`                                     | `boss.py`, `endboss.py`             | `w_boss2`              |
| `ai_feedback`                                    | `quiz.py`                           | `w_ai5`                |
| `miniboss_clear`                                 | `miniboss.py`                       | 정의 없음          |
| `game_clear`                                     | `game.py`, `game_aicross.py`        | 정의 없음          |
| `daily_attendance`                               | 로그인 출석 코인             | 정의 없음          |
| `streak_3`, `streak_7`, `streak_14`, `streak_30` | 스트릭 보상                    | 정의 없음          |


정의가 없는 이벤트를 `bump_mission`에 전달해도 아무 미션도 증가하지 않습니다.

---

## 10. `d_quiz3` 진척 흐름

의도된 흐름:

```text
스테이지 최초 통과  
↓  
서버 완료 조건 검증  
↓  
최초 완료 보상 판정  
↓  
stage_clear 이벤트  
↓  
d_quiz3 +1
```

현재 구현:

```text
POST /progress/  
  ↓  
award_xp 계산  
  ↓  
amount = 최초 완료면 2000, 아니면 0  
  ↓  
grant_reward(... event_type="stage_clear")  
  ↓  
amount가 0이어도 bump_mission 실행  
  ↓  
d_quiz3 +1
```

### 현재 정합성 문제 MISSION-1

`stage_clear` 훅이 `award_xp=True` 조건 안에 있지 않습니다.

따라서 다음 요청도 진척을 올릴 가능성이 있습니다.

- 이미 완료한 스테이지 재저장
- 완료되지 않은 checkpoint 저장
- 같은 스테이지 중복 완료 요청
- 보상이 0인 진행도 업데이트

#### 권장 수정

```python
event_type = "stage_clear" if award_xp else None
```

또는:

```python
if award_xp:  
    bump_mission(user, "stage_clear")
```

통과 조건과 최초 완료 여부를 서버가 확인한 뒤 정확히 한 번만 증가시켜야 합니다.

---

## 11. `d_review` 진척 흐름

의도된 흐름:

```text
실제 오답 문제 재풀이  
↓  
정답 또는 복습 완료  
↓  
POST /train/reviewed  
↓  
해당 wrong_answer reviewed=true  
↓  
review_done 이벤트  
↓  
d_review +1
```

현재 구현:

```text
POST /train/reviewed  
  body: question_id  
  ↓  
사용자의 wrong_answers에서 ID 검색  
  ↓  
일치하면 reviewed=true 저장  
  ↓  
일치 여부와 무관하게 review_done 이벤트  
  ↓  
d_review +1
```

### 현재 정합성 문제 MISSION-2

존재하지 않는 `question_id` 또는 이미 reviewed된 ID를 보내도 미션 진척이 발생합니다.

현재 목표가 1이라 반복 증가의 경제적 영향은 제한적이지만, 미션 완료 자체는 위조할 수 있습니다.

#### 권장 수정

다음 조건을 모두 만족할 때만 진척을 증가시킵니다.

- 사용자에게 해당 오답 기록이 존재
- `reviewed`가 기존에 false
- 서버가 복습 완료 조건을 확인
- 상태가 false → true로 실제 전환

권장 응답:

```json
{  
"success": true,  
"newly_reviewed": true,  
"mission_progressed": true  
}
```

---

## 12. 출석 미션 흐름

```text
일반 또는 소셜 로그인  
  ↓  
update_login_streak(user)  
  ↓  
오늘 첫 로그인 여부 확인  
  ↓  
별도 일일 출석 코인 지급  
  ↓  
스트릭 계산·마일스톤 지급  
  ↓  
bump_mission(user, "login", day_key=today)  
  ↓  
d_login / w_streak5 날짜 중복 확인  
  ↓  
진척 저장
```

### 12-1. 출석 코인과 미션 보상은 별도

오늘 첫 로그인 시 별도 출석 시스템이 코인 1,000을 자동 지급합니다.

출석 미션은:

- `d_login`: 왕관 1개
- `w_streak5`: 코인 2,000 + 랭킹점수 2,000 + 왕관 3개

를 수동으로 수령합니다.

즉, 동일 로그인 행동에서:

```text
자동 출석 보상  
+  
미션 진척 완료
```

가 동시에 발생하지만 서로 다른 보상 시스템입니다.

### 12-2. 같은 날 재로그인

`update_login_streak()`는 같은 날에도 `bump_mission()`을 호출하지만 `login_days` 중복 확인으로 진척은 한 번만 인정됩니다.

---

## 13. 보스 미션 흐름

### 13-1. 유닛보스

```text
서버 세션 status = won  
  ↓  
unitboss_cleared_units에 없는 최초 클리어  
  ↓  
유닛보스 보상 지급  
  ↓  
event_type="boss_clear"  
  ↓  
w_boss2 +1
```

재클리어 또는 레거시 완료 백필:

- 보상 미지급
- `boss_clear` 미발생
- `w_boss2` 증가 없음

### 13-2. 엔드보스

```text
코스별 최초 클리어  
↓  
endboss_cleared_levels에 없는 레벨  
↓  
엔드보스 보상·진화  
↓  
event_type="boss_clear"  
↓  
w_boss2 +1
```

같은 코스 재클리어:

- `already_cleared=true`
- 보상 미지급
- 미션 진척 없음

### 13-3. 스테이지 미니보스

스테이지 미니보스는:

```text
event_type="miniboss_clear"
```

를 발생시키지만 현재 `missions.json`에는 해당 이벤트의 미션이 없습니다.

따라서 `w_boss2`에는 포함되지 않습니다.

---

## 14. AI 피드백 미션 흐름

### 14-1. 비스트리밍

```text
POST /quiz/ai-feedback  
↓  
동일 question_id + user_answer 캐시 존재?  
├─ 예 → 캐시 반환, 진척 없음  
└─ 아니오  
↓  
Claude 호출  
↓  
성공?  
├─ 아니오 → fallback, 진척 없음  
└─ 예  
↓  
ai_feedback_count +1  
↓  
ai_feedback 이벤트  
↓  
w_ai5 +1  
↓  
wrong_answers 저장
```

### 14-2. 스트리밍

```text
POST /quiz/ai-feedback/stream  
  ↓  
텍스트 청크 수신  
  ↓  
full_text 존재  
  ↓  
wrong_answers 저장  
  ↓  
ai_feedback_count +1  
  ↓  
w_ai5 +1
```

### 14-3. 진척 의미

`w_ai5`의 “AI 피드백 활용”은 단순 버튼 클릭 횟수가 아닙니다.

현재 기준:

```text
새 AI 피드백 생성 성공 횟수
```

캐시 재열람을 활용으로 포함하려면 별도 이벤트 정책 변경이 필요합니다.

---

## 15. 미션 API

FastAPI prefix:

```text
/missions
```

모든 미션 API는 로그인이 필요합니다.

### 15-1. 목록 조회

```http
GET /missions/
```

응답:

```json
{  
  "daily": [  
    {  
      "mission_id": "d_quiz3",  
      "title": "스테이지 퀴즈 3회 클리어",  
      "goal": 3,  
      "progress": 2,  
      "claimed": false,  
      "reward": {  
        "xp": 300  
      },  
      "auto_claim": false  
    }  
  ],  
  "weekly": []  
}
```

응답 필드:


| 필드       | 설명                   |
|--------------|--------------------------|
| `mission_id` | 미션 ID                |
| `title`      | 표시명                |
| `goal`       | 목표                   |
| `progress`   | 현재 진척            |
| `claimed`    | 수령 여부            |
| `reward`     | 정적 보상 정의     |
| `auto_claim` | 레거시·예약 필드 |


### 15-2. 수령

```http
POST /missions/claim
```

요청:

```json
{  
  "mission_id": "d_quiz3"  
}
```

성공 응답:

```json
{  
"mission_id": "d_quiz3",  
"already_claimed": false,  
"xp_awarded": 300,  
"crowns_awarded": 0,  
"total_xp": 0,  
"total_crowns": 5,  
"reward": {  
"coin_delta": 300,  
"gp_delta": 0,  
"ranking_score_delta": 300  
},  
"user_state": {  
"coin_balance": 300,  
"gp": 0,  
"lv": 1,  
"evolution_stage": 0,  
"ranking_score": 300,  
"weekly_ranking_score": 0,  
"crowns": 5  
}  
}
```

### 15-3. 오류


| 조건                 | 상태 | 응답                      |
|------------------------|-------:|-----------------------------|
| 존재하지 않는 ID | 404    | `Mission not found`         |
| 진척 미달          | 400    | `Mission not completed yet` |
| 사용자 없음       | 404    | `User not found`            |


### 15-4. 이미 수령한 미션

이미 수령한 미션은 오류가 아니라 멱등 응답을 반환합니다.

```json
{  
  "mission_id": "d_quiz3",  
  "already_claimed": true,  
  "xp_awarded": 0,  
  "crowns_awarded": 0  
}
```

---

## 16. 보상 지급

### 16-1. 레거시 정의

정적 JSON:

```json
{  
"reward": {  
"xp": 300  
}  
}
```

### 16-2. 실제 지급

```text
reward.xp  
  ↓  
coin_delta  
  ↓  
ranking_score_delta
```

미션 보상은 GP를 지급하지 않습니다.

```python
grant_reward(  
user,  
coin_delta=xp,  
ranking_score_delta=xp,  
gp_delta=0  
)
```

### 16-3. 실제 보상표


| 미션      | 코인 | 누적 랭킹 | GP | 왕관 |
|-------------|-------:|--------------:|---:|-------:|
| `d_quiz3`   | 300    | 300           | 0  | 0      |
| `d_review`  | 150    | 150           | 0  | 0      |
| `d_login`   | 0      | 0             | 0  | 1      |
| `w_boss2`   | 1,500  | 1,500         | 0  | 2      |
| `w_streak5` | 2,000  | 2,000         | 0  | 3      |
| `w_ai5`     | 800    | 800           | 0  | 0      |


### 16-4. 최대 기간 보상

데일리 3종 전부 수령:


| 재화              | 합계 |
|---------------------|-------:|
| 코인              | 450    |
| 누적 랭킹점수 | 450    |
| 왕관              | 1      |


위클리 3종 전부 수령:


| 재화              | 합계 |
|---------------------|-------:|
| 코인              | 4,300  |
| 누적 랭킹점수 | 4,300  |
| 왕관              | 5      |


### 16-5. 재귀 방지

미션 claim에서 보상을 지급할 때 `event_type`을 전달하지 않습니다.

따라서:

```text
미션 보상 수령  
  ↓  
grant_reward  
  ↓  
새 미션 진척을 다시 발생시키지 않음
```

---

## 17. 수동 수령 정책

현재는 모든 미션이 수동 수령입니다.


| 미션      | 수령 방식 |
|-------------|---------------|
| `d_quiz3`   | 수동        |
| `d_review`  | 수동        |
| `d_login`   | 수동        |
| `w_boss2`   | 수동        |
| `w_streak5` | 수동        |
| `w_ai5`     | 수동        |


과거 설계의:

```text
d_login auto_claim=true
```

정책은 폐기됐습니다.

현재 코드:

- `missions.json`에 `auto_claim` 없음
- `bump_mission()`은 자동 보상하지 않음
- `POST /missions/claim`은 모든 미션 허용
- 홈 UI에 출석 미션도 `수령하기` 버튼 표시

### 17-1. 남아 있는 오래된 주석

`missions_core.py` 함수 설명 일부에는 출석 자동 지급을 설명하는 과거 문구가 남아 있습니다.

실제 실행 코드는:

```python
# auto_claim 은 지원되지 않음  
pass
```

입니다.

문서 또는 코드 주석 정리 시 이 오래된 설명을 제거해야 합니다.

---

## 18. 원자성·중복 방지

### 18-1. claim 임계구역

```text
mutate_user_atomic  
↓  
최신 사용자 상태 조회  
↓  
현재 기간 보정  
↓  
claimed 확인  
↓  
progress 확인  
↓  
claimed append  
↓  
코인·랭킹·왕관 지급  
↓  
한 번에 저장
```

다음 작업이 같은 임계구역에 있습니다.

- 완료 조건 확인
- 이미 수령했는지 확인
- `claimed` 기록
- 보상 지급

### 18-2. 동시 수령

동일 미션을 동시에 두 번 요청하면:

```text
요청 A → 보상 지급 + claimed 기록  
요청 B → fresh 상태에서 claimed 발견  
          → already_claimed=true
```

정확히 한 번만 보상이 지급됩니다.

### 18-3. 이벤트와 claim 동시 실행

이벤트 진척 업데이트와 claim이 동시에 발생해도 `mutate_user_atomic` 경로를 사용하므로:

- `claimed` 유실 방지
- progress 유실 방지
- 재수령 방지

를 목표로 합니다.

### 18-4. 직접 JSONB 덮어쓰기 금지

다음 형태는 사용하면 안 됩니다.

```text
load user  
→ user.missions 수정  
→ save_user delta merge
```

동시 요청에서 마지막 저장이 앞선 `claimed` 또는 `progress`를 덮을 수 있습니다.

---

## 19. 홈 UI

컴포넌트:

```text
frontend/src/components/MissionWidget/MissionWidget.jsx
```

홈 연결:

```text
frontend/src/pages/Home/HomeDashboard.jsx
```

### 19-1. 표시 구조

```text
📅 데일리 미션  
  ├─ 제목  
  ├─ 현재값 / 목표값  
  ├─ 진행률 바  
  ├─ 보상  
  └─ 수령 버튼 또는 수령완료  
  
🏆 위클리 미션  
  └─ 동일 구조
```

### 19-2. 진행률

```javascript
Math.min(100, Math.round((progress / goal) * 100))
```

### 19-3. 수령 가능 조건

```javascript
progress >= goal && !claimed
```

### 19-4. 보상 표시

프론트는 다음 우선순위로 코인을 표시합니다.

```text
reward.coin  
→ reward.xp  
→ 0
```

따라서 백엔드 정의가 아직 `xp` 키여도 UI에는 `코인`으로 표시됩니다.

### 19-5. 수령 중 중복 클릭

컴포넌트의 `claiming[missionId]` 상태로 동일 미션 버튼 연타를 막습니다.

서버도 원자적 멱등 검사를 수행하므로 프론트 잠금은 UX 보조이며 최종 방어는 서버입니다.

### 19-6. 수령 후 상태 반영

```text
claim 성공  
  ↓  
user_state에서  
coin_balance  
gp  
evolution_stage  
ranking_score  
crowns 갱신  
  ↓  
aimon:reward-status-changed 이벤트  
  ↓  
미션 다시 조회  
  ↓  
버튼 → 수령완료
```

### 19-7. 오류 표시

claim 실패 시 API `detail`을 `InfoModal`로 표시합니다.

---

## 20. 홈 탭 알림 점

하단 NavBar는 로그인 사용자에게 다음 API를 함께 호출합니다.

```text
GET /missions/  
GET /game/challenge/status
```

미션 알림 조건:

```javascript
daily와 weekly 중  
progress >= goal  
&& claimed == false
```

조건을 만족하는 미션이 하나라도 있으면 홈 탭 아이콘에 알림 점을 표시합니다.

### 갱신 시점

- 경로 변경
- NavBar 마운트
- `aimon:reward-status-changed` 이벤트

---

## 21. 미션과 다른 보상 시스템

미션은 다음 시스템과 구분해야 합니다.

### 21-1. 일일 출석 보상


| 구분 | 자동 출석        | `d_login`        |
|--------|----------------------|------------------|
| 조건 | 오늘 첫 로그인 | 오늘 로그인 |
| 지급 | 코인 1,000         | 왕관 1         |
| 방식 | 자동               | 수동           |
| 저장 | 사용자 보상     | missions.claimed |


### 21-2. 스트릭 마일스톤


| 일수 | 코인 | 왕관 |
|-------:|-------:|-------:|
| 3      | 500    | 0      |
| 7      | 2,000  | 1      |
| 14     | 5,000  | 2      |
| 30     | 10,000 | 5      |


스트릭 보상 이벤트 이름은 `streak_3` 등이며 현재 미션 정의와 연결되지 않습니다.

### 21-3. 일일 게임 챌린지

게임 챌린지는 `users.game_rewards`에 저장되는 별도 시스템입니다.

- API: `/game/challenge/status`, `/game/challenge/claim`
- 보상: 왕관 5개
- 미니게임 탭 알림 점
- 미션과 별도 claimed 상태

### 21-4. 일반 게임 플레이

게임은 `game_clear` 이벤트를 보상 헬퍼에 전달하지만 현재 `missions.json`에 게임 미션이 없습니다.

---

## 22. 현재 구현 문제와 우선순위

### P0 — MISSION-1: 스테이지 진척 최초 완료 검증

**원인**

`progress.py`가 `award_xp`와 무관하게 `event_type="stage_clear"`를 전달합니다.

**영향**

- 이미 완료한 스테이지 재저장으로 진척 가능
- checkpoint 저장으로 진척 가능
- 실제 “3회 클리어”와 미션 수치 불일치
- API 반복 호출로 완료 위조 가능

**수정 위치**

```text
backend/routers/progress.py  
update_progress()  
grant_reward(... event_type="stage_clear")
```

**수정안**

```python
event_type="stage_clear" if award_xp else None
```

### P0 — MISSION-2: 복습 진척 대상 검증

**원인**

`train.py /reviewed`가 일치하는 오답이 없어도 `review_done`을 호출합니다.

**영향**

- 임의 question_id로 `d_review` 완료 가능
- 이미 복습한 문제 재호출도 진척 이벤트 발생
- 오답 복습 UI와 서버 진척 불일치

**수정 위치**

```text
backend/routers/train.py  
mark_question_reviewed()
```

**수정안**

```text
실제 false → true 전환된 오답이 있을 때만 bump_mission
```

### P1 — MISSION-3: 정의 로딩 실패 가시성

**원인**

`missions.json` 오류를 조용히 무시합니다.

**영향**

- 배포 후 미션 전체가 사라져도 원인 파악 지연
- API는 500 대신 빈 목록을 반환할 수 있음

**수정안**

- 기동 시 error 로그
- 정의 0개면 health warning
- CI에서 JSON schema 검증

### P1 — MISSION-4: 오래된 auto-claim 설명

**원인**

과거 자동 출석 설계 주석이 코드와 테스트 헤더 일부에 남아 있습니다.

**영향**

- 후속 개발자가 출석 보상을 자동·수동으로 중복 구현할 위험
- 문서와 코드 리뷰 혼선

**수정안**

- `missions_core.py` docstring 정리
- `test_missions.py` 상단 설명 정리
- `auto_claim` 응답 필드 유지 여부 결정

### P1 — MISSION-5: 레거시 reward 키

**원인**

정의는 `reward.xp`, 실제 지급은 코인·랭킹입니다.

**영향**

- 콘텐츠 작업자가 XP 지급으로 오해
- API와 UI에서 변환 로직 필요
- 발표 자료 표현 혼선

**수정안**

1. `missions.json`을 `reward.coin`으로 마이그레이션
2. 백엔드는 일정 기간 `coin ?? xp` 호환
3. 프론트도 동일 fallback
4. 테스트 전환 후 `xp` 제거


### P2 — MISSION-6: prefix 기반 기간 선택

**원인**

claim API가 `mission_id.startswith("w_")`로 기간을 결정합니다.

**영향**

- 잘못된 ID prefix가 다른 기간을 조회
- 정의와 claim 대상이 어긋남

**수정안**

`find_def()`가 정의와 함께 `period`를 반환하거나 정적 정의에 `period`를 명시합니다.

---

## 23. 권장 수정 순서

```text
1. MISSION-1 스테이지 최초 완료 게이트  
2. MISSION-2 실제 오답 복습 검증  
3. 관련 회귀 테스트 추가  
4. auto_claim 주석·테스트 설명 정리  
5. reward.xp → reward.coin 전환 계획  
6. 정의 JSON 검증기 추가  
7. prefix 기반 기간 판정 제거
```

보상 밸런스나 새 미션 추가보다 먼저 P0 진척 검증을 수정해야 합니다.

---

## 24. 회귀 테스트

### 24-1. 진척 코어

- `stage_clear` 3회 → `d_quiz3=3`
- 4회 이상 → 3에서 상한
- `review_done` → `d_review=1`
- 로그인 1회 → `d_login=1`, `w_streak5=1`
- 같은 날짜 로그인 반복 → 변화 없음
- 다른 날짜 5일 → `w_streak5=5`
- `boss_clear` 2회 → `w_boss2=2`
- `ai_feedback` 5회 → `w_ai5=5`
- 정의 없는 이벤트 → 변화 없음

### 24-2. 기간

- 데일리 날짜 변경 → progress·claimed 초기화
- 위클리 ISO 주 변경 → progress·claimed·login_days 초기화
- 월요일 KST 경계
- 일요일 23:59 → 월요일 00:00
- UTC 날짜와 KST 날짜가 다른 구간

### 24-3. 수령

- 진척 미달 → 400
- 완료 미션 → 정확한 보상
- 두 번째 수령 → `already_claimed`
- 동시 2회 수령 → 한 번만 지급
- claim과 다른 이벤트 동시 실행 → 상태 유실 없음
- 왕관 전용 미션
- 코인+왕관 혼합 미션
- GP는 항상 0
- 미션 수령이 다른 미션 진척을 만들지 않음

### 24-4. P0 보완 테스트

- checkpoint 저장은 `d_quiz3` 증가 없음
- 이미 완료한 스테이지 재저장 증가 없음
- 최초 완료만 `d_quiz3` +1
- 존재하지 않는 question_id `/train/reviewed` 증가 없음
- 이미 reviewed된 문제 재요청 증가 없음
- 실제 false → true 복습만 `d_review` +1

### 24-5. AI 피드백

- 신규 AI 성공 → `w_ai5` +1
- Claude 실패 → 증가 없음
- 캐시 반환 → 증가 없음
- 스트리밍 성공 → +1
- 스트리밍 오류 → 증가 없음
- 비로그인 → 사용자 미션 없음

### 24-6. 프론트

- 진척률 표시
- 완료 전 버튼 없음
- 완료 후 수령 버튼
- 수령 중 버튼 비활성
- 성공 후 사용자 코인·왕관 갱신
- 성공 후 `수령완료`
- API 오류 모달
- 수령 가능 시 홈 알림 점
- 모든 수령 완료 후 알림 점 제거

---

## 25. 기존 테스트 현황

현재 저장소에는 다음 검증이 존재합니다.

### `backend/tests/test_missions.py`

- 진척 누적
- goal 상한
- 출석 수동 수령 상태
- 로그인 날짜 중복 방지
- 데일리 lazy reset
- 위클리 lazy reset
- 데일리·위클리 이벤트 분리
- claim 멱등성
- 진척 미달 claim 거부

### `backend/tests/test_concurrency.py`

- 동시 이중 claim 한 번만 지급
- claim과 이벤트 동시 실행 시 `claimed` 유지
- 코인 이중 지급 방지

주의:

- 테스트 파일 상단 일부 과거 설명은 `d_login auto_claim`이라고 적혀 있지만 실제 테스트 본문은 수동 수령을 검증합니다.
- P0의 실제 라우터 단위 진척 검증 테스트는 별도 추가가 필요합니다.

---

## 26. 새 미션 추가 절차

### 26-1. 정의

`backend/data/missions.json`에 추가합니다.

```json
{  
  "mission_id": "d_example",  
  "title": "예시 행동 2회",  
  "event": "example_event",  
  "goal": 2,  
  "reward": {  
    "coin": 100  
  }  
}
```

### 26-2. 이벤트

실제 행동이 서버에서 확정되는 위치에 연결합니다.

```python
bump_mission(user, "example_event")
```

권장:

- 클라이언트 요청 자체가 아니라 서버 검증 성공 후 호출
- 최초 완료 여부 확인
- `mutate_user_atomic` 내부 호출
- 중복 이벤트 키 사용
- 실패한 작업은 진척시키지 않음

### 26-3. 테스트

- 정상 진척
- 중복 요청
- 실패 요청
- 기간 reset
- claim
- 동시성
- 프론트 표시

### 26-4. 배포

- JSON 유효성 검사
- 서버 재시작
- `GET /missions/` 확인
- 실제 이벤트 확인
- 보상 수령 확인
- 홈 알림 점 확인

---

## 27. 새 미션 설계 기준

### 적합한 행동

- 서버가 성공 여부를 확정할 수 있음
- 반복 호출 중복을 구분할 수 있음
- 기간 내 목표가 현실적임
- 기존 보상과 중복 과지급이 없음
- 사용자가 UI에서 이해할 수 있음

### 부적합한 행동

- 화면 진입만으로 완료
- 클라이언트가 보낸 성공값을 그대로 신뢰
- 반복 API 호출로 무한 증가
- 서버가 실제 수행 여부를 알 수 없음
- 실패·캐시·재시도를 모두 새 행동으로 계산

---

## 28. 향후 후보

현재 구현이 아닌 확장 후보입니다.


| 후보                  | 이벤트           | 검토사항                                       |
|-------------------------|---------------------|----------------------------------------------------|
| 미니보스 3회       | `miniboss_clear`    | 최초 클리어만 셀지 재클리어도 셀지  |
| 미니게임 3판       | `game_clear`        | 보상 인정 플레이만 셀지 전체 플레이 |
| 코드 문제 정답    | `code_clear`        | 정규 스테이지와 이중 카운트            |
| 완벽한 스테이지  | `stage_perfect`     | 첫 시도 기준                                  |
| 에이칸 세트 완료 | `aicross_set_clear` | 통합·전용 API 중복                          |
| 연속 학습           | `streak_milestone`  | 기존 스트릭 보상과 중복                  |
| 시즌 미션           | 별도 기간       | 시즌 ID와 종료 처리                         |


새 미션을 추가하기 전 현재 P0 진척 검증을 먼저 수정합니다.

---

## 29. 구현 파일

### 백엔드

- `backend/data/missions.json`
- `backend/routers/missions_core.py`
- `backend/routers/mission.py`
- `backend/routers/user_state.py`
- `backend/routers/progress.py`
- `backend/routers/train.py`
- `backend/routers/auth/_core.py`
- `backend/routers/quiz.py`
- `backend/routers/boss.py`
- `backend/routers/endboss.py`
- `backend/routers/miniboss.py`
- `backend/routers/game.py`
- `backend/routers/game_aicross.py`
- `backend/tests/test_missions.py`
- `backend/tests/test_concurrency.py`

### 프론트엔드

- `frontend/src/api/index.js`
- `frontend/src/components/MissionWidget/MissionWidget.jsx`
- `frontend/src/components/MissionWidget/MissionWidget.css`
- `frontend/src/components/NavBar/NavBar.jsx`
- `frontend/src/pages/Home/HomeDashboard.jsx`
- `frontend/src/hooks/useAuthStore.js`

---

## 30. 최종 규칙

1. 미션 진척은 서버에서 검증된 성공 행동만 계산합니다.
2. 같은 행동의 재요청은 중복 진척이 없어야 합니다.
3. 진척과 claim은 원자적 사용자 변경 경로를 사용합니다.
4. 모든 미션 보상은 수동으로 수령합니다.
5. 미션 `reward.xp`는 현재 코인과 누적 랭킹점수로 지급됩니다.
6. 미션은 GP를 지급하지 않습니다.
7. 데일리는 KST 날짜, 위클리는 KST 기준 ISO 주차를 사용합니다.
8. 로그인 일수는 날짜 집합으로 중복 제거합니다.
9. 정의 없는 이벤트는 미션을 증가시키지 않습니다.
10. 새 미션 추가 전 어뷰징·중복·동시성 회귀 테스트를 추가합니다.


 
