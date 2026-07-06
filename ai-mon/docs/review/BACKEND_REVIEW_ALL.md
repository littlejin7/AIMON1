# ai-mon 백엔드 점검 통합본 (라운드 1+2)

> 작성: ai-mon 팀장 / 대상: Claude Code(앱) 순서대로 실행
> 범위: 비로그인 / 홈 / 레슨 / 훈련 / 미니게임 / 내 에이몬 / 보스·미니보스 / 인프라
> 진단 근거: 실측(routers 전체 + services + scheduler + main)
> ※ 코드 터미널 채점(`/code/submit`) 1차 하드닝은 별도 문서(FIX_GUIDE)에서 이미 반영됨 — 여기선 제외
> 형식: 각 항목 = 근본원인 1줄 + 위치 + 수정안 1~2개

---

## 0. 위험도 요약 (한눈에)

| # | 위험도 | 항목 | 위치 |
|---|--------|------|------|
| A | 🔴 | 미니보스 `/clear` 전투 승리 미검증 (정답 0개로 보상) | `miniboss.py` miniboss_clear |
| B | 🔴 | 보스 HP 클라 권위 → 정답 1개로 클리어 (5문제 우회) | `boss.py` submit_boss_answer |
| C | 🔴 | 레슨 진행도 `is_completed` 클라 신뢰 → 해금·왕관·XP 위조 | `progress.py:35` update_progress |
| D | 🔴 | 내에이몬 `update_me` 무검증(캐릭터/칭호)+비원자 | `user.py` update_me |
| E | 🔴 | 내에이몬 `purchase-theme` 비원자 → 이중구매·XP음수 | `user.py` purchase_theme |
| F | 🟠 | 비로그인 `/quiz/questions` 정답 평문 노출 | `quiz.py:316` get_questions |
| G | 🟠 | `attempts.is_correct` 클라 신뢰 → 오답복습 오염·게이팅 불가 | `attempts.py` record_attempt |
| H | 🟠 | 스케줄러 멀티워커 중복 실행(이메일·백업 N배) | `main.py` lifespan + `scheduler.py` |
| I | 🟡 | streak 보상 XP가 apply_xp 우회(미션 미연동) | `auth.py` update_login_streak |
| J | 🟡 | 등록 시 course_level/is_level_tested 클라 신뢰 | `auth.py` register |
| K | 🟡 | boss `/next`·miniboss `/start` 비원자 save_user | boss.py:163 / miniboss.py:146 |

🟢 **이미 양호(손댈 필요 적음):** 미니게임(서버 점수산출·게임토큰·nonce·일일캡), 미션·출석 보상(원자), 동시성·XP 멱등성, admin(fail-closed).

> **공통 패턴:** game/mission/보스 progress는 서버권위·원자 경로인데 **레슨 스테이지 progress·user(내에이몬)·전투 clear·attempts만 클라 신뢰/비원자로 남음.** 같은 규칙으로 수렴시키는 게 핵심.

---

## 1. 상세 진단

### A. 미니보스 /clear — 전투 승리 미검증 🔴
- 근본원인: `/clear`가 `assert_stage_access`(선행조건)만 보고 실제 승리(is_clear)는 안 봄. `ClearRequest`는 unit/stage만 받아 배틀 세션 근거가 없음.
- 위치: `miniboss.py` miniboss_clear
- 수정안: A) `/start` 세션 토큰에 정답 누적을 담아 서버가 검증, 필요정답수 도달 시에만 보상 / B) 서버기록 attempt(miniboss) 정답수 ≥ 5일 때만 (단 G 선결)

### B. 보스 HP 클라 권위 🔴
- 근본원인: `is_clear`가 `clamp(req.boss_hp) - 200` 으로 결정 → 보스 HP가 매 라운드 클라 전송값. 서버 누적 정답수 없음.
- 위치: `boss.py` submit_boss_answer (HP/is_clear 계산부)
- 수정안: A) 정답 누적을 서버 세션 상태로 관리, 5회 정답 시에만 is_clear / B) 세션 토큰에 correct_count 누적·검증

### C. 레슨 진행도 위조 🔴
- 근본원인: `update_progress`가 클라 `is_completed`를 신뢰 → 공개 1-1부터 순차 위조로 전 스테이지·유닛·왕관·XP 해금.
- 위치: `progress.py:35` update_progress
- 수정안: A) 서버 채점/세션 통과 기록이 있을 때만 is_completed=True 허용 / B) stage별 필요정답수 서버 검증 후에만 수용

### D. 내에이몬 update_me 무검증+비원자 🔴
- 근본원인: `character`·`equipped_title`·course_level·is_level_tested를 검증 없이 신뢰하고 save_user(비원자) 저장 → 미획득 진화/칭호 장착, 동시 XP 쓰기 충돌.
- 위치: `user.py` update_me
- 수정안: A) character=현재 lv/진화 단계 내, equipped_title=`title_id in user["titles"]` 검증 / B) mutate_user_atomic 전환

