---
title: AI-MON 데일리 / 위클리 미션 시스템 설계
author: 팀장 설계 (지혜원)
date: 2026-06-24
related: BACKEND_REVIEW_AND_MISSIONS.md (백엔드 리뷰), AI_MON_MISSIONS.mermaid (연동 구조도)
---

# AI-MON 데일리 / 위클리 미션 시스템 설계

> 백엔드 리뷰에서 분리한 독립 문서. 리뷰 내용은 `BACKEND_REVIEW_AND_MISSIONS.md` 참고.
> 연동 흐름 다이어그램은 `AI_MON_MISSIONS.mermaid` 참고.

---

## 0. 설계 원칙 3줄 요약

1. **단일 진입점:** 미션 진척은 `apply_xp` 한 곳에 태워서 굴린다. (연동 지점 7개 → 1개)
2. **포함관계:** 위클리는 독립 집계가 아니라 **데일리 이벤트의 상위 집합**. 데일리가 차면 위클리도 같이 찬다.
3. **선행 과제:** 어뷰징·동시성·타임존을 먼저 막고 미션을 얹는다. (미션은 어뷰징 표면을 넓힌다)

---

## 1. 핵심 아이디어 — "이벤트 → 미션 진척" 단방향 흐름

미션을 별도 폴링/집계 배치로 만들지 않는다. **학습 이벤트가 발생하는 지점에서 진척을 +1** 하는 이벤트 훅 방식.
모든 보상 핸들러가 이미 `user` 객체를 들고 있으므로 추가 I/O 없이 연동된다.

```
스테이지 클리어 ─┐
미니보스 클리어 ─┤
보스 클리어    ─┼─▶ apply_xp(user, amount, event_type)
오답 복습      ─┤        │  XP 가산 + 레벨/진화 + 미션 진척을 한 번에 처리
AI 피드백      ─┤        ▼
게임 클리어    ─┘   bump_mission(user, event) → 활성 데일리/위클리 진척 갱신
출석(login)    ─────────▶ (XP 없는 이벤트만 직접 호출)
```

### 1-1. 왜 `apply_xp` 한 곳인가 (기존안과의 차이)

기존 설계는 progress / boss / miniboss / train / quiz / game / auth **7개 핸들러에 각각** `bump_mission`을 한 줄씩 삽입하는 방식이었다.
문제는 이벤트가 늘어날 때마다 또 흩어지고, 누락 시 조용히 미션이 안 차는 버그가 생긴다는 점.

→ 백엔드 리뷰 **E-1**에서 제안한 진화/레벨업 공통 헬퍼 `apply_xp(user, amount, event_type)`에 미션 진척을 **태워 보낸다.**
"XP가 발생하는 지점 = 미션 이벤트가 발생하는 지점"이라 거의 1:1로 겹치기 때문에,
**XP를 주는 곳에서 미션도 자동으로 큰다**는 규칙 하나만 남는다.

| 이벤트 | XP 발생? | 연동 방식 |
|---|---|---|
| 스테이지 클리어 | O | `apply_xp` 내부에서 자동 |
| 미니보스 클리어 | O | `apply_xp` 내부에서 자동 |
| 보스 클리어 | O | `apply_xp` 내부에서 자동 |
| 게임 클리어 | O | `apply_xp` 내부에서 자동 |
| AI 피드백 | O(소량) | `apply_xp` 내부에서 자동 |
| 오답 복습 | △ | `apply_xp` 또는 직접 호출 |
| 출석(login) | X | `bump_mission` 직접 호출 (예외) |

> 결과적으로 연동 지점이 **7곳 산재 → apply_xp 1곳 + 출석 예외 1곳**으로 수렴한다.

---

## 2. 데일리 ↔ 위클리 포함관계 (이 설계의 핵심 '연동')

위클리를 독립 이벤트로 **다시 세지 않는다.** 데일리에서 발생한 이벤트가 위클리 진척까지 같이 굴리게 한다.
데이터 소스를 하나(데일리 이벤트)로 통일 → 드리프트 방지 + 유저 동기부여 강화.

```
[데일리 이벤트 발생]
        │
        ├─▶ 오늘의 데일리 진척 +1   (d_quiz3, d_review, d_login ...)
        │
        └─▶ 같은 이벤트로 위클리 진척 +1
                 ├─ w_boss2   = 주간 boss_clear 누적
                 ├─ w_ai5     = 주간 ai_feedback 누적
                 └─ w_streak5 = d_login "완료된 날" 누적 (하루 1회 집합)
```

- 유저 체감: "오늘 거 하면 주간 게이지도 같이 찬다"가 UI로 보여서 재방문/연속성 동기가 세진다.
- 구현 체감: `bump_mission` 한 번 호출이 데일리·위클리 두 스코프를 동시에 순회하며 갱신한다.

---

## 3. 데이터 모델

### 3-1. 미션 정의 (정적 — `data/missions.json`, 콘텐츠팀 관리)

```json
{
  "daily": [
    {"mission_id":"d_quiz3","title":"스테이지 퀴즈 3회 클리어","event":"stage_clear","goal":3,"reward":{"xp":300}},
    {"mission_id":"d_review","title":"오답 1개 복습","event":"review_done","goal":1,"reward":{"xp":150}},
    {"mission_id":"d_login","title":"오늘도 출석","event":"login","goal":1,"reward":{"crowns":1},"auto_claim":true}
  ],
  "weekly": [
    {"mission_id":"w_boss2","title":"보스 2회 처치","event":"boss_clear","goal":2,"reward":{"xp":1500,"crowns":2}},
    {"mission_id":"w_streak5","title":"주 5일 출석","event":"login","goal":5,"reward":{"xp":2000,"crowns":3}},
    // w_streak5: event="login" (d_login과 동일). bump_mission("login",day_key) 1회로 daily+weekly 동시 갱신.
    // 중복 방지는 weekly.login_days 날짜 집합 (daily.login_days와 독립).
    {"mission_id":"w_ai5","title":"AI 피드백 5회 활용","event":"ai_feedback","goal":5,"reward":{"xp":800}}
  ]
}
```

