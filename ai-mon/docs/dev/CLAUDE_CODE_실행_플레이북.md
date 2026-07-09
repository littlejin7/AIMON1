# AI-Mon 개편 — 클로드코드 실행 플레이북

XP 폐기 · coin/GP/ranking_score 분리 · 크리스탈 미사용
단계별 프롬프트 + 사용 모델 + 커밋 시점(한글 커밋 메시지)

---

## 한눈에 보는 전체 흐름

| 단계 | 작업 | 모델 | 커밋 |
|---|---|---|---|
| 0 | 준비(백업·브랜치) | — (사람이 직접 터미널) | 커밋 없음 |
| 1 | 전체 스캔(수정 X) | `claude-sonnet-5` | 커밋 없음 |
| 2 | 백엔드 보상 로직 분리 | `claude-opus-4-8` | ✅ 커밋 1 |
| 3 | DB/마이그레이션 검토 | `claude-opus-4-8` | ✅ 커밋 2 (마이그레이션 초안만) |
| 4 | 프론트 UI 정리 | `claude-sonnet-5` | ✅ 커밋 3 |
| 5 | 테스트/회귀 검증 | `claude-sonnet-5` (실패 분석 복잡 시 opus) | ✅ 커밋 4 |
| 6 | 커밋 전 최종 검수 | `claude-sonnet-5` | 커밋 없음(확인만) |

> 원칙: **한 세션에 다 시키지 않는다.** 단계마다 diff 확인 → 승인 → 커밋 → 다음 단계.

---

## 모든 프롬프트 맨 위에 붙일 공통 안전 규칙

```text
[안전 규칙]
- main 브랜치에서 직접 수정하지 마라.
- 먼저 git status --short, git branch --show-current를 확인해라.
- 미커밋 변경이 있으면 작업하지 말고 보고해라.
- 내 승인 전에 git add / commit 하지 마라.
- DB 컬럼 drop, xp 삭제, 운영 DB migration 실행 금지.
- git reset --hard, git clean -fdx 같은 파괴적 명령 금지.
- 무관 파일 수정 금지.
- 수정 파일이 10개를 넘길 것 같으면 실제 수정 전에 파일 목록과 이유를 먼저 보고하고 승인받아라.
- 단계가 끝나면 git diff --stat, git diff --name-only를 보고해라.
```

---

## 0단계 — 준비 (사람이 직접 터미널에서 실행)

클로드코드에 넘기기 전에 **내 손으로** 실행. Windows면 인코딩 먼저 고정:

```powershell
$env:PYTHONIOENCODING = "utf-8"; $env:PYTHONUTF8 = "1"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

백업 + 작업 브랜치:

```bash
git status --short
git checkout main
git pull origin main
git checkout -b feat/gp-coin-reward-system
git branch backup/pre-gp-coin-refactor          # 되돌릴 지점
git bundle create ../ai-mon-pre-gp-coin-refactor.bundle --all   # 전체 히스토리 백업
mkdir -p ../ai-mon-refactor-patches
```

커밋: **없음** (여긴 안전장치만 세팅)

---

## 1단계 — 전체 스캔 (수정 금지)

모델: **`claude-sonnet-5`** → 세션에서 `/model claude-sonnet-5`

붙여넣을 프롬프트:

```text
[안전 규칙 — 위 공통 블록 붙여넣기]

너는 ai-mon 프로젝트의 정적 분석 담당자다. 아직 코드를 수정하지 않는다.

정책:
- XP는 폐기한다.
- 코인은 상점 전용 재화다.
- GP는 3차 진화(evolution_stage>=3) 이후 성장치다.
- ranking_score는 리더보드 전용 점수다.
- 크리스탈은 사용하지 않는다.
- 진화는 초급/중급/고급 엔드보스 클리어로만 발생한다.
- 3차 진화 전 GP는 절대 발생하지 않는다.

목표:
XP / xp / experience / coin / GP / gp / ranking_score / leaderboard / score /
crystal / 크리스탈 / reward / evolution / boss / shop / purchase 사용처를
전체 스캔하고, 각 사용처를 재화/성장/랭킹/UI표시/테스트/불명확으로 분류해라.

금지: 코드 수정 / 파일 생성·삭제 / commit / migration 생성. 읽기 명령(rg/grep/find/cat)만 사용.

보고 형식:
A. 결론 (XP가 주로 어떤 역할인지 / 크리스탈 잔존 / 리더보드 정렬 기준 / 상점 차감 자원 / 진화 트리거)
B. XP 사용처 표 (영역|파일|라인|현재역할|변경방향|위험도)
C. coin 사용처 표
D. GP 사용처 표
E. ranking/leaderboard 사용처 표
F. crystal 잔존 표
G. reward/evolution/boss/shop 연결 구조
H. 위험 파일 TOP 10
I. 다음 수정 순서 제안