### E. 내에이몬 purchase-theme 비원자 🔴
- 근본원인: 보유체크→XP차감→테마추가를 save_user(비원자)로 처리 → 동시요청 이중구매·XP 이중차감·음수.
- 위치: `user.py` purchase_theme
- 수정안: mutate_user_atomic 임계구역 안에서 (보유체크→차감→append) 원자 처리, 잔액부족/중복은 그 안에서 거부

### F. 비로그인 정답 노출 🟠
- 근본원인: `/quiz/questions`·`/questions/{id}`가 문제 원본(answer/해설 포함)을 그대로 반환 → 객관식/단답 정답 평문 전송(비로그인 공개구간 포함).
- 위치: `quiz.py:316` get_questions / `:362` get_question
- 수정안: A) 직렬화 시 answer 류 strip + 채점 서버 일원화 / B) 최소: 공개구간 응답만이라도 answer 제거

### G. attempts.is_correct 클라 신뢰 🟠
- 근본원인: record_attempt가 is_correct를 클라 입력 그대로 저장(120/min). quiz/train 오답복습의 유일 근거 → 위조 시 오염. (보스 계열은 /answer가 서버에서 직접 기록 → 신뢰 가능)
- 위치: `attempts.py` record_attempt
- 수정안: 게이팅·오답복습은 **서버기록 attempt / 서버 채점 결과만** 신뢰. 클라 record_attempt는 클라채점(객관식/단답) 한정으로 명시. → A·B(전투/레슨) 게이팅을 attempts에 묶지 말 것.

### H. 스케줄러 멀티워커 중복 🟠
- 근본원인: lifespan에서 무조건 scheduler.start() (in-process). `--workers N`/다중 인스턴스면 이메일·백업이 N배.
- 위치: `main.py` lifespan + `scheduler.py`
- 수정안: A) 환경변수(RUN_SCHEDULER) 또는 분산 락으로 단일 러너 보장 / B) 단일워커 확정이면 배포설정에 명시

### I·J·K (낮음)
- I: streak 마일스톤 보상이 user["xp"] 직접 가산(apply_xp 우회) → 의도면 주석, 아니면 통일. `auth.py` update_login_streak
- J: register가 course_level/is_level_tested 클라 신뢰(valid_levels 검증은 있음) → 영향 낮음, 주석 명시. `auth.py` register
- K: boss/next·miniboss/start save_user 비원자 → 보상 무관이면 현행 허용. boss.py:163 / miniboss.py:146

---

## 2. Claude Code 실행 순서 (P0 → 수정 → 회귀)

### 모델
- **P0 확인** → Sonnet 4.6 (`claude-sonnet-4-6`)
- **수정 1·2·3(보상·해금·노출 핵심, 백↔프 교차)** → Opus 4.8 (`claude-opus-4-8`)
- **수정 4(인프라·정리)** → Sonnet 4.6
- **회귀 R** → Opus 4.8

---

**[P0 · Sonnet] 전체 현황 확인 (수정 절대 금지, 읽기 전용)**
```
ai-mon 백엔드를 읽고 아래만 표로 보고해(수정 금지). 각 항목 결론 + 위치(파일:라인) + 악용 시나리오 1줄.
A) miniboss.py /clear 가 실제 전투 승리(is_clear)를 서버 검증하는지, 선행조건만 보는지.
B) boss.py submit_boss_answer 의 is_clear 가 클라 boss_hp 에 의존하는지(서버 누적 정답수 유무).
C) progress.py update_progress 가 is_completed 를 클라 입력으로 신뢰하는지.
D) user.py update_me 가 character/equipped_title 검증 없이 save_user(비원자)로 저장하는지.
E) user.py purchase_theme 가 mutate_user_atomic 없이 XP 차감하는지.
F) quiz.py get_questions/get_question 응답에 answer/해설 필드가 클라로 나가는지.
G) attempts.py record_attempt 의 is_correct 가 클라 입력인지, 오답복습/게이팅이 이 테이블에 의존하는지.
H) main.py lifespan 의 scheduler.start() 가 멀티워커에서 중복 실행될 구조인지.
```

