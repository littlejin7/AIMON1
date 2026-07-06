---
title: AI-MON 백엔드 개선 — Claude Code 실행 가이드
author: 팀장 (지혜원)
date: 2026-06-25
용도: 이 문서를 그대로 Claude Code(앱)에 붙여넣어 순서대로 실행
---

# 0. 먼저 읽을 것 (현황 요약)

- 스택: FastAPI + (JSON 파일 ↔ Supabase 듀얼모드, `USE_SUPABASE` 플래그)
- **이미 처리된 항목** (다시 손대지 말 것): `SECRET_KEY` 폴백 제거(미설정 시 기동 실패), `/code/*` rate limit, Claude 호출 timeout, `mutate_user_atomic()` 원자 쓰기 경로, 미션 청크 1~3, `lifespan` 전환(구 `@app.on_event` 제거됨).
- **런타임 AI 모델**: 현재 3개 호출 전부 `claude-haiku-4-5-20251001`.
- 잔여 이슈는 아래 우선순위대로. 출처: `BACKEND_REVIEW_AND_MISSIONS.md`.

---

# 1. Claude Code에서 쓸 모델

| 작업 묶음 | 추천 모델 | 이유 |
|---|---|---|
| Phase A (동시성·SSOT·마이그레이션 블로커: C-2, C-3, C-4, M-4) | **Opus** | 상태머신/동시성 추론이 깊음. 한 번에 정확히 가야 회귀 적음 |
| Phase B (보안·견고성 기계적 수정: B-4, B-5, B-6, B-8, D-1, D-2) | **Sonnet** | 패턴이 명확하고 반복적. 빠르고 저렴 |
| Phase C (정리: B-7, C-5, 테스트 보강) | **Sonnet** | 저위험 백로그 |

> 런타임(앱 내) AI 모델 권고: 오답 피드백은 Haiku 4.5 유지로 충분. 단 **보스 채점(`boss.py`)만 Sonnet으로 승격** 검토 — 부정확한 채점이 곧 유저 HP 손실(D-1)과 직결되므로 정확도 이득이 비용을 정당화함.

Claude Code 실행 팁: Phase별로 `/model` 전환. 각 Phase 시작 전 `git checkout -b fix/<phase>` 로 브랜치 분리, Phase 끝마다 테스트(`pytest backend/tests`) 통과 후 커밋.

---

# 2. 붙여넣기용 프롬프트 — 순서대로

아래 블록을 **하나씩** Claude Code에 넣어. 한 번에 다 주지 말 것(컨텍스트 분산·회귀 위험).

## ▶ Phase 0 — 깃 정리 + 시크릿 회수 (⚠️ 최우선, 다른 작업보다 먼저)
> `.env`/유저 JSON이 `.gitignore` 적용 전에 커밋돼 원격에 남아있을 수 있음. **추적만 해제로는 부족** — 이력에 남아있으면 키가 노출된 상태이므로 회수까지.
```
민감 파일이 깃에 올라갔는지부터 진단하고 정리해줘. 순서:
1) 현재 추적 여부: `git ls-files | grep -iE "\.env|users\.json|progress\.json|wrong_answers|reset_tokens|backup"` 로 .env, backend/data 하위 유저 데이터(users/progress/wrong_answers.json, backup/, reset_tokens)가 추적되는지 확인.
2) 이력에 한 번이라도 있었는지: `git log --all --oneline -- <각 파일>` 로 과거 커밋/원격(origin) 포함 여부 확인. 결과를 먼저 표로 보여줘.
3) 추적 중이면 `git rm --cached`로 추적 해제(로컬 파일은 유지)하고, .gitignore가 해당 경로를 모두 덮는지 점검 후 커밋.
4) 이력에 있었고 이미 push됐다면: git-filter-repo(또는 BFG)로 해당 경로를 전체 이력에서 제거하는 정확한 명령을 제시하고, force-push 전 영향(협업자 재클론 필요)과 백업 방법을 먼저 안내해줘. force-push는 내가 확인 후 직접 실행할 테니 명령만 제시.
5) .env가 한 번이라도 노출됐다면, 들어있는 모든 키를 "재발급 필요" 체크리스트로 정리: ANTHROPIC_API_KEY, SECRET_KEY(JWT), GOOGLE/KAKAO/NAVER OAuth client secret, SUPABASE_KEY. 각 키 재발급 위치도 한 줄씩.
아직 push 전이라면 이력 재작성 없이 추적 해제 + 커밋으로 끝내도 되는지도 판단해서 알려줘.
```

