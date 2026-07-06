# 백엔드 점검 라운드 2 (보스/미니보스/attempts/스케줄러)

> 작성: ai-mon 팀장 / 대상: Claude Code(앱) 순서대로 실행
> 진단 근거: 실측(boss.py, miniboss.py, attempts.py, claude_service.py, scheduler.py, main.py)
> 형식: 근본원인 1줄 + 위치 + 수정안 1~2개 + 위험도

---

## 요약 (위험도 순)

| 위험도 | 항목 | 위치 |
|--------|------|------|
| 🔴 높음 | 미니보스 /clear 가 전투 승리 검증 없이 보상 (정답 0개로 클리어) | `miniboss.py` miniboss_clear |
| 🔴 높음 | 보스 HP가 클라 권위 → 정답 1개로 클리어 가능(5문제 우회) | `boss.py` submit_boss_answer |
| 🟠 중간 | attempts.is_correct 클라 신뢰 → 오답복습 오염 + gating 근거로 못 씀 | `attempts.py` record_attempt |
| 🟠 중간 | 스케줄러 멀티워커/인스턴스 중복 실행(이메일·백업 N배) | `scheduler.py` + `main.py` lifespan |
| 🟡 낮음 | boss /next·miniboss /start 가 save_user(비원자) | boss.py:163, miniboss.py:146 |

---

## 1. 미니보스 /clear — 전투 승리 미검증 🔴

- **근본원인:** `/clear` 가 `assert_stage_access`(선행조건)만 보고 **실제 보스를 이겼는지(is_clear)** 는 검증 안 함 → 클라가 `/answer` 없이 `/clear` 만 직접 호출해도 500 XP + 스테이지 완료 획득.
- **위치:** `backend/routers/miniboss.py` `miniboss_clear`
- **수정안:**
  - A) 클리어를 서버 상태로 증명 — `/start` 시 발급한 세션 토큰에 'boss_hp 진행'을 담아 서버가 누적·검증하고, boss_hp<=0 도달 시에만 `/clear` 허용. (보스 토큰 패턴은 game.py 참고)
  - B) 최소판: `/clear` 에서 해당 (unit,stage) miniboss 모드 attempts 의 정답 수가 'BOSS_HP_INIT/BOSS_HP_DELTA'(=5) 이상일 때만 보상 — 단 ②(attempts 신뢰성) 선결 필요.
- **비고:** XP 멱등성(`miniboss_cleared_stages`)은 견고함 → 이중지급은 안 되지만 **최초 1회를 부정 획득** 가능.

## 2. 보스 HP 클라 권위 🔴

- **근본원인:** `submit_boss_answer` 의 `is_clear` 가 `new_boss_hp = clamp(req.boss_hp) - 200` 로 결정. boss_hp 를 매 라운드 클라가 전송 → `boss_hp=200` 으로 보내고 정답 1개만 맞히면 즉시 클리어(3000 XP + 왕관). 5문제 요구가 무력화.
- **위치:** `backend/routers/boss.py` `submit_boss_answer` (HP delta/`is_clear` 계산부)
- **수정안:**
  - A) 보스 HP를 **서버 세션 상태**로 보유 — `/start` 에서 세션 발급, 정답 누적 횟수를 서버가 세고 5회 정답 시에만 is_clear. 클라 my_hp/boss_hp 는 표시용으로만 응답.
  - B) 최소판: 응답에 `correct_count` 를 서버가 세션 토큰으로 누적·검증해 'BOSS_HP_DELTA*correct_count >= BOSS_HP_INIT' 일 때만 is_clear.
- **비고:** 정답 채점 자체는 서버(AI/direct match)라 '아무 답'으로는 못 깸. 하지만 **필요 정답 수가 1로 축소**되는 게 문제.

## 3. attempts.is_correct 클라 신뢰 🟠

- **근본원인:** `record_attempt` 가 `is_correct` 를 클라 입력 그대로 저장(120/min). 이 테이블이 **오답복습(train/review) 의 유일 근거** → 위조 시 오답복습이 비거나 오염됨. 또한 1·2번의 'attempts 기반 검증'(수정안 B)을 여기에 묶으면 우회 가능해짐.
- **위치:** `backend/routers/attempts.py` `record_attempt`
- **수정안:**
  - A) 채점이 서버인 경로(boss/miniboss/code)는 **서버가 직접 attempt 를 기록**(이미 boss/miniboss answer 가 그렇게 함) → 클라 `record_attempt` 는 객관식/단답 등 클라채점 경로로 한정하고, gating·보상 근거로는 **서버기록 attempt 만** 사용.
  - B) 객관식/단답도 서버 채점으로 옮겨(라운드1 ④와 연계) attempt 신뢰성 확보.
- **결론:** 1·2번 게이팅은 attempts 가 아니라 **서버 채점 결과/세션 상태** 기반이어야 함(클라 attempts 에 의존 금지).

## 4. 스케줄러 멀티워커 중복 실행 🟠

- **근본원인:** `lifespan` 에서 무조건 `scheduler.start()` (APScheduler in-process). uvicorn `--workers>1` 또는 다중 인스턴스(다중 dyno/pod) 환경이면 **streak 리마인더 이메일·일일 백업이 워커 수만큼 중복** 실행.
- **위치:** `backend/main.py` `lifespan` + `backend/scheduler.py`
- **수정안:**
  - A) 단일 러너 보장 — 환경변수(`RUN_SCHEDULER=1`)나 분산 락(DB advisory lock)으로 한 프로세스에서만 start.
  - B) 운영이 단일 워커 확정이면 그 가정을 README/배포설정에 명시 + start 전 워커수 점검 로그.

