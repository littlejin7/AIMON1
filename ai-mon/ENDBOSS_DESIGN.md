---
title: AI MON — 엔드보스 기획서
updated: 2026-06-11
---

# 엔드보스 (Endboss) 기획서

## 1. 개요

| 항목 | 내용 |
|---|---|
| 명칭 | 엔드보스 (endboss) |
| 빌런 캐릭터 | endboss — 유닛 보스의 왕관 착용 최종형 |
| 해금 조건 | 해당 레벨(beginner / intermediate / advanced) Unit 8 보스 클리어 후 |
| 컨셉 | **종합 시험 × 3페이즈 배틀** — 전 범위 출제, 페이즈마다 문제 유형 에스컬레이션 |
| 힌트 | 없음 (UI 힌트코인 사용 불가) |

---

## 2. 페이즈 구조

페이즈 문제 수는 레벨 공통. 난이도는 **문제 유형**으로 차별화.

| 페이즈 | 문제 수 | 트리거 | 전투 설명 |
|---|---|---|---|
| Phase 1 — 분석전 | 5문제 | 배틀 시작 | 전 유닛 랜덤, 코드 읽기 위주. 내 HP 관리 구간. |
| Phase 2 — 역전 | 4문제 | Phase 1 종료 | 디버깅 / 코드 완성. 내 HP 관리 구간. |
| Phase 3 — 결정타 | 1문제 × 최대 3회 | Phase 2 종료 | HP 개념 없음. 정답 = 즉시 클리어, 오답 = 새 문제 재시도. |

### 레벨별 문제 유형

| 페이즈 | beginner | intermediate | advanced |
|---|---|---|---|
| Phase 1 | output_select / multiple_choice | output_select / fill_in_blank | fill_in_blank / error_find |
| Phase 2 | error_find | error_find | code_input |
| Phase 3 | fill_in_blank | code_input (함수 구현) | code_input (설계 수준) |

> beginner Phase 3는 `fill_in_blank`이므로 Claude API 채점 불필요. intermediate / advanced Phase 3는 `code_input` → Claude API 채점.

---

## 3. HP & 전투 공식

Phase 1~2 전용. Phase 3는 HP 시스템에서 완전 독립.

| | 유닛 보스 | 엔드보스 (Phase 1~2) |
|---|---|---|
| 보스 HP | 1,000 | **1,800** |
| 내 HP | 1,000 | **1,200** |
| 정답 시 | 보스 HP -150 | **보스 HP -200** |
| 오답 시 | 내 HP -350 | **내 HP -400** |
| Phase 1~2 실패 조건 | 내 HP ≤ 0 또는 오답 3회 | **내 HP ≤ 0** |

Phase 1(5문제) + Phase 2(4문제) = 9문제 × 200 = 보스 HP 1,800 전소. 내 HP가 살아있으면 Phase 3 진입.

> Phase 1~2에서 "오답 3회" 즉시 실패 조건은 **제거**. 내 HP -400씩 깎이는 것 자체가 충분한 패널티.

---

## 4. Phase 3 결정타 상세 흐름

Phase 3는 HP와 무관한 독립 구간. 시도 횟수 카운터(1/3, 2/3, 3/3)로 긴장감 표시.

```
Phase 3 진입 (내 HP 잔여량 무관)
  ↓
  문제 출제 (1/3)
    ↓ 정답  → 클리어 🎉
    ↓ 오답  → 새 문제 출제 (2/3)
               ↓ 정답  → 클리어 🎉
               ↓ 오답  → 새 문제 출제 (3/3)
                          ↓ 정답  → 클리어 🎉
                          ↓ 오답  → 실패
```

- Phase 3 문제 풀 10문제 이상 확보 → 매 시도마다 새 문제 (중복 없음)
- 3번 모두 오답 시 배틀 전체 실패 → 재도전 시 Phase 1부터 재시작

---

## 5. 데이터 구조

### 파일 경로

```
backend/data/finalboss/
  ├── beginner.json
  ├── intermediate.json
  └── advanced.json
```

### 필드 스키마

```json
{
  "question_id": "finalboss_beg_fib_p3_001",
  "unit": 4,
  "stage": "final",
  "course_level": "beginner",
  "difficulty": "hard",
  "type": "fill_in_blank",
  "quiz_category": "final_boss",
  "is_boss": true,
  "phase": 3,
  "question": "다음 코드의 빈칸을 채우세요.\n\n```python\nfor i in range(5):\n    if i % 2 == 0:\n        ______(i)\n```",
  "choices": [],
  "answer": "print",
  "feedback": {
    "correct": "정답! print()로 짝수 인덱스 값을 출력해요."
  }
}
```

`phase` 필드(1 / 2 / 3)로 페이즈별 풀 필터링.

### 문제 풀 규모 (레벨당)

| 페이즈 | 풀 규모 | 매 배틀 출제 |
|---|---|---|
| Phase 1 | 유닛별 20문제 × 8유닛 = **160문제** (전 유닛 랜덤) | 랜덤 5개 |
| Phase 2 | error_find 전용 **40문제 이상** (전 유닛 범위) | 랜덤 4개 |
| Phase 3 | **10문제 이상** | 랜덤 1개 (재시도 시 교체) |

---

## 6. 보상

| 보상 | 수량 / 내용 |
|---|---|
| XP | **15,000** (유닛 보스 3,000의 5배) |
| 왕관 | **15개** |
| 칭호 | beginner: `rookie_coder` "코드 ROOKIE" / intermediate: `ace_coder` "ACE 코더" / advanced: `ai_master` "AI 마스터" |
| 캐릭터 진화 | 클리어 시 진화 트리거 (beginner → robot / intermediate → speech_bubble / advanced → final_ghost) |
| 중복 방지 | `endboss_cleared_levels` 배열로 레벨별 1회만 지급 |

---

## 7. 재도전 시스템

| 항목 | 내용 |
|---|---|
| 무료 도전 | 없음 |
| 재도전 비용 | **왕관 3개** |
| 왕관 0개 시 | 도전 불가 — "왕관이 부족합니다" 안내 |
| 재시작 지점 | 항상 Phase 1부터 (세션 저장 없음) |

---

## 8. users.json 추가 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `endboss_cleared_levels` | string[] | 클리어한 레벨 목록 — 중복 보상 방지. 예: `["beginner"]` |
| `endboss_seen_questions` | string[] | 출제된 question_id 목록 — seen 문제 제외용. 전부 소진 시 리셋. |

---

## 9. API 엔드포인트 (추가 예정)

```
GET  /boss/endboss/info              엔드보스 정보 조회 (해금 여부, 왕관 수)
POST /boss/endboss/start             배틀 시작 (왕관 차감, Phase 1 문제 반환)
POST /boss/endboss/answer            답안 제출 → HP 계산 / 페이즈 전환 / Phase 3 시도 카운트
POST /boss/endboss/clear             클리어 처리 (XP + 왕관 + 진화 + 칭호, 중복 방지)
```

---

## 10. 미확정 / 추후 논의

- [ ] Phase 전환 시 UI 연출 (보스 변신 애니메이션)
- [ ] Phase 3 시도 카운터 표시 방식 (1/3, 2/3, 3/3)
- [ ] Phase 3 결정타 BGM / 이펙트
- [ ] intermediate / advanced endboss 문제 데이터 제작 시기
- [ ] 명예의전당 연동 (MVP 이후)