## ▶ 사전 작업 (1회) — CLAUDE.md 생성
```
backend/ 루트에 CLAUDE.md를 만들어줘. 포함: (1) 듀얼 스토리지 규칙 — 유저 상태를 바꾸는 모든 쓰기는 반드시 mutate_user_atomic() 경로를 쓰고 save_user 직접 호출 금지, (2) numeric/jsonb/other 컬럼 분류표, (3) 보상 지급은 항상 "중복 가드 → 변경 → 저장"을 같은 임계구역에서, (4) 새 엔드포인트는 Claude/이메일/외부호출 시 limiter.limit 필수. 코드는 바꾸지 말고 문서만.
```

## ▶ Phase A-1 — 마이그레이션 블로커 (C-4)
```
wrong_answers의 실제 코드 저장 필드(feedback, ai_explanation, reviewed, timestamp)와 SUPABASE_MIGRATION_PLAN.md의 테이블 컬럼(question, correct_answer, course_level)이 불일치한다. 실제 코드가 저장/조회하는 필드를 grep으로 전수 확인한 뒤, 코드 기준으로 Supabase DDL을 재작성하고 마이그레이션 플랜 문서를 갱신해줘. /train 복습 플로우가 reviewed/ai_explanation에 의존하는지 반드시 확인하고, 깨지지 않게. 스키마 변경에 대한 마이그레이션 스크립트(migrate_json_to_supabase.py)도 같이 맞춰줘.
```

## ▶ Phase A-2 — 카운터 SSOT (C-2)
```
completed_stages, boss_cleared가 여러 핸들러에서 +1 되는 동시에 serialize_user에서 progress 기반으로 재계산 후 max() 보정되어 저장값과 계산값이 드리프트한다. 단일 진실 공급원을 정하자: progress를 진실로 삼고 이 두 카운터는 serialize에서만 파생 계산하도록 통일하고, 핸들러의 직접 +1 가산을 전부 제거해줘. 제거 전에 어떤 핸들러가 이 필드를 쓰는지 목록을 먼저 보여주고, 영향 범위 확인 후 진행.
```

## ▶ Phase A-3 — 왕관 판정 폴백 (C-3)
```
progress.py의 유닛 완료/왕관 판정이 총 스테이지 수를 lessons 데이터에서 못 읽으면 하드코딩 7로 폴백한다. 현재 unit별 스테이지가 6/7 제각각이라 6스테이지 유닛은 왕관이 영구 미지급될 수 있다. lessons 데이터에 stages 값을 정합성 있게 채우고, 하드코딩 폴백 7을 제거해 데이터 없으면 에러 로깅하도록 바꿔줘. 전 유닛 stages 실측값을 표로 먼저 출력해서 검증 후 적용.
```

## ▶ Phase A-4 — 유닛보스 XP 이중 지급 (M-4)
```
boss.py submit_boss_answer의 유닛보스 XP 중복 가드가 progress.is_completed(users와 다른 스토리지) 기반이라 동시 중복 제출 시 XP/왕관 이중 지급이 가능하다. 가드를 유저 객체 내 컬럼(예: unitboss_cleared_units 리스트)으로 옮겨 mutate_user_atomic 임계구역 안에서 "이미 지급됐는지 검사 → 지급 → 저장"이 원자적으로 일어나게 리팩터해줘. test_concurrency.py에 동시 이중 제출이 1회만 지급되는 회귀 테스트 추가.
```

## ▶ Phase B-1 — 게임 보상 검증 (B-4)
```
game.py runner가 클라이언트가 보낸 distance를 무검증으로 XP에 반영하고 aipang도 결과 무검증으로 왕관 지급한다. 서버에서 (1) 게임 start 시 세션 토큰/nonce 발급, submit 시 검증·일회성 소비, (2) distance 상한과 일일 XP 캡을 서버에서 강제하도록 추가해줘. 보상 지급은 mutate_user_atomic 경로로. 어뷰징 시나리오(distance=99999 반복)를 막는 테스트 추가.
```

## ▶ Phase B-2 — 비번재설정/이메일 보안 (B-2, B-5)
```
auth.py의 forgot-password / reset-password에 (1) limiter.limit 적용(예: IP+email당 5/hour), (2) 6자리 숫자 토큰을 secrets 기반 URL-safe 32자 토큰으로 교체, (3) 실패 N회 시 토큰 무효화를 추가해 brute-force와 이메일 폭탄을 막아줘.
```

