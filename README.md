# AI-MON

> **AI와 함께 성장하는 게임형 Python 학습 플랫폼**  
> 서비스 기획부터 AI 활용 개발, 검수, 배포까지 연결한 3인 팀 프로젝트입니다.

**Live Service** · [ai-mon.app](https://ai-mon.app/)  
**Repository** · [littlejin7/AIMON1](https://github.com/littlejin7/AIMON1)

---

## Project Overview

AI-MON은 Python 입문자가 **어디서 시작해야 할지 모르거나, 반복 학습에서 쉽게 이탈하는 문제**를 줄이기 위해 만든 게임형 학습 서비스입니다.

단순히 문제를 푸는 구조가 아니라,

**학습 → 도전 → 피드백 → 복습 → 보상 → 성장**

이 하나의 사용자 흐름으로 이어지도록 설계했습니다.

### Core Experience

| 영역 | 사용자 경험 |
| --- | --- |
| **Home** | 서비스 진입, 빠른 체험, 진행 상태 확인 |
| **Lesson** | Stage 기반 Python 학습과 단계별 해금 |
| **Boss** | 학습 결과를 확인하는 미니보스·유닛보스·엔드보스 |
| **Train** | 오답 복습, 유닛 반복, 랜덤 퀴즈 |
| **Game** | 참여형 복습 미니게임과 랭킹 |
| **My AIMON** | 보상과 캐릭터 성장 경험 |

---

## My Role & Scope

**Project Lead · Service Planning · AI-Assisted Development · QA / Release**

3인 팀의 프로젝트 리드로서 기능 하나만 담당하기보다 **서비스 방향과 구현 흐름을 연결하는 역할**을 맡았습니다.

### 직접 주도한 영역

- 서비스 콘셉트 및 핵심 사용자 흐름 정의
- 기능 정책, 우선순위, 예외 조건 및 개발 범위 정리
- 프론트엔드 ↔ 백엔드 ↔ DB 연결 기준 검토
- GPT / Claude / Gemini를 활용한 구현·분석·수정 지원
- 오류 재현, 영향 범위 확인, 테스트 및 회귀 검증
- Git / GitHub 기반 변경 범위 및 통합 관리
- 실제 웹서비스 배포 전 최종 검수

### 협업 방식

팀원의 작업을 단순 배분하기보다 **목표·완료 기준·영향 범위를 먼저 정의**하고, 기능 단위로 결과물을 통합했습니다.

---

## How I Work with AI

AI-MON에서는 AI에게 바로 코드를 생성시키는 방식보다 **분석 → 범위 통제 → 구현 → 검증**의 순서를 지키는 것을 중요하게 봤습니다.

```text
01. 문제 재현 / 요구사항 정의
        ↓
02. 현재 구조와 영향 범위 분석
        ↓
03. 수정 Scope · 예외조건 · 금지사항 정의
        ↓
04. 수정 파일과 접근방식 선보고
        ↓
05. 승인 후 구현
        ↓
06. 테스트 · 회귀 체크
        ↓
07. diff 확인 · Commit · 다음 단계
```

실제 에이전트 작업 지침에도 다음 원칙을 적용했습니다.

- 지정 범위 밖 파일 수정 금지
- 무관한 리팩토링 금지
- 코드 수정 전에 **수정 파일 목록 + 접근 방식 먼저 보고**
- 승인 전 commit 금지
- 구현 후 변경 요약과 테스트 결과 확인
- DB / 운영 데이터 등 위험 작업은 별도 단계로 분리

### Working Documents

- [AI Agent 실행 프롬프트](ai-mon/docs/dev/AI_MON_AGENT_PROMPTS.md)
- [Claude Code 실행 플레이북](ai-mon/docs/dev/CLAUDE_CODE_%EC%8B%A4%ED%96%89_%ED%94%8C%EB%A0%88%EC%9D%B4%EB%B6%81.md)
- [개발 인수인계 문서](ai-mon/docs/dev/handover_notes.md)
- [훈련 검증 & Claude 호출 최소화 인수인계](ai-mon/docs/dev/handover_train_claude_minimize.md)
- [서비스 실행 파이프라인](ai-mon/docs/design/AI_MON_PIPELINE.md)
- [Backend AI 작업 규칙](ai-mon/backend/CLAUDE.md)

---

## Representative Case — 코드 채점 흐름 단절 분석

### Problem

코드 입력 문제에서 **실행과 제출이 같은 흐름으로 동작**하고, 프론트의 stdout 정확 일치 판정과 백엔드 채점 API가 분리되어 있었습니다.

### Root Cause

- `실행하기`와 `확인하기`가 동일 handler를 사용
- 프론트에서 `stdout.trim() === answer.trim()`으로 자체 판정
- 백엔드 `/code/submit` 채점 흐름이 프론트와 연결되지 않음
- 프론트 API 경로와 실제 백엔드 계약이 불일치

### Direction

```text
Run ≠ Submit

실행 → Pyodide 결과 확인
제출 → Backend grading
보상/진행도 → Server result 기준
```

### Guard / Validation

- 채점 실패 시 보상·진행도 변경 금지
- 정답 보상 중복 지급 방지
- 다른 문제 유형의 기존 흐름 회귀 여부 확인
- 수정 후 backend test + frontend build + 실제 사용자 흐름 확인

관련 진단·수정 가이드 커밋:  
[코드 터미널 채점 단절 수정 가이드](https://github.com/littlejin7/AIMON1/commit/ff7581de42da18cac0deaf05c8a7aac628f1f70c)

---

## Validation & Optimization

AI 사용 여부도 기능마다 다르게 판단했습니다. **정답이 명확한 영역까지 LLM에 의존하지 않고**, 결정론적으로 처리 가능한 부분은 서버 또는 정적 데이터로 우선 처리했습니다.

### 검증 기록 예시

- **39 tests passed** — Train / Attempt 관련 백엔드 검증
- 실제 문제 데이터를 사용한 endpoint smoke test **status 200** 확인
- 객관식 계열은 정적 피드백 번들을 우선 사용해 런타임 Claude 호출 최소화
- fill-in-blank 역시 정적 피드백 우선 적용
- 해석이 필요한 일부 code input만 AI 채점/피드백 유지
- 변경 후 `pytest` + `npm run build` + 실제 흐름 회귀 확인

자세한 검증 기록:  
[handover_train_claude_minimize.md](ai-mon/docs/dev/handover_train_claude_minimize.md)

---

## Architecture

```text
React + Vite + PWA
        ↓ HTTPS / JWT
FastAPI
 ├─ Auth / OAuth
 ├─ Lesson / Quiz / Train
 ├─ Boss / Battle Session
 ├─ Reward / Mission / Ranking
 ├─ Server-side Grading
 └─ AI Feedback
        ↓
Supabase PostgreSQL

External / Supporting
- Anthropic Claude
- Pyodide
- Resend / SendGrid
- JSON / Markdown content data
```

현재 구현 기준의 상세 흐름은 [AI_MON_PIPELINE.md](ai-mon/docs/design/AI_MON_PIPELINE.md)에 정리되어 있습니다.

---

## Tech Stack

### Product

`React` · `Vite` · `PWA` · `FastAPI` · `Supabase` · `PostgreSQL` · `Pyodide` · `Anthropic Claude`

### AI-Assisted Development

`GPT` · `Claude` · `Gemini` · `Prompt Engineering` · `Vibe Coding`

### Collaboration / QA

`Git` · `GitHub` · `Pytest` · `Regression Check` · `Smoke Test`

---

## Project Evidence

| Evidence | What it shows |
| --- | --- |
| [AI_MON_AGENT_PROMPTS.md](ai-mon/docs/dev/AI_MON_AGENT_PROMPTS.md) | AI/개발 작업 지시 방식과 Scope 통제 |
| [CLAUDE_CODE 실행 플레이북](ai-mon/docs/dev/CLAUDE_CODE_%EC%8B%A4%ED%96%89_%ED%94%8C%EB%A0%88%EC%9D%B4%EB%B6%81.md) | 단계별 분석·승인·구현·회귀·커밋 프로세스 |
| [handover_notes.md](ai-mon/docs/dev/handover_notes.md) | 완료 범위, 남은 작업, 테스트 기준을 포함한 인수인계 |
| [handover_train_claude_minimize.md](ai-mon/docs/dev/handover_train_claude_minimize.md) | 실제 테스트 결과와 AI 호출 비용 최적화 판단 |
| [AI_MON_PIPELINE.md](ai-mon/docs/design/AI_MON_PIPELINE.md) | 현재 코드 기준의 서비스·API·데이터 흐름 |
| [backend/CLAUDE.md](ai-mon/backend/CLAUDE.md) | 동시성·중복 보상·외부 API 등 Backend 가드레일 |

---

## What I Learned

AI-MON을 만들며 가장 크게 배운 것은 **AI를 많이 사용하는 것보다, 어떤 문제에 어디까지 사용하고 어떻게 검증할지를 결정하는 능력이 중요하다**는 점입니다.

기획을 문서에서 끝내지 않고 실제 사용자 흐름, API, 데이터, 테스트, 배포까지 연결하며 **아이디어를 작동하는 서비스로 만드는 과정**을 경험했습니다.

---

## Links

- **Live**: https://ai-mon.app/
- **GitHub**: https://github.com/littlejin7/AIMON1
