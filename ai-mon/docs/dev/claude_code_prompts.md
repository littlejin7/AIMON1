# AI-mon 백엔드 개선 — Claude Code 실행 프롬프트 (1주 스프린트)

> 모델 가이드:
> - **설계/스키마 결정 단계 (STEP 1, 2): Claude Opus 4.8** — 구조 결정이라 비싸도 정확하게.
> - **구현/반복 작업 (STEP 3~6): Claude Sonnet 4.6** — 빠르고 저렴, 코드 대량 생산용.
> - 한 번에 다 시키지 말고 STEP 하나씩, 끝나면 다음으로.

---

## STEP 0 — 컨텍스트 파악 (먼저 1번만)
```
이 레포는 AI-mon이라는 PWA 코딩 학습 앱의 백엔드야.
레슨 콘텐츠는 backend/data/lessons/ 아래 unit_*.json 으로 관리되고,
DB는 Supabase, 프론트는 PWA야.
먼저 다음을 분석하고 보고만 해. 코드는 아직 고치지 마:
1. 레슨 JSON이 코드에서 어떻게 로딩/검증되는지 (로더 위치, 검증 유무)
2. Supabase 스키마/마이그레이션 현황과 레슨 콘텐츠가 DB에 어떻게 들어가는지
3. 현재 가장 자주 터지는 에러 지점 추정 Top 5
출력: 파일 경로 포함한 현황 요약 + 리스크 순위표.
```

## STEP 1 — 데이터 응급 복구 (Opus, 최우선)
```
backend/data/lessons/ 아래 모든 unit_*.json을 검사해줘:
1. 각 파일 JSON 파싱 유효성 검사. 깨진 파일(특히 unit_2.json: 닫는 ] 뒤에
   공백+extra data가 붙어 "Extra data" 에러남)을 찾아서 복구해.
   - 중복으로 append된 배열이 있으면 올바른 하나만 남기고 제거.
2. 복구 전 원본은 *.json.bak 으로 백업.
3. 복구 후 전부 다시 파싱되는지 검증 결과를 표로 보여줘.
절대 콘텐츠 내용(텍스트)은 바꾸지 말고 구조 손상만 고쳐.
```

## STEP 2 — 스키마 정의 + 검증 스크립트 (Opus)
```
unit_*.json들의 실제 구조를 바탕으로 레슨 데이터 스키마를 정의해줘.
관찰된 구조: 최상위는 lesson 객체 배열. 각 lesson은
[lesson_id, unit, stage, course_level, title, villain, slides].
각 slide는 [order, text, terminal, tip] (현재 type 필드 없음).
요구사항:
1. JSON Schema(또는 Pydantic 모델) 작성. slide에 type 필드를 표준화해 추가.
2. backend/scripts/validate_lessons.py 작성:
   - 모든 unit_*.json을 스키마로 검증
   - 필드 누락/타입 불일치/중복 lesson_id/slide order 누락을 리포트
   - 실패 시 exit code 1 (CI/커밋 훅에서 막을 수 있게)
3. 지금 데이터 전체 돌린 검증 리포트 출력.
```

## STEP 3 — 콘텐츠 로딩 단일화 + 안전화 (Sonnet)
```
레슨 콘텐츠 로딩 로직을 단일 로더 모듈로 통합해줘:
1. load_lesson(unit) / load_all_lessons() 함수 한 곳에서만 파일 읽기.
2. STEP 2의 스키마로 로드 시점에 검증. 깨진 파일은 그 파일만 건너뛰고
   에러 로깅 후 나머지는 정상 서빙 (앱 전체가 죽지 않게).
3. 기존에 흩어진 직접 파일 읽기 코드를 이 로더 호출로 교체.
```

## STEP 4 — 콘텐츠 / 유저 데이터 분리 (Sonnet, Supabase 안정화 핵심)
```
DB가 자주 깨지는 원인이 레슨 콘텐츠와 유저 데이터를 한 스키마에서
같이 마이그레이션하기 때문이야. 다음으로 재구성해줘:
1. Supabase는 auth + user_progress(유저 진도/완료기록) 최소 테이블만 유지.
2. 레슨 콘텐츠는 관계형으로 쪼개지 말고:
   - lessons 테이블에 jsonb 컬럼 1개로 통째 저장하거나
   - 정적 JSON을 Storage/CDN으로 서빙
   둘 중 이 레포 구조에 더 맞는 쪽을 추천하고 그걸로 구현.
3. 이번 스프린트 동안 스키마 마이그레이션은 user_progress 외엔 동결.
   변경 필요하면 코드 말고 제안만.
```

## STEP 5 — API 출력 검증 + 에러 핸들링 (Sonnet)
```
콘텐츠를 프론트로 내보내는 API에 검증 한 겹 추가:
1. 응답 직전 Pydantic/스키마로 검증, 실패하면 깨진 데이터 대신
   명확한 에러 응답(+로그) 반환. 깨진 JSON이 프론트로 새어나가지 않게.
2. 백엔드 에러 핸들링/로깅 표준화: 어느 unit/lesson에서 터졌는지
   로그에 항상 남게.
```

## STEP 6 — PWA 안정화 (Sonnet, 프론트)
```
1. 프론트에서 콘텐츠 로딩 실패 시 흰 화면 대신 fallback UI 표시.
2. Service Worker로 레슨 JSON 오프라인 캐싱 (PWA).
UI 디자인 개선(Higgsfield 등)은 이번 스프린트 범위 밖. 손대지 마.
```

---

## 이번 주 하지 말 것
- Supabase 스키마 대규모 마이그레이션 (user_progress 외)
- Replit 등 인프라 이사
- UI 전면 개편 / 새 도구 도입
- 레슨 콘텐츠 테이블 정규화(쪼개기)