시작과 끝에 git status를 확인하고, 수정이 0건임을 명시해라.
```

끝나면: 보고서를 **내가 직접 읽고 검토**. (수정 0건이므로 커밋 없음)

---

## 2단계 — 백엔드 보상 로직 분리

모델: **`claude-opus-4-8`** → `/model claude-opus-4-8` (다중 파일·회귀 위험 큼)

붙여넣을 프롬프트:

```text
[안전 규칙 — 위 공통 블록 붙여넣기]

너는 ai-mon 백엔드 수정 담당자다. 1차 스캔 결과를 기준으로 수정한다.

정책:
1. coin은 상점 전용 재화 (게임/스테이지/퀘스트 클리어 시 지급).
2. gp는 evolution_stage>=3일 때만 증가. 그 전엔 gp_delta=0 고정.
3. ranking_score는 리더보드 전용 점수, 소비 없음.
4. 보스 클리어 = 진화 트리거. 보스 클리어 시 gp_delta 기본 0, coin은 정책상 지급 가능.
5. 상점 구매 = coin_balance만 차감. gp/ranking_score/evolution_stage 불변.
6. xp 신규 지급 중단. xp 필드는 삭제하지 말고 deprecated/legacy로 보존.
7. 크리스탈 신규 추가 금지.

구현 방향:
- 보상 계산 공통 유틸을 만들고 이벤트별 delta(coin_delta/gp_delta/ranking_score_delta)를 명시.
- gp 계산에 evolution_stage gate를 반드시 둔다:
    if evolution_stage < 3: gp_delta = 0
- shop purchase는 coin_balance만 참조/차감.
- leaderboard는 ranking_score 기준으로 분리.
- DB 스키마 변경이 필요하면 이번 단계선 수정하지 말고 3단계용으로 목록만 보고.

API 응답 권장 구조:
{ "success": true, "event_type": "...",
  "reward": {"coin_delta":30,"gp_delta":0,"ranking_score_delta":30},
  "user_state": {"coin_balance":1240,"gp":0,"level":1,"evolution_stage":2,"ranking_score":5820,"weekly_ranking_score":240},
  "evolution": {"evolved":false,"from_stage":2,"to_stage":2} }

필수 테스트:
1) 3차 전 일반 클리어: coin↑, gp 불변, ranking_score↑
2) 3차 후 일반 클리어: coin↑, gp↑, ranking_score↑
3) 초/중/고급 보스 클리어: evolution_stage↑, gp 불변
4) 상점 구매 성공: coin_balance↓, gp/ranking_score 불변
5) 상점 구매 실패(잔액부족): 값 불변
6) 리더보드: ranking_score 기준 정렬 (coin/gp 기준 금지)

프로젝트에 맞는 테스트 명령을 직접 확인 후 실행(pytest / npm test / npm run build 등).

보고: A.결론 B.수정파일 목록 C.파일별 변경 D.보상 정책 E.DB변경 필요여부 F.테스트 명령·결과 G.남은 위험 H.커밋 가능 여부

금지: xp 전역 rename / xp 컬럼 drop / 무관 파일 수정 / 테스트 실패 은폐.
```

끝나면 diff·테스트 확인 후 **패치 저장 + 커밋**:

```bash
git diff > ../ai-mon-refactor-patches/02-backend-reward-split.patch
git add <승인된 백엔드 파일만>
git commit -m "feat(rewards): XP 보상 로직을 coin·GP·ranking_score로 분리"
```

> ✅ **커밋 1**

---

## 3단계 — DB / 마이그레이션 검토

모델: **`claude-opus-4-8`** (데이터 손실 위험)

붙여넣을 프롬프트:

```text
[안전 규칙 — 위 공통 블록 붙여넣기]

너는 ai-mon DB 마이그레이션 검토 담당자다.

목표: XP 폐기 + coin/gp/ranking_score 도입에 필요한 스키마 변경을 검토하고
안전한 additive migration 초안만 작성해라. 운영 DB엔 적용하지 않는다.

확인:
1. 사용자 모델에 xp 필드가 있는지
2. coin/point/currency/wallet 관련 필드가 이미 있는지
3. evolution_stage / level 필드가 있는지
4. leaderboard 점수 필드가 있는지
5. 저장소가 Supabase/Postgres/SQLite/json 중 무엇인지
6. migration 관리 방식이 Alembic/Prisma/SQL직접/없음 중 무엇인지

