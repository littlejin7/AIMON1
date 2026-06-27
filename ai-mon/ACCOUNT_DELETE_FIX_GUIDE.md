# 계정삭제 기능 수정 가이드 (Claude Code용)

## 문제 진단
계정삭제가 프론트·백엔드 양쪽 다 미구현 상태.

1. **프론트** `frontend/src/pages/Settings/Settings.jsx:273`
   - 버튼이 `onClick={() => window.confirm('정말 계정을 삭제할까요?')}` 뿐.
   - confirm 결과를 안 씀 → 확인 눌러도 API 호출·로그아웃·이동 전부 없음. 빈 버튼.
2. **백엔드**
   - 회원 삭제 라우트 없음. `backend/routers/user.py`에 delete 없음.
   - `userApi`(frontend/src/api/index.js)에도 삭제 함수 없음.
   - 기존엔 `delete_user_refresh_tokens`(토큰 정리)만 존재.
   - user_id를 참조하는 테이블이 여러 개인데 명시적 ON DELETE CASCADE 미확인 → 연관 데이터 정리 필요.

## ✅ 방식 확정: 소프트 삭제
- users 레코드에 `deleted_at`(타임스탬프) 세팅 + 로그인/토큰 갱신 시 비활성 계정 차단.
- 연관 테이블 행은 건드리지 않음(플래그만). 복구·감사 용이, 구현 안전.
- refresh 토큰은 즉시 전부 무효화해서 기존 세션 차단.

## 권장 모델
- 소프트 삭제는 파괴적 작업이 아니라 전부 **claude-sonnet-4-6 (Sonnet)** 로 충분.
  (Opus는 하드 삭제 시 필요했던 것. 이제 불필요.)

---

## 프롬프트 1 — 백엔드 삭제 엔드포인트 (먼저) · 소프트 삭제

```
backend 에 소프트 삭제 방식의 계정삭제 엔드포인트를 추가해줘.

요구사항:
- users 테이블에 deleted_at(nullable timestamp) 컬럼이 없으면 추가하는 마이그레이션도 포함.
- routers/user.py 에 DELETE /user/me 추가, get_current_user 로 인증.
- 호출 시 해당 유저의 deleted_at 을 현재 시각으로 세팅(소프트 삭제). 연관 테이블 행은 건드리지 마.
- delete_user_refresh_tokens 로 그 유저의 refresh 토큰을 전부 무효화해 기존 세션 차단.
- 로그인 및 토큰 갱신 흐름에 가드 추가: deleted_at 이 설정된 계정은 인증 거부(적절한 401/403).
- 이미 삭제된 계정을 다시 DELETE 하면 안전하게 처리(중복 호출 무해).
- 성공 시 204 또는 {success:true} 반환.

진행 전에 users 테이블 현재 스키마와 deleted_at 추가 위치를 먼저 보여주고,
get_current_user 가 deleted_at 계정을 어떻게 거를지 방안을 설명해줘.
```

## 프롬프트 1-B — 재가입 허용 처리 (백엔드) · Sonnet

```
소프트 삭제된 계정의 이메일/아이디로 재가입을 "허용"하도록 처리해줘.
현재 deleted_at 으로 죽은 행이 남아있어서 재가입 시 충돌할 수 있다.

확인 및 수정:
1. 먼저 users 테이블의 email/username 에 UNIQUE 제약(또는 인덱스)이 있는지 확인해서 보여줘.
2. check-id(아이디 중복확인)와 이메일 중복확인 로직이 deleted_at 이 있는 행은
   "사용 가능"으로 보도록 수정 (죽은 행은 무시).
3. UNIQUE 제약이 있으면 새 가입 INSERT 가 막히므로 둘 중 하나로 처리하고 어느 쪽인지 설명해줘:
   (a) 부분 유니크 인덱스로 전환 — UNIQUE ... WHERE deleted_at IS NULL (마이그레이션 SQL 포함)
   (b) 재가입 시 기존 죽은 행을 되살리지 않고 새 user_id 로 깨끗하게 생성
   → 학습기록 등 과거 데이터는 끌고 오지 않고 완전히 새 계정으로 시작하는 방향 권장.
4. 마이그레이션이 필요하면 Supabase에서 실행할 SQL을 따로 명시해줘.

진행 전에 1번(현재 제약 상태)을 먼저 보여주고 방향 확인받아.
```

## 프롬프트 2 — 프론트 연결

```
계정삭제 버튼을 실제 동작하게 연결해줘.

- frontend/src/api/index.js 의 userApi 에 deleteMe: () => api.delete('/user/me') 추가.
- frontend/src/pages/Settings/Settings.jsx 의 계정 삭제 버튼:
  - window.confirm 결과가 true 일 때만 진행 (지금은 결과를 버림).
  - userApi.deleteMe() 호출 → 성공 시 useAuthStore 의 logout() 으로 토큰/상태 비우고 로그인/홈으로 이동.
  - 호출 중 버튼 비활성화(중복 클릭 방지), 실패 시 에러 알림.
- 로그아웃 버튼(handleLogout)의 기존 동작 흐름을 참고해서 일관성 있게 처리.
```

## 프롬프트 3 — 검증

```
계정삭제 플로우를 검증해줘.
- 백엔드: DELETE /user/me 에 대한 테스트 추가 — 인증 없음(401), 정상 삭제, 삭제 후 같은 토큰 재사용 거부.
- 소프트 삭제면 비활성 계정 로그인 차단까지 테스트.
- 프론트: confirm 취소 시 아무 일도 안 일어나는지, 확인 시 logout+이동 되는지 흐름 점검.
- 가능한 테스트를 실제 실행해서 결과를 보여줘.
```