## ▶ Phase B-3 — 외부 호출 timeout (B-6)
```
auth.py의 google/naver/kakao OAuth용 requests.post/get에 timeout이 없다. 모든 외부 호출에 timeout=(3,10)을 적용하고, 가능하면 동기 requests를 이미 의존성에 있는 httpx 비동기로 교체해줘.
```

## ▶ Phase B-4 — AI 채점 실패 분리 (D-1)
```
claude_service.ask_claude_json이 파싱/네트워크 실패 시 {is_correct:False}를 반환하고 boss.py가 이를 그대로 받아 유저 HP를 깎는다. AI 장애가 곧 유저 패배가 되지 않게, grading_failed 플래그를 도입해 실패 시 HP 차감을 보류하고 재시도를 안내하도록 고쳐줘. 정답 직접매칭을 우선하고 AI는 보조로.
```

## ▶ Phase B-5 — 로깅 정리 (B-8, D-2)
```
user.py의 print(payload) PII 로그를 제거하고 logging 모듈 기반 구조적 로깅으로 교체. serialize_user 등의 광범위한 except: pass를 최소 logger.exception으로 바꿔 장애를 더 이상 조용히 삼키지 않게 해줘.
```

## ▶ Phase B-6 — 신규 게임 "에이짝" 백엔드 연동 (기능 추가)
> game.py는 이미 aipang/runner를 HMAC 게임토큰 + nonce 일회성 소비 + 일일캡 + mutate_user_atomic 패턴으로 처리한다. 에이짝도 **이 패턴을 그대로** 따를 것 — 클라이언트 점수 무검증 지급(B-4)을 재발생시키지 말 것.
```
game.py에 신규 미니게임 "에이짝"을 추가해줘. 기존 aipang/runner 연동 구조를 그대로 따른다:
1) /start 화이트리스트에 "에이짝"(game_id) 추가, _make_game_token으로 게임토큰 발급.
2) MIN_PLAY_SECONDS 등 게임별 상수 테이블에 에이짝 항목 추가.
3) /clear에 에이짝 분기 추가 — _verify_game_token으로 토큰·최소플레이시간 검증, _consume_nonce로 일회성 소비.
4) 보상 지급은 mutator(user) 안에서 처리하고 mutate_user_atomic 경로로 저장. game_rewards에 에이짝 일일 카운트/날짜 필드(예: aizzak_last_date, aizzak_today_count)로 일일 캡 강제.

게임 규칙(내가 채울 값):
- 보상: <왕관/XP 중 무엇, 얼마>
- 일일 지급 한도: <예: 하루 N회>
- 최소 플레이 시간(MIN_PLAY_SECONDS): <초>
- 점수/거리 검증: <runner처럼 score 상한이 필요한지, 아니면 aipang처럼 완료만으로 지급인지>

먼저 기존 aipang/runner 처리부를 요약해 보여주고, 에이짝을 어디에 어떻게 끼워넣을지 diff 계획을 제시한 뒤 적용해줘. 어뷰징(토큰 재사용·일일캡 초과·점수 조작) 차단 테스트도 test 파일에 추가.
```

## ▶ Phase C — 백로그 (B-7, C-5)
```
(C-5) created_at은 UTC, streak/일일리셋은 KST로 한 객체에 두 타임존이 섞여 있다. now_kst() 헬퍼로 통일하고 저장은 timezone-aware ISO로. (B-7) 강제 로그아웃/밴 대비 token_version 컬럼 기반 access token 무효화를 검토·도입해줘.
```

---

# 3. 실행 규칙 (Claude Code에 같이 줄 것)

- 각 Phase는 **독립 브랜치 + 별도 커밋**. 한 PR에 섞지 말 것.
- 모든 유저 상태 변경은 `mutate_user_atomic()` 경유. `save_user` 직접 호출 추가 금지.
- 변경 전 영향 범위(어떤 핸들러/필드)를 **먼저 출력**하고 확인받은 뒤 수정.
- Phase 종료마다 `pytest backend/tests` 통과 필수. 동시성 관련 변경은 회귀 테스트를 같이 추가.
- 데이터 스키마 변경(C-3, C-4)은 마이그레이션 스크립트와 문서를 동시 갱신.
