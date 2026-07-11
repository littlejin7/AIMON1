---
title: AI-MON 운영 배포 체크리스트
version: "2.1"
status: current
last_verified_commit: d4eb619e1479eb83d3c02859af8e6733e97e9d82
last_verified_at: 2026-07-11
---

# AI-MON 운영 배포 체크리스트

> Render 백엔드, Supabase, 프론트 배포와 운영 스모크 테스트의 현재 기준입니다.

---

## 0. 현재 배포 상태

| 항목 | 상태 |
|---|---|
| 기본 브랜치 | `main` |
| Render Backend | 배포 완료 |
| Backend URL | `https://aimon1.onrender.com` |
| Render 요금제 | Free Web Service |
| Supabase 연결 | 완료 |
| Supabase RLS·권한 차단 | 완료 |
| 프론트 운영 배포 | 미완료 |
| `RUN_SCHEDULER` | `0` |
| 운영 도메인 CORS | 프론트 배포 후 최종 확정 |

---

## 1. 배포 기준

백엔드와 프론트는 가능한 한 같은 `main` 커밋을 기준으로 배포합니다.

확인:

```powershell
git status -sb
git rev-parse HEAD
git rev-parse origin/main
```

정상:

```text
작업 트리 clean
HEAD == origin/main
```

---

## 2. Render 백엔드 설정

### 서비스

```text
Service Type: Web Service
Runtime: Python
Branch: main
Root Directory: ai-mon/backend
Instance Type: Free
```

### 명령어

```text
Build Command:
pip install -r requirements.txt
```

```text
Start Command:
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Python 버전

권장:

```text
PYTHON_VERSION=3.12.8
```

---

## 3. Render 환경변수

실제 값은 Render 대시보드에만 입력합니다.

| Key | 기준 |
|---|---|
| `SECRET_KEY` | 충분히 긴 랜덤 문자열 |
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_KEY` | 서버 전용 secret/service-role 키 |
| `USE_SUPABASE` | `true` |
| `ANTHROPIC_API_KEY` | 서버 전용 키 |
| `ALLOWED_ORIGINS` | 허용할 프론트 origin 목록 |
| `RUN_SCHEDULER` | 최초 검증 단계 `0` |
| `PYTHON_VERSION` | `3.12.8` 권장 |

Render 입력창에는 따옴표를 넣지 않습니다.

잘못된 예:

```text
"true"
"https://example.supabase.co"
"0"
```

정상:

```text
true
https://example.supabase.co
0
```

---

## 4. `ALLOWED_ORIGINS`

백엔드는 쉼표로 구분된 origin을 읽습니다.

로컬 검증 단계:

```text
http://localhost:3000
```

도메인과 Vercel 배포 후 예시:

```text
http://localhost:3000,https://프론트주소.vercel.app,https://ai-mon.app,https://www.ai-mon.app
```

규칙:

- 쉼표로 구분
- 주소 끝 `/` 제외
- `*` 사용 금지
- 실제 배포 origin만 추가
- 변경 후 Render 재배포 확인

---

## 5. `RUN_SCHEDULER`

### 현재 설정

```text
RUN_SCHEDULER=0
```

첫 배포, RLS 검증, 프론트 미배포 상태에서는 `0`을 유지합니다.

### `1` 전환 조건

다음을 전부 확인한 뒤 단일 실행 프로세스에서만 `1`로 변경합니다.

- 프론트 운영 배포 완료
- 예약 메일 설정 검증
- 일간 백업 작업 검증
- 탈퇴 계정 정리 작업 검증
- 스케줄러 중복 실행 방지 확인
- 실행 인스턴스·워커 수 확인
- 무료 Render sleep 영향 검토

멀티워커 또는 여러 인스턴스에서는 하나의 프로세스만 스케줄러를 실행해야 합니다.

---

## 6. Render 배포 확인

브라우저:

```text
https://aimon1.onrender.com
```

기대:

```json
{"status":"AI MON Backend is running"}
```

버전:

```text
https://aimon1.onrender.com/version
```

확인 항목:

- 서비스 상태 `Live`
- 빌드 성공
- 시작 명령 성공
- 포트 바인딩 성공
- Supabase 연결 오류 없음
- 필수 환경변수 누락 없음

---

## 7. 프론트 로컬 검증

파일:

```text
ai-mon/frontend/.env.local
```

내용:

```env
VITE_API_BASE_URL=https://aimon1.onrender.com
```

따옴표와 마지막 `/`는 넣지 않습니다.

프론트 재시작:

```powershell
cd C:\AIMON1\ai-mon\frontend
npm run dev
```

검증:

```text
로그인
→ 프로필 조회
→ 스테이지 진입
→ 진행도 저장
→ 보상 획득
→ 새로고침
→ 로그아웃·재로그인
```

---

## 8. Supabase 보안 확인

운영 대상:

