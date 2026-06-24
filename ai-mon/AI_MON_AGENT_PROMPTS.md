---
title: AI-MON Claude Code 실행 프롬프트 (청크별 복붙용)
author: 팀장 (지혜원)
date: 2026-06-24
note: 각 청크 앞에 "공통 프리픽스"를 붙여서 사용. 모델/플랜모드 표기 준수.
---

# AI-MON 에이전트 실행 프롬프트

> 의존 순서: 0-A → 0-B → 0-C → 1 → 2 → 3 → 4 → 리뷰
> 모델 전환: Claude Code에서 `/model`. 까다로운 청크는 plan mode(Shift+Tab 2회)로.

---

## 공통 프리픽스 (모든 청크 앞에 붙임)

```
너는 ai-mon 백엔드(FastAPI) 작업자야. 먼저 아래 문서를 읽고 시작해:
- AI_MON_MISSIONS.md (미션 설계)
- BACKEND_REVIEW_AND_MISSIONS.md (백엔드 리뷰, 심각도 표기)
- AI_MON_SCHEMA.md (데이터 구조)
규칙:
1) 지정한 범위 밖 파일은 건드리지 마. 무관한 리팩토링 금지.
2) 코드 짜기 전에 "수정할 파일 목록 + 접근"을 3~5줄로 먼저 보고해. 내가 OK 하면 진행.
3) 완료 후 변경 요약과 테스트 방법을 알려줘.
```

---

## [Sonnet] 청크 0-A — 타임존 선행 (C-5)

```
작업: 타임존 잔존 이슈를 정리한다. (대부분 now_kst()로 이미 통일됨)
1) scheduler.py의 datetime.now() 7곳(로그 타임스탬프)을 now_kst()로 교체.
2) [중요] 로그 외에 APScheduler 스케줄러/트리거가 KST 타임존으로 설정돼 있는지 확인.
   BackgroundScheduler(timezone=...) 또는 CronTrigger(timezone=...)에 KST가 없으면
   ZoneInfo("Asia/Seoul") 기준으로 명시. 18시 streak 리마인더가 실제 KST 18시에 도는지 보고.
범위: scheduler.py만. today_kst()/iso_week() 헬퍼는 이번에 추가하지 말 것(청크 2에서 도입).
완료 기준: 로그가 KST로 일관되게 찍히고, cron이 KST 기준으로 동작함이 확인됨.
```

## [Opus] 청크 0-B — 게임 보상 서버 검증 (B-4)

```
작업: game.py 보상 어뷰징을 막는다. (미션 도입 전 필수)
- 클라이언트가 보낸 distance를 신뢰하지 말 것. 서버에서 상한·일일 XP 캡 강제.
- 가능하면 게임 start 시 세션 토큰 발급 → submit에서 검증.
범위: game.py 및 관련 서비스만.
완료 기준: distance=99999 같은 값으로 최대 XP 반복 수령이 불가능해짐.
```

## [Opus] 청크 0-C — 동시성 (C-1)

```
작업: read-modify-write lost update를 막는다.
- save_user를 "락 안에서 재로드 → 해당 필드만 갱신 → 저장"으로.
- Supabase 모드의 카운터성 컬럼(xp, crowns 등)은 upsert(전체객체) 대신 원자적 증가 또는 version 낙관적 락.
완료 기준: 보스 클리어와 게임 보상이 동시에 와도 XP/왕관 증가분이 유실되지 않음.
먼저 현재 패턴을 진단해 보고하고, 수정안 2가지(JSON/Supabase)를 제시한 뒤 진행해.
```

## [Opus] 청크 1 — apply_xp 공통 헬퍼 + 미션 훅 (E-1 + 미션 핵심)