**[수정 1 · Opus] 전투 클리어 서버화 + attempts 신뢰경계 (A·B·G)**
```
ai-mon 전투 보상이 클라 권위에 의존하는 문제를 고쳐줘.
(A) miniboss.py /clear: 선행조건만 보고 승리 검증을 안 해 /answer 없이 /clear 직접 호출로 보상 획득 가능.
(B) boss.py submit_boss_answer: is_clear 가 클라 boss_hp 의존 → boss_hp=200+정답1개로 클리어.
(G) attempts.is_correct 가 클라 신뢰라 게이팅 근거로 못 씀.
기획 확정: 전투 클리어는 서버가 정답 누적을 세어 결정한다.
- /start 에서 game.py _make_game_token 패턴(서명·만료·소유자)으로 배틀 세션 토큰 발급,
  정답 누적을 서버 세션 상태로 검증해 필요정답수(BOSS_HP_INIT/BOSS_HP_DELTA=5) 도달 시에만 clear/보상 허용.
  클라 my_hp/boss_hp 는 표시용 응답으로만 유지.
- 게이팅·오답복습은 서버기록 attempt/서버 채점 결과만 신뢰. 클라 record_attempt 는 객관식/단답 한정으로 명시.
- XP 멱등성(unitboss_cleared_units / miniboss_cleared_stages)·원자경로는 유지.
변경 diff + 부정 클리어가 막히는 근거 + 프론트(BossBattle/StageQuiz)가 보낼 필드 변화 정리.
```

**[수정 2 · Opus] 해금·캐릭터·구매 서버권위/원자화 (C·D·E)**
```
ai-mon 보상·해금 위변조 3건을 고쳐줘.
(C) progress.py update_progress: 비보스 스테이지 완료를 '해당 unit-stage 서버채점 통과 기록'이 있을 때만
    is_completed=True 허용(없으면 stage별 필요정답수 서버검증). boss/miniboss 전담 보상 경로는 건드리지 말 것.
(D) user.py update_me: character 는 현재 lv/진화 단계 내에서만, equipped_title 은 title_id in user["titles"]
    일 때만 허용. 저장을 mutate_user_atomic 으로 전환.
(E) user.py purchase_theme: 보유체크→XP차감→purchased_themes append 를 mutate_user_atomic 임계구역에서
    원자 처리(이중차감·이중구매·XP음수 차단). 잔액부족/중복보유는 그 안에서 거부.
변경 diff + 각 악용 시나리오가 막히는 근거.
```

**[수정 3 · Opus] 정답 노출 차단 (F)**
```
quiz.py get_questions/get_question 이 문제 원본(answer·해설)을 그대로 반환해 객관식/단답 정답이 클라에 노출된다.
직렬화 단계에서 answer/정답계열 필드를 strip 하고, 우선 비로그인 공개구간(1-1)부터 적용.
객관식/단답 채점을 서버로 옮길 때 프론트 클라채점(handleFillSubmit 등) 변경 범위를 리스트업.
code_input(서버채점)과 일관되게. 변경 diff + 영향 보고.
```

**[수정 4 · Sonnet] 인프라·정리 (H·I·J)**
```
(H) main.py lifespan scheduler.start() 가 멀티워커/다중 인스턴스에서 중복 실행되면 streak 이메일·백업이 N배다.
    환경변수(RUN_SCHEDULER) 또는 분산 락으로 단일 러너 보장(또는 단일워커 가정을 배포설정에 명시).
(I) auth.py update_login_streak: streak 보상 XP 가 apply_xp 우회(직접 가산)인 게 의도인지 확인, 의도면 주석 / 아니면 통일.
(J) auth.py register: course_level/is_level_tested 클라 신뢰 구간임을 주석 명시.
변경 diff 보고.
```

**[회귀 R · Opus] 통합 회귀 검증**
```
위 수정 1~4 후 회귀:
1) pytest 전체(특히 test_boss_hp_fix, test_boss_reentry_fix, test_unitboss_entry, test_unit_stages,
   test_train_boss_rush, test_gating_fix, test_rewards, test_concurrency, test_derived_counters,
   test_account_delete, test_game_abuse) 결과.
2) 시나리오:
   - /answer 없이 miniboss /clear → 거부. boss_hp=200+정답1개 → 클리어 안 됨, 정답 5개에만 클리어.
   - is_completed 위조로 타 스테이지/유닛 해금 시도 → 거부.
   - 미획득 캐릭터/칭호 장착 → 거부. 테마 동시 2회 구매 → 1회만·중복차감 없음.
   - /quiz/questions 응답에 answer 없음, 정상 풀이/채점 유지.
   - 스케줄러 워커 2개 → 잡 1회만 실행. 오답복습이 서버기록 attempt 기준 정상.
   - 미니게임·미션·streak 보상 무회귀.
3) 변경 파일 git diff 요약 + 남은 위험.
```

통과 기준: 전투 클리어·스테이지 해금·캐릭터/칭호·구매가 **서버 검증/원자**로만 확정, 정답 비노출, attempts 신뢰경계 분리, 스케줄러 단일 실행, 기존 멱등성·재진입 무회귀.
```
