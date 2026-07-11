---
title: AI-MON 문서 인덱스
version: "1.0"
status: current
source_of_truth: GitHub main branch
last_verified_commit: 6683cb7b4a9592aedceb1a6ee8a884d63661b8ef
last_verified_at: 2026-07-11
---

# AI-MON 문서 인덱스

> 현재 서비스, 구현, 데이터, 운영 절차의 기준 문서를 구분합니다.

## 1. 문서 우선순위

문서와 구현이 충돌하면 다음 순서를 적용합니다.

```text
1. GitHub main 브랜치의 실행 코드·JSON·SQL
2. docs/design의 current 문서
3. docs/ops의 current 체크리스트
4. docs/dev의 작업 기록·핸드오버
5. historical 문서
```

## 2. 현재 기준 문서

| 문서 | 역할 | 대상 |
|---|---|---|
| `design/AI_MON_PROPOSAL.md` | 서비스 정의, 사용자 가치, 기능 범위, 현재 상태 | 기획안·발표 |
| `design/AI_MON_PIPELINE.md` | 화면·API·채점·저장·보상 실행 흐름 | 기획·개발 |
| `design/AI_MON_SCHEMA.md` | 정적 JSON, DB, JSONB, API 데이터 구조 | 개발·데이터 |
| `design/AI_MON_MISSIONS.md` | 데일리·위클리 미션과 수령 정책 | 기획·개발 |
| `design/ENDBOSS_DESIGN.md` | 엔드보스 전투·승급·보상 상세 | 기획·개발 |
| `ops/DEPLOY_CHECKLIST.md` | Render·프론트·환경변수·스모크 | 배포 |
| `ops/supabase-schema-apply-checklist.md` | Supabase 변경·보안·검증 | DB 운영 |

## 3. 역사 문서

| 문서 | 상태 |
|---|---|
| `ops/SUPABASE_MIGRATION_PLAN.md` | 초기 JSON→Supabase 이관 완료 기록 |

역사 문서는 의사결정 이력을 보존하지만 현재 운영 명령의 기준으로 사용하지 않습니다.

## 4. 개발 작업 문서

`docs/dev/*`에는 다음이 포함됩니다.

- Codex·Claude Code 실행 프롬프트
- 단계별 리팩터링 플레이북
- 기능별 핸드오버
- 임시 검수 보고서
- 과거 구현 계획

이 파일은 “어떻게 작업했는지”를 보존합니다.
현재 제품 기획안의 기능 상태를 판단할 때는 `docs/design/*`을 먼저 봅니다.

## 5. 문서 상태 표기

| 상태 | 의미 |
|---|---|
| `current` | 현재 main 구현을 설명하는 기준 문서 |
| `historical` | 완료된 과거 계획과 결정 기록 |
| `draft` | 검토 중이며 아직 기준으로 승인되지 않음 |
| `deprecated` | 대체 문서가 있어 신규 참조 금지 |

## 6. 문서 갱신 규칙

핵심 사용자 흐름 또는 데이터 계약이 변경되면 같은 작업에서 관련 문서를 갱신합니다.

필수 갱신 대상 예:

| 변경 | 함께 확인할 문서 |
|---|---|
| 회원가입·OAuth·게스트 체험 | PROPOSAL, PIPELINE, DEPLOY |
| 퀴즈·미니보스 통과 기준 | PROPOSAL, PIPELINE |
| DB 컬럼·JSONB·API 응답 | SCHEMA, Supabase 체크리스트 |
| 미션 이벤트·보상 | MISSIONS, PIPELINE |
| 엔드보스 상수·승급 | ENDBOSS_DESIGN, PROPOSAL |
| PWA·배포 환경변수 | PIPELINE, DEPLOY |

## 7. 버전 기록

문서 머리말에는 다음을 유지합니다.

```yaml
version: "x.y"
status: current
source_of_truth: GitHub main branch code and data
last_verified_commit: <40자리 commit SHA>
last_verified_at: YYYY-MM-DD
```

운영 대시보드 값처럼 Git으로 확인할 수 없는 항목은 “운영 확인 필요”로 표기하고 체크 결과를 별도 기록합니다.