```
작업: XP 가산/레벨업/진화/미션 진척을 한 곳으로 모은다.
- apply_xp(user, amount, event_type) -> events 헬퍼 신설.
- 기존 login/progress/boss/miniboss/social에 복붙된 진화 블록 5곳을 이 헬퍼 호출로 교체.
- 헬퍼 내부에서 bump_mission(user, event_type) 호출 (AI_MON_MISSIONS.md 1-1 참고).
- 출석(login)은 XP가 없으므로 auth.py에서 bump_mission 직접 호출.
완료 기준: 미션 연동 지점이 apply_xp 1곳 + 출석 1곳으로 수렴. 진화 규칙 변경 시 1곳만 고치면 됨.
설계가 핵심이니 코드 전에 헬퍼 시그니처와 분기 흐름을 먼저 보고해.
```

## [Sonnet] 청크 2 — 미션 정의 + 라우터

```
작업: 데일리 미션 MVP를 만든다. (AI_MON_MISSIONS.md 3·5장 기준)
- utils.py에 today_kst()(now_kst().strftime("%Y-%m-%d")), iso_week()(%G-W%V, KST) 헬퍼 추가.
- data/missions.json 생성 (데일리 3종: d_quiz3, d_review, d_login).
- routers/mission.py: GET /missions, POST /missions/claim.
- missions_core.py: _ensure_period(lazy reset), bump_mission, find_def.
- claim은 claimed 배열로 멱등성 보장. d_login은 auto_claim 자동지급.
- [필수] 미션 진척/claim 등 미션을 쓰는 핸들러는 반드시 utils.mutate_user_atomic 경로로 저장할 것.
  bump_mission 본체가 login_days/claimed/progress를 append 하므로, 기존 save_user delta-merge
  경로로 저장하면 0-C의 리스트 머지 방어가 깨져 진척이 last-writer-wins 로 유실된다.
완료 기준: 퀴즈 클리어 시 진척이 오르고, 완료 후 claim하면 보상이 1회만 지급됨.
```

## [Sonnet] 청크 3 — 위클리 + 포함관계

```
작업: 위클리 미션과 데일리→위클리 포함관계를 추가한다. (AI_MON_MISSIONS.md 2장)
- 위클리 3종: w_boss2, w_streak5, w_ai5.
- bump_mission 한 번 호출이 데일리·위클리 두 스코프를 동시에 갱신.
- w_streak5는 login_days 날짜 집합으로 하루 1회만 카운트.
완료 기준: 오늘 데일리를 채우면 해당 위클리 게이지도 같이 오름. 주차 바뀌면 lazy reset.
```

## [Sonnet] 청크 4 — 프론트 위젯

```
작업: 홈 대시보드에 미션 위젯을 추가한다.
- GET /missions 결과로 진척바 + 수령 버튼 렌더.
- 기존 game_rewards UI 패턴 재사용. 데일리/위클리 탭 또는 섹션 구분.
완료 기준: 진척/수령 상태가 보이고, 수령 버튼이 POST /missions/claim를 호출.

[추가 작업 — B-4 게임 세션 토큰 프론트 연동]
- 청크 0-B에서 game.py에 POST /game/start(HMAC 토큰 발급) + /game/clear의 game_token 검증을
  optional로 구현해 둠. 이번에 프론트를 연동하고 백엔드를 required로 전환한다.
- AIrun(runner)·Aipang(aipang): 게임 시작 시 POST /game/start{game_id} 호출 → game_token 수령,
  종료 시 gameApi.clearGame에 game_token을 함께 전송.
- 백엔드 game.py: game_token이 없거나 검증 실패하면 보상 거부(required 전환). optional 분기 제거.
- 완료 기준: 토큰 없이 /game/clear 직접 호출 시 보상 미지급. distance 위조·무플레이·리플레이 차단 확인.
```

## [Opus] 마지막 — 통합 리뷰

```
작업: 위 변경 전체를 리뷰한다.
- 멱등성(중복 수령), 동시성(진척 유실), 타임존(자정 경계), 어뷰징(미션+게임 이중 수령) 관점 점검.
- BACKEND_REVIEW_AND_MISSIONS.md 심각도 기준으로 새로 생긴 리스크가 있으면 표로 보고.
```
