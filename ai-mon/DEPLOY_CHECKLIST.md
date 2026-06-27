# 운영 배포 체크리스트 (전투 세션 서버권위 릴리스)

> 로컬(JSON 모드, USE_SUPABASE=false)에서는 불필요. 실제 운영(Supabase) 전환·배포 시에만 수행.
> 배경: 보스/미니보스 클리어를 서버 세션(battle_sessions)으로 검증하도록 변경됨(수정 1).

## 1. Supabase 마이그레이션 (먼저)
SQL Editor에서 실행:
```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS battle_sessions jsonb DEFAULT '{}'::jsonb;
```
- 이유: `utils.py` jsonb_cols에 등록돼 있고 `mutate_user_atomic` RPC가 `coalesce(battle_sessions,'{}') || 값`으로 머지 → 컬럼 없으면 RPC 에러.
- `DEFAULT '{}'`로 기존 행 자동 채움. 추가만 하므로 구버전 백엔드에도 무해.

## 2. 프론트·백엔드 동시 배포
- `/answer`·`/clear` 스키마 변경: `my_hp`/`boss_hp` 제거, `battle_token` 필수.
- 구버전 프론트는 battle_token 미전송 → 422 → 전투 불가. **반드시 같은 릴리스로.**
- 변경 프론트 파일: Boss.jsx, Stage.jsx (+ api 호출부).
- 무중단 필요 시: 백엔드를 battle_token 옵셔널(폴백)로 먼저 → 프론트 배포 → 구경로 제거(2단계).

## 3. 스케줄러 멀티워커 가드 (RUN_SCHEDULER) — 멀티워커 배포 시 필수
- 배경: `main.py` lifespan 이 `scheduler.start()` 를 호출. `gunicorn -w N`/`uvicorn --workers N`
  으로 워커가 여러 개면 **모든 워커가 스케줄러를 켜서** 스트릭 리마인더 이메일이 N배 발송되고
  일간 백업이 N회 실행된다.
- 조치: 스케줄러를 담당할 **워커/프로세스 1개에만 `RUN_SCHEDULER=1`**, 나머지는 `RUN_SCHEDULER=0`.
  - 권장: 웹 워커는 전부 `RUN_SCHEDULER=0`, 별도 단일 프로세스(worker role)에 `RUN_SCHEDULER=1`.
  - gunicorn 단일 프로세스 다중 워커 한 컨테이너 구조라면 워커별 env 분리가 어려우므로,
    DB advisory lock(`pg_try_advisory_lock`)으로 선착 워커만 잡는 방식도 대안.
- 미설정 시 기본값 `1`(로컬 단일 워커 편의). **운영 멀티워커에서 미설정 = 중복 실행이므로 반드시 명시.**
- 검증: `RUN_SCHEDULER=0` 워커 로그에 APScheduler 기동 로그가 없고, 단일 담당 워커에서만 1회 기동.

## 4. 배포 직후 스모크 테스트
- 미니보스 1스테이지: 3정답 → 클리어·XP 500 / 2정답 문제소진 → 클리어 불가(재시작).
- 미니보스 `/clear`: 세션 없음/미승리 상태로 POST → 거부(보상 없음).
- 유닛보스 1유닛: 5정답 → 클리어·XP 3000·왕관. boss_hp 조작 전송해도 클리어 안 됨.
- 객관식 오답을 is_correct:true로 위조 POST → 서버 재채점으로 오답 유지.
- 레슨 스테이지: 첫시도 정답 8/10 → 완료 허용 / 오답 후 재시도 정답 8개 → 403(미집계).
- GET /quiz/questions 응답에 `answer`/`feedback`/`hint` 가 없음(정답 비노출).
- 캐릭터/칭호/테마: 미해금·미보유 값 전송 → 거부. 테마 동시 2회 구매 → 1회만 차감.

## 참고: 밸런스 (확정)
- 미니보스 REQUIRED_CORRECT = 3 (5문항 중 3정답이면 클리어).
- 유닛보스 REQUIRED_CORRECT = 5 (변경 없음).

## 알려진 소소한 항목 (비차단)
- 만료 세션 prune이 jsonb `||` 머지로는 키 삭제가 안 돼 stale 세션이 누적될 수 있음 → 추후 정리 잡 고려.