권장 신규 필드(additive-first, 기존 필드 삭제 금지):
coin_balance, total_coin_earned, gp, level, evolution_stage,
ranking_score, weekly_ranking_score, legacy_xp_snapshot

전환 전략: 새 컬럼 추가 → 백필 → 듀얼 라이트 → 읽기 컷오버 → (나중에) 구 필드 제거.

출력: A.현재 DB 구조 B.추가 필요 필드 C.재사용 가능 필드 D.migration 필요여부
E.backfill 정책 F.rollback 정책 G.운영 적용 전 리스크

금지: 운영 DB 명령 실행 / production URL·API key 출력 / 개인정보 출력 / xp 컬럼 삭제.
```

끝나면 (마이그레이션 **파일 초안만** 생성된 경우):

```bash
git add <migration 초안 파일만>
git commit -m "chore(db): coin·GP·ranking_score용 additive 마이그레이션 초안 추가"
```

> ✅ **커밋 2** (검토만 하고 초안이 없으면 커밋 생략)
> ⚠️ 백필·운영 적용은 여기서 하지 않는다. 별도 승인 후 진행.

---

## 4단계 — 프론트 UI 정리

모델: **`claude-sonnet-5`** → `/model claude-sonnet-5`

붙여넣을 프롬프트:

```text
[안전 규칙 — 위 공통 블록 붙여넣기]

너는 ai-mon 프론트엔드 수정 담당자다.

정책:
1. 사용자 화면에 "XP"/"경험치" 노출 금지.
2. 사용자 화면에 "크리스탈"/"crystal" 노출 금지.
3. 상점은 coin만 표시.
4. GP는 evolution_stage>=3일 때만 표시.
5. 리더보드는 ranking_score(또는 Battle Score)로 표시.
6. 보스 결과 화면은 보상보다 "진화 성공" 메시지를 먼저 표시.
7. 3차 진화 전 게임 결과엔 GP 미표시, 3차 후엔 coin+GP 표시.

문구 기준:
- "XP +30 획득!" → "코인 +30 획득!"
- "AI-Mon이 최종 진화했습니다. 이제부터 GP를 모아 무한 레벨업할 수 있습니다."
- "코인이 부족합니다." / "구매 완료! 코인 300개를 사용했습니다."
- "주간 랭킹 점수" / "누적 랭킹 점수"

작업 순서:
1. 프론트 전체에서 XP/크리스탈/coin/GP/ranking UI 사용처 검색
2. 결과 모달·보상 토스트·홈/HUD·상점·리더보드·보스 클리어 화면 우선 수정
3. 바뀐 API 필드 fallback 처리(reward.coin_delta/gp_delta/ranking_score_delta,
   user_state.coin_balance/gp/evolution_stage)
4. 빌드 실행
5. 잔존 문자열 검색:
   rg -n "XP|\bxp\b|경험치|크리스탈|crystal" src -g '!node_modules' -g '!dist' -g '!build'

보고: A.결론 B.수정파일 C.화면별 전/후 D.빌드결과 E.잔존 문자열 결과 F.수동확인 필요 화면

금지: 무관 디자인 대개편 / 전체 변수명 무분별 rename / API 추측 대규모 변경 / 빌드 실패 종료.
```

끝나면 빌드·잔존 문자열 0건 확인 후:

```bash
git diff > ../ai-mon-refactor-patches/03-frontend-ui.patch
git add <승인된 프론트 파일만>
git commit -m "feat(ui): XP·크리스탈 문구 제거 및 coin·GP·랭킹점수 UI로 정리"
```

> ✅ **커밋 3**

---

## 5단계 — 테스트 / 회귀 검증

모델: **`claude-sonnet-5`** (실패 원인 분석이 복잡해지면 `claude-opus-4-8`)

붙여넣을 프롬프트:

```text
[안전 규칙 — 위 공통 블록 붙여넣기]

너는 ai-mon QA/회귀 테스트 담당자다.

검증할 정책:
- 3차 진화 전 GP 증가 금지
- 코인/ XP로 진화 금지
- 상점 구매 시 GP/ranking_score 변화 금지
- 리더보드는 ranking_score 기준
- 사용자 화면에 XP/크리스탈 노출 금지
- 보스 클리어 없이 evolution_stage 상승 금지
- 보스 클리어 보상으로 GP 지급 금지