```text
users
refresh_tokens
reset_tokens
email_verification_codes
progress
wrong_answers
attempts
scheduler_locks
```

완료 기준:

```text
8개 테이블 RLS = true
allow_anon_select 없음
anon/authenticated 테이블 grant = 0 rows
anon/authenticated RPC execute = false
service_role RPC execute = true
```

상세 SQL은:

```text
docs/ops/supabase-schema-apply-checklist.md
```

를 따릅니다.

---

## 9. 서버 키 노출 확인

로컬:

```powershell
git grep -n -I -E "sb_secret_|service_role|SUPABASE_KEY|VITE_SUPABASE|REACT_APP_SUPABASE"
```

비정상:

```text
실제 sb_secret_ 값
실제 service_role JWT
frontend/src 내부 서버 키
VITE_SUPABASE_SERVICE_ROLE_KEY
REACT_APP_SUPABASE_SERVICE_ROLE_KEY
```

실제 키 노출이 의심되면:

1. 새 서버 키 생성
2. Render 환경변수 교체
3. 재배포
4. 기존 키 폐기
5. Git 기록과 로그 노출 범위 점검

---

## 10. 프론트 운영 배포

### 환경변수

```text
VITE_API_BASE_URL=https://aimon1.onrender.com
```

### 배포 후

실제 프론트 URL을 Render의 `ALLOWED_ORIGINS`에 추가합니다.

예시:

```text
https://실제주소.vercel.app
```

커스텀 도메인 연결 후:

```text
https://ai-mon.app
https://www.ai-mon.app
```

사용하는 origin만 등록합니다.

---

## 11. 인증 스모크

- 일반 로그인
- 로그아웃
- 토큰 갱신
- 회원가입 이메일 인증
- 비밀번호 찾기·재설정
- Google 로그인
- Kakao 로그인
- 탈퇴 확인 팝업
- 탈퇴 완료 안내
- 탈퇴 후 재접근 차단

네이버 로그인은 개발자 설정 상태를 별도 확인합니다.

---

## 12. 학습·전투 스모크

- 레슨 진입
- 문제 로드
- 정답 제출
- 오답 저장
- 오답 복습
- 진행도 저장
- 퀴즈 재도전 세트 정책
- 미니보스 재도전 세트 정책
- 유닛보스 서버 세션
- 엔드보스 서버 세션
- 중복 제출 차단
- battle token 검증
- 클리어 전 보상 요청 거부
- 새로고침·재진입 복원

---

## 13. 재화·미션·게임 스모크

- 미션 진행도 적립
- 미션 수령
- 중복 수령 차단
- 코인 보상 증가
- `total_coin_earned` 증가
- 랭킹 대상 보상 반영
- 상점 구매 시 `coin_balance`만 감소
- 구매 테마 지급
- 게임 시작·클리어
- AICross 서버 채점
- 리더보드 조회

---

## 14. 배포 오류 대응

### `requirements.txt` 없음

확인:

```text
Root Directory = ai-mon/backend
Build Command = pip install -r requirements.txt
```

### CORS 오류

확인:

- Render `ALLOWED_ORIGINS`
- 정확한 프로토콜
- 정확한 도메인
- 포트 포함 여부
- 주소 끝 `/` 제거
- 저장 후 재배포 여부

### Supabase 권한 오류

예:

```text
permission denied
new row violates row-level security policy
42501
```

대응:

- RLS를 끄지 않음
- `SUPABASE_KEY`가 서버용인지 확인
- Render 환경변수의 따옴표 제거
- 환경변수 저장 후 재배포
- service_role 권한 확인

### 401 반복

확인:

- `SECRET_KEY`
- access/refresh token
- 프론트 API URL
- 배포 전후 SECRET_KEY 변경 여부
- 기존 로그인 상태 초기화 필요 여부

---

## 15. 무료 Render 주의

Free Web Service는 비활성 시간 후 sleep 상태가 될 수 있습니다.

영향:

- 첫 요청 응답 지연
- 서버 프로세스 내부 스케줄러 중단
- 예약 메일·백업·정리 작업의 정시 실행 불가 가능성

현재 무료 Web Service는 기능 검증과 초기 배포에 사용합니다. 스케줄러의 운영 안정성이 필요해지는 시점에는 유료 상시 인스턴스 또는 외부 Cron 구조를 검토합니다.

---

## 16. 최종 완료 기준

```text
[완료] Render 백엔드 Live
[완료] Backend health/version 응답
[완료] Supabase 서버 키 연결
[완료] RLS·테이블 grant·RPC 차단
[완료] 백엔드 경유 앱 스모크
[완료] DB 재화·랭킹 migration/backfill
[대기] 프론트 운영 배포
[대기] 실제 프론트 origin 등록
[대기] 운영 전체 회귀 테스트
[대기] RUN_SCHEDULER 최종 결정
```
