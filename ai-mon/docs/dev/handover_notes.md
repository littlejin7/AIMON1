# AI-Mon 개편 — 개발 인수인계서 (Handover Notes)

본 문서는 `feat/gp-coin-reward-system` 브랜치에서 진행 중인 XP 폐기 및 coin/GP/ranking_score 분리 작업의 백엔드 완료 상태와 향후 프론트엔드 연동 및 검증 단계를 인수인계하기 위해 작성되었습니다.

---

## 1. 현재 진행 상황 요약

- **작업 브랜치**: `feat/gp-coin-reward-system` (원격 저장소에 push 완료)
- **완료된 내용**: 백엔드 보상 로직 분리(2단계)의 **D파트(누적 리더보드 엔드포인트)**와 **E파트(출석/스트릭 코인 지급 로직)** 구현 및 검증 완료.

---

## 2. 세부 구현 사항 및 완료 내역

### 2-D 파트: 누적 `ranking_score` 리더보드 엔드포인트 신설
- **엔드포인트**: `GET /game/ranking/overall?limit=3`
- **로직**: 유저의 누적 `ranking_score`(소비되지 않는 랭킹 포인트)를 내림차순 정렬하여 리더보드를 반환합니다. 0점인 유저는 목록에서 제외하며, 기존의 캐시 정책(30초 TTL)을 공유합니다.
- **검증**: `test_reward_split.py`에 누적 랭킹 테스트 추가 및 정상 통과 완료.

### 2-E 파트: 출석 및 스트릭 마일스톤 코인 실지급 완료
- **일일 출석**: `DAILY_ATTENDANCE_COIN = 1000` (임시 밸런스)을 정의하여, 하루의 첫 로그인(`last_login != today`) 시 `grant_reward` 유틸을 이용해 유저의 `coin_balance`를 실제 차트 증가시킵니다.
- **스트릭 마일스톤**: 기존의 XP 보상 지급을 **전면 중단**하고 코인 지급으로 통일하였습니다:
  - 3일 스트릭: 500 Coins
  - 7일 스트릭: 2000 Coins + 1 Crown (크라운 유지)
  - 14일 스트릭: 5000 Coins + 2 Crowns (크라운 유지)
  - 30일 스트릭: 10000 Coins + 5 Crowns (크라운 유지)
- **GP 및 랭킹 영향 없음**: 출석 보상에 대해서는 `gp_delta=0`, `ranking_score_delta=0` 처리하여 리더보드에 영향을 주지 않도록 구현했습니다.
- **API 응답 구조 통일**: 플레이북 사양에 맞춰 로그인 및 `/touch` API에서 누적 보상을 반영한 `reward`와 `user_state` 필드를 반환합니다.
- **테스트**: `test_attendance_rewards.py`를 신설하여 신규 가입 유저 로그인, 중복 로그인 방지, 마일스톤 도달 보상 등 6개 시나리오 테스트 작성 및 100% 통과 완료.

---

## 3. 남은 로드맵 & 다음 작업 내용 (인수인계 대상)

다음 개발자가 이어서 작업해야 할 내용입니다.

### 🎯 1. [작은 4-E] 로그인 스트릭 알림 프론트 표시 교체
- **현재 상황**: 백엔드에서는 스트릭 마일스톤 보상으로 XP를 지급하지 않고 코인을 주도록 변경했습니다. 프론트엔드가 하이라이트/토스트에 기존의 `streak_reward.xp` 값을 출력하지 않도록 백엔드에서 임시로 `xp: 0`을 함께 내려주고 있으나, 토스트 메시지 자체의 수정이 필요합니다.
- **대상 파일**:
  - `frontend/src/pages/Auth/KakaoCallback.jsx`
  - `frontend/src/pages/Auth/NaverCallback.jsx`
  - `frontend/src/pages/Auth/SocialCallback.jsx`
  - `frontend/src/pages/Auth/Auth.jsx`
- **작업 내용**: 
  - `alert(...)` 창에 출력되는 "⭐ +{streak_reward.xp} XP" 부분을 **"🪙 +{streak_reward.coin} 코인"**으로 문구 및 데이터 바인딩을 교체합니다.

### 🎯 2. [4-D] 리더보드 UI 확장 (RankingPage 주간 + 누적)
- **대상 파일**: `frontend/src/pages/Game/RankingPage.jsx` 및 관련 컴포넌트
- **작업 내용**:
  - 기존 주간 리더보드와 신규 리더보드(`GET /game/ranking/overall`)를 모두 호출할 수 있도록 UI 탭 전환(주간 vs 누적/전체)을 설계합니다.
  - 새로 연동한 누적 리더보드 데이터가 화면에 올바르게 그려지는지 확인합니다.

### 🎯 3. [5단계] 전체 회귀 테스트 실행
- **작업 내용**:
  - 백엔드 테스트 실행: `.venv\Scripts\python.exe -m pytest` (기존 baseline 실패 5건 외에 추가 실패가 없는지 최종 대조)
  - 프론트엔드 빌드 실행: `npm run build`를 구동하여 컴파일 및 린트 오류가 없는지 검증합니다.

### 🎯 4. [6단계] 최종 검수 및 PR
- `git status --short` 및 `git diff`를 통해 작업 범위 밖의 무관한 파일이 수정되지 않았는지 체크합니다.
- 이상이 없다면 `feat/gp-coin-reward-system` 브랜치에서 `main` 브랜치로 Pull Request를 생성하고 머지합니다.