작업:
1. 기존 테스트 명령 확인 후 백엔드 테스트 실행
2. 프론트 빌드 실행
3. 아래 P0 시나리오 회귀 테스트 추가:
   1) 신규 유저 일반 클리어 → coin↑, gp 0, stage 유지
   2) 초급 보스 → stage 1, gp 0
   3) 중급 보스 → stage 2, gp 0
   4) 고급 보스 → stage 3, gp 0
   5) 3차 후 일반 클리어 → coin↑, gp↑
   6) 상점 구매 성공 → coin↓, gp/ranking 불변
   7) 상점 구매 실패 → 값 불변
   8) 리더보드 → ranking_score 정렬
   9) XP 문자열 사용자 노출 0건
   10) 크리스탈 문자열 사용자 노출 0건
4. XP/크리스탈 잔존 문자열 검색
5. 수동 확인 필요 화면 정리

보고: A.실행 명령 B.통과 C.실패 D.실패 원인 E.정책 위반 여부 F.배포 차단 이슈 G.커밋 가능 여부

금지: 실패 테스트 삭제로 통과시키기 / 정책 위반을 TODO로 넘기고 성공 처리 / 무관 파일 수정.
```

전체 통과 확인 후:

```bash
git diff > ../ai-mon-refactor-patches/04-tests.patch
git add <테스트 파일만>
git commit -m "test(rewards): coin·GP·랭킹·진화 회귀 테스트 추가"
```

> ✅ **커밋 4**
> ⚠️ 테스트 실패 상태에서는 절대 커밋하지 않는다.

---

## 6단계 — 커밋 전 최종 검수 (커밋 금지, 확인만)

모델: **`claude-sonnet-5`**

붙여넣을 프롬프트:

```text
[안전 규칙 — 위 공통 블록 붙여넣기]

너는 커밋 전 최종 검수 담당자다. commit / git add 하지 마라.

실행:
git status --short
git diff --stat
git diff --name-only

확인:
1. 수정 파일이 이번 작업 범위에 맞는지 / 무관 파일이 섞였는지
2. XP·크리스탈 사용자 노출이 남았는지
3. gp gate(evolution_stage>=3)가 있는지
4. shop purchase가 coin만 차감하는지
5. leaderboard가 ranking_score 기준인지
6. 테스트가 통과했는지
7. migration이 안전한지(additive, xp drop 없음)
8. 개인정보/키/환경변수가 diff에 포함됐는지

보고: A.결론(커밋가능/보류) B.수정파일 C.파일별 요약 D.테스트결과 E.잔존 리스크
F.커밋 포함 파일 G.제외 파일 H.추천 커밋 메시지
```

---

## 커밋 시점 요약 (한글 메시지)

| 순번 | 시점 | 커밋 메시지 |
|---|---|---|
| 1 | 2단계 백엔드 로직 분리 완료·테스트 통과 | `feat(rewards): XP 보상 로직을 coin·GP·ranking_score로 분리` |
| 2 | 3단계 마이그레이션 초안 생성 시 | `chore(db): coin·GP·ranking_score용 additive 마이그레이션 초안 추가` |
| 3 | 4단계 프론트 정리·빌드 통과·잔존 문자열 0 | `feat(ui): XP·크리스탈 문구 제거 및 coin·GP·랭킹점수 UI로 정리` |
| 4 | 5단계 회귀 테스트 추가·전체 통과 | `test(rewards): coin·GP·랭킹·진화 회귀 테스트 추가` |

> 변경 규모가 작으면 한 커밋으로 합쳐도 됨:
> `feat(rewards): XP 폐기 및 coin·GP·ranking_score 분리 개편`

작업 완료 후 원격 반영:

```bash
git push -u origin feat/gp-coin-reward-system
# 이후 PR 생성 → 리뷰 → main 병합
```

---

## 되돌리기 (문제 발생 시)

```bash
git restore .            # 마지막 커밋 전 수정 취소
git restore <파일>        # 특정 파일만
git checkout backup/pre-gp-coin-refactor   # 백업 브랜치로 복귀
git apply ../ai-mon-refactor-patches/02-backend-reward-split.patch   # 특정 단계 재적용
```

> `git reset --hard`, `git clean -fdx`는 사람이 직접 확인 후에만.

---

## 배포 전 체크리스트

- [ ] git 상태에 무관 파일 없음
- [ ] 백엔드 reward/shop/ranking/evolution 테스트 통과
- [ ] `npm run build` 통과
- [ ] XP 문자열 사용자 노출 0건
- [ ] 크리스탈 문자열 사용자 노출 0건
- [ ] GP gate(`evolution_stage >= 3`) 확인
- [ ] 상점은 coin만 차감
- [ ] 리더보드는 ranking_score 기준
- [ ] 보스는 진화 트리거만 담당(GP 미지급)
- [ ] xp 컬럼 drop 없음(legacy 보존)
- [ ] 로그에 개인정보/키 노출 없음