## 5. 비원자 save_user (낮음) 🟡

- **근본원인:** `boss /next`(현재 문제 인덱스 저장), `miniboss /start` 가 `save_user`(delta-merge 비원자). 동시 요청 시 다른 컬럼 쓰기와 last-writer-wins 경합.
- **위치:** `boss.py:163`, `miniboss.py:146`
- **수정안:** 게임 진행상태가 보상에 영향 없으면 현행 허용(영향 낮음). 영향 있으면 mutate_user_atomic 통일. 우선순위 낮음.

---

## Claude Code 프롬프트 (순서)

### 모델
- ①② 전투 상태 서버화(보상 핵심, 백↔프 교차) → **Opus 4.8** (`claude-opus-4-8`)
- ③ attempts 신뢰경계 → **Opus 4.8**
- ④ 스케줄러 단일러너 → **Sonnet 4.6** (`claude-sonnet-4-6`)
- ⑤ 정리 → **Sonnet 4.6**
- 회귀 R → **Opus 4.8**

---

**[P0 · Sonnet] 확인 (수정 금지)**
```
ai-mon 백엔드 전투 보상 경로를 읽고 보고만 해(수정 금지):
1) miniboss.py /clear 가 실제 전투 승리(is_clear)를 서버에서 검증하는지, 아니면 선행조건만 보는지.
2) boss.py submit_boss_answer 의 is_clear 가 클라가 보낸 boss_hp 에 의존하는지(서버 누적 상태 유무).
3) attempts record_attempt 의 is_correct 가 클라 입력인지, 오답복습/게이팅이 이 테이블에 의존하는지.
4) main.py lifespan 의 scheduler.start() 가 멀티워커에서 중복 실행될 구조인지.
각 항목 악용/중복 시나리오 1줄씩.
```

**[①② · Opus] 전투 상태 서버화**
```
ai-mon 보스/미니보스 보상이 클라 권위 HP/클리어에 의존하는 문제를 고쳐줘.
(①) miniboss.py /clear: 현재 assert_stage_access 만 보고 실제 승리를 검증하지 않아 /answer 없이
    /clear 직접 호출로 500 XP+완료를 부정 획득할 수 있다.
(②) boss.py submit_boss_answer: is_clear 가 클라 boss_hp 에 의존해 boss_hp=200 전송+정답1개로 클리어된다.
기획 확정: 전투 클리어는 서버가 정답 누적을 세어 결정한다.
- /start 에서 게임토큰(game.py의 _make_game_token 패턴 참고: 서명·만료·소유자)을 발급하고,
  보스/미니보스 정답 누적 횟수를 서버 세션 상태로 검증해 필요정답수(BOSS_HP_INIT/BOSS_HP_DELTA=5) 도달 시에만
  is_clear/clear 보상을 허용하라. 클라 my_hp/boss_hp 는 표시용 응답으로만 유지.
- XP 멱등성(unitboss_cleared_units / miniboss_cleared_stages)·원자경로는 그대로 유지.
변경 diff + 부정 클리어가 막히는 근거 + 프론트(BossBattle/StageQuiz)가 보낼 필드 변화 정리.
```

**[③ · Opus] attempts 신뢰경계**
```
attempts.record_attempt 의 is_correct 가 클라 신뢰라 오답복습 근거가 오염되고, 게이팅 근거로 쓸 수 없다.
- 서버 채점 경로(boss/miniboss/code)는 서버가 직접 attempt 를 기록하도록 유지/정리하고,
  클라 record_attempt 는 클라채점(객관식/단답) 한정으로 명시.
- train/review 오답복습과 향후 게이팅은 '서버기록 attempt 또는 서버 채점 결과'만 신뢰하도록 경계를 문서화/코드화.
변경 diff + 영향 범위 보고.
```

**[④ · Sonnet] 스케줄러 단일 러너**
```
main.py lifespan 의 scheduler.start() 가 멀티워커/다중 인스턴스에서 중복 실행되면 streak 리마인더 이메일·
일일 백업이 N배로 나간다. 환경변수(RUN_SCHEDULER) 또는 분산 락으로 한 프로세스에서만 기동하도록 가드하고,
단일 워커 가정이면 배포설정에 명시. 변경 diff 보고.
```

**[R · Opus] 회귀 검증**
```
위 수정 후 회귀:
1) pytest 전체(특히 test_boss_hp_fix, test_boss_reentry_fix, test_unitboss_entry, test_unit_stages,
   test_train_boss_rush, test_rewards, test_concurrency, test_derived_counters) 결과.
2) 시나리오:
   - /answer 없이 miniboss /clear 직접 호출 → 거부(보상 없음).
   - boss boss_hp=200 + 정답1개 → 클리어 안 됨. 정답 5개 정상 누적 시에만 클리어·3000XP·왕관 1회.
   - 정상 보스/미니보스 클리어·재진입 시 이중지급 없음.
   - 스케줄러: 워커 2개 기동 시 streak/백업 잡 1회만 실행.
   - 오답복습이 서버기록 attempt 기준으로 정상 동작.
3) 변경 파일 git diff 요약 + 남은 위험.
```

통과 기준: 전투 클리어가 **서버 정답누적**으로만 성립, attempts 신뢰경계 분리, 스케줄러 단일 실행, 기존 멱등성·재진입 무회귀.