`event` 타입은 **이미 존재하는 이벤트**에 매핑: `stage_clear`(progress), `boss_clear`(boss/endboss),
`miniboss_clear`, `review_done`(train), `ai_feedback`(quiz), `game_clear`(game), `login`/`login_day`(auth).

### 3-2. 진척 저장 — `user` 객체에 임베드 (JSON·Supabase 둘 다 호환)

별도 테이블 없이 `users.missions`(jsonb) 한 컬럼. 마이그레이션 부담 최소.

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

- `date`/`week`가 현재 KST 날짜/ISO주차와 다르면 **접근 시 자동 리셋(lazy reset)**. 스케줄러 의존 최소화.
- `login_days` 같은 "하루 1회" 카운트는 **날짜 집합**으로 중복 방지 → 위클리 `w_streak5`의 소스가 된다.

---

## 4. 타임존 — 미션 도입 전 반드시 선행 (리뷰 C-5 연계)

미션에서 타임존 혼용은 곧바로 버그로 터진다. 자정 직전 출석이 어느 날짜로 찍히느냐에 따라
streak·주간 일수·데일리 리셋이 전부 어긋난다.

- `now_kst()` 헬퍼 하나로 통일. 저장은 timezone-aware ISO.
- ISO 주차도 KST 기준(`%G-W%V`, 월요일 시작)으로 끊는다.
- `created_at`(UTC)와 streak(KST)가 한 객체에 공존하는 현 구조를 먼저 정리하고 미션을 얹는다.

---

## 5. API 설계 (신규 `routers/mission.py`)

```
GET  /missions         오늘의 데일리 + 이번주 위클리 목록 + 내 진척/수령상태
POST /missions/claim   {mission_id} → 완료 검증 후 보상 지급 (멱등)
```

- 진척 증가는 **별도 API 없이** `apply_xp` 내부 + 출석 핸들러에서 발생.
- 멱등성: `claimed` 배열로 중복 수령 차단, 기간 리셋 시 자동 초기화.

---

## 6. 수령(claim) 정책

| 구분 | 정책 | 이유 |
|---|---|---|
| 일반 미션 (퀴즈/보스/복습/AI/게임) | **수동 claim 버튼** | 수령 버튼이 재방문·재진입 유도 (리텐션) |
| 출석류 (`d_login`) | **자동 지급 (`auto_claim:true`)** | "출석했는데 또 눌러야 해?" 마찰 제거 |

- 진척 자동증가 ≠ 자동지급. 자동지급은 출석류에만 한정.
- 보상 지급은 `apply_xp` / 왕관 공통 헬퍼 재사용(리뷰 E-1) → 중복 로직 제거.

---

## 7. 리셋 전략

- **데일리:** lazy reset (접근 시 KST 날짜 비교). 자정 기준 자동 전환 — 스케줄러 불필요.
- **위클리:** ISO 주차(`%G-W%V`, 월요일 시작) lazy reset.
- (선택) `scheduler.py`에 위클리 리마인더 cron 추가 가능 — 이미 18시 streak 리마인더 패턴 존재.

---

## 8. 어뷰징 방어 — 미션은 B-4 / C-1 이후 (도입 순서)

미션을 얹으면 어뷰징 표면이 넓어진다. 게임 보상 `distance` 무검증(리뷰 **B-4**) 상태에서
"게임 클리어 3회" 데일리를 얹으면, 어뷰징 한 번에 **XP + 미션보상**이 이중으로 빨린다.

도입 순서:
1. **B-4** 게임 보상 서버 검증 (distance 상한·세션 토큰·일일 캡)
2. **C-1** read-modify-write 동시성 수정 (미션 진척 유실 방지)
3. **C-5** 타임존 통일
4. → 그 다음 스프린트에 미션 도입

---

## 9. 마이그레이션 · 안전장치

- `users.missions` 없으면 접근 시 생성 → 기존 유저 무중단.
- 미션 정의 JSON은 정적 콘텐츠 → Supabase 미투입 (레슨 데이터와 동일 원칙).
- 미션 정의 변경 시: 진행 중 유저의 사라진 mission_id 진척 키는 단순 무시(존재하는 것만 노출).

---

## 10. 단계적 도입 로드맵

| 단계 | 내용 | 선행 |
|---|---|---|
| 0 | (선행) B-4 게임검증 · C-1 동시성 · C-5 타임존 | — |
| 1 | `missions.json` + `apply_xp`에 미션 훅 + `GET/POST /missions` (데일리 3종) | 0 |
| 2 | 출석 예외 연동 + 데일리 회귀 테스트 | 1 |
| 3 | 위클리 3종 + `login_days` 집합 + 데일리→위클리 포함관계 | 2 |
| 4 | 프론트 홈 대시보드 미션 위젯 (진척바 + 수령 버튼, `game_rewards` UI 재사용) | 3 |
| 5 | (선택) 미션 리마인더 cron · 시즌/이벤트 미션 확장 | 4 |
