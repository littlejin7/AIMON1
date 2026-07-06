---
title: AI MON — 고급(Advanced) 엔드보스 기획서
created: 2026-06-19
---

# 고급 엔드보스 기획서

## 0. 현황 파악

| 레벨 | 데이터 파일 | 상태 | 프로젝트 |
|---|---|---|---|
| beginner | `backend/data/endboss/beginner.json` | ✅ 완료 (48문제) | account, wordchain, grade, gpa |
| intermediate | `backend/data/endboss/intermediate.json` | ✅ 완료 (48문제) | todo, contact, log_parser, weather |
| advanced | `backend/data/endboss/advanced.json` | ❌ 미제작 | — |

프론트엔드 `EndBossIntro.jsx`의 `ENDBOSS_PROJECTS` 배열이 현재 beginner 프로젝트로 **하드코딩** → 레벨별 분기 처리 필요.

---

## 1. 고급 엔드보스 컨셉

고급 커리큘럼(Unit 1~8)이 다루는 주제:
- Unit 1~2: 데코레이터 / 제너레이터 / asyncio 비동기
- Unit 3~4: Claude API / Streamlit 챗봇
- Unit 5~6: LangChain / AI 에이전트 Tool Use
- Unit 7~8: FastAPI + React 풀스택 / 멀티 에이전트 파이프라인

엔드보스는 **이 모든 범위를 통합한 실전 수준 코드**를 문제로 낸다.
초급(파이썬 기초 앱) → 중급(라이브러리 활용 앱) → **고급(AI 에이전트 / 백엔드 서버)**로 점점 실무에 가까워지는 구조.

---

## 2. 프로젝트 4종 선정

| 프로젝트 ID | 한국어 명칭 | 대표 Unit | 핵심 개념 |
|---|---|---|---|
| `ai_agent` | AI 에이전트 | Unit 6 + Unit 3 | Tool Use, 에이전트 루프, Claude API |
| `async_api` | 비동기 API 클라이언트 | Unit 2 + Unit 3 | asyncio, aiohttp, 비동기 Claude API 호출 |
| `fastapi_server` | FastAPI AI 서버 | Unit 7 + Unit 4 | FastAPI 엔드포인트, Claude 스트리밍, DB 연동 |
| `langchain_bot` | LangChain RAG 봇 | Unit 5 + Unit 8 | LangChain 체인, 메모리, RAG 파이프라인 |

각 프로젝트가 고급 커리큘럼의 4개 핵심 축을 하나씩 대표한다.

---

## 3. 문제 유형 계획

기획서(ENDBOSS_DESIGN.md) 기준 advanced 레벨 유형:

| 페이즈 | 유형 | 채점 방식 | 비고 |
|---|---|---|---|
| Phase 1 (5문제) | `fill_in_blank` / `error_find` | 직접 채점 (문자열 비교) | 코드 읽기 + 오류 찾기 |
| Phase 2 (4문제) | `code_input` | Claude API 채점 | 함수/클래스 구현 |
| Phase 3 (3문제 풀) | `code_input` (설계 수준) | Claude API 채점 | 에이전트 루프 등 복잡한 구현 |

beginner는 Phase 1~2가 모두 직접 채점이었지만, advanced는 **Phase 2~3가 Claude API 채점**. 채점 요청 수가 늘어남에 유의.

---

## 4. 프로젝트별 문제 구성 계획

### 4-1. `ai_agent` — AI 에이전트

**프로젝트 설명:** Tool Use를 사용하는 Claude 기반 에이전트. 도구 정의 → 에이전트 루프 → 결과 처리 흐름.

| Phase | 번호 | 유형 | 출제 포인트 |
|---|---|---|---|
| 1 | p1_001 | `fill_in_blank` | `tools` 파라미터에 딕셔너리 리스트를 전달하는 코드의 빈칸 |
| 1 | p1_002 | `fill_in_blank` | `stop_reason` 값 확인 조건문 빈칸 (`"tool_use"` 체크) |
| 1 | p1_003 | `error_find` | 에이전트 루프에서 `tool_use_block`을 잘못 참조하는 버그 찾기 |
| 1 | p1_004 | `fill_in_blank` | `tool_result` 메시지를 `messages`에 append하는 코드 빈칸 |
| 1 | p1_005 | `error_find` | `input_schema`의 `required` 필드 누락 버그 찾기 |
| 2 | p2_001 | `code_input` | `calculate` 도구 함수 구현 (덧셈/뺄셈/곱셈 분기) |
| 2 | p2_002 | `code_input` | while 루프 기반 에이전트 실행 함수 구현 |
| 2 | p2_003 | `code_input` | tool_result 응답 메시지 포맷팅 함수 구현 |
| 2 | p2_004 | `code_input` | 최대 반복 횟수 제한 + try/except 안전장치 추가 |
| 3 | p3_001 | `code_input` | 멀티 도구(검색 + 계산)를 가진 에이전트 전체 구현 |
| 3 | p3_002 | `code_input` | 에이전트가 도구 없이 직접 답변하는 케이스 처리 포함 전체 구현 |
| 3 | p3_003 | `code_input` | 에이전트 루프 + 결과 파싱 + 최종 텍스트 추출까지 완성 |

---

### 4-2. `async_api` — 비동기 API 클라이언트

**프로젝트 설명:** asyncio + aiohttp로 여러 API를 병렬 호출하고 결과를 취합하는 클라이언트.

| Phase | 번호 | 유형 | 출제 포인트 |
|---|---|---|---|
| 1 | p1_001 | `fill_in_blank` | `async def` 함수 선언 + `await` 키워드 빈칸 |
| 1 | p1_002 | `fill_in_blank` | `asyncio.gather()` 호출 빈칸 (여러 코루틴 병렬 실행) |
| 1 | p1_003 | `error_find` | `await` 없이 코루틴을 직접 호출한 버그 |
| 1 | p1_004 | `fill_in_blank` | `async with aiohttp.ClientSession() as session:` 빈칸 |
| 1 | p1_005 | `error_find` | 동기 `time.sleep()` 대신 `asyncio.sleep()` 써야 하는 버그 |
| 2 | p2_001 | `code_input` | `async def fetch_url(session, url)` 구현 |
| 2 | p2_002 | `code_input` | 여러 URL을 병렬로 가져오는 `fetch_all(urls)` 구현 |
| 2 | p2_003 | `code_input` | 응답 JSON을 파싱하고 특정 필드를 추출하는 비동기 함수 구현 |
| 2 | p2_004 | `code_input` | 실패한 요청을 재시도하는 `fetch_with_retry()` 구현 |
| 3 | p3_001 | `code_input` | 비동기 Claude API 호출 + 응답 스트리밍 처리 전체 구현 |
| 3 | p3_002 | `code_input` | 여러 프롬프트를 병렬로 Claude에 보내고 결과 집계하는 구현 |
| 3 | p3_003 | `code_input` | 세마포어로 동시 요청 수 제한하는 비동기 클라이언트 구현 |

---

### 4-3. `fastapi_server` — FastAPI AI 서버

**프로젝트 설명:** Claude API를 연동한 FastAPI 서버. 채팅 엔드포인트 + SQLite 저장 + 스트리밍 응답.

| Phase | 번호 | 유형 | 출제 포인트 |
|---|---|---|---|
| 1 | p1_001 | `fill_in_blank` | `@app.post("/chat")` 데코레이터 + `async def` 빈칸 |
| 1 | p1_002 | `fill_in_blank` | Pydantic `BaseModel` 정의에서 타입 힌트 빈칸 |
| 1 | p1_003 | `error_find` | CORS 미들웨어 설정에서 `allow_origins=[]` 빈 리스트 버그 |
| 1 | p1_004 | `fill_in_blank` | `StreamingResponse` 반환 + `media_type` 빈칸 |
| 1 | p1_005 | `error_find` | SQLAlchemy 세션을 `with` 없이 사용해 커밋 누락되는 버그 |
| 2 | p2_001 | `code_input` | `/chat` 엔드포인트 구현 (Claude API 호출 + JSON 반환) |
| 2 | p2_002 | `code_input` | 대화 이력을 SQLite에 저장하는 `save_message()` 함수 구현 |
| 2 | p2_003 | `code_input` | SSE 스트리밍 응답을 반환하는 제너레이터 함수 구현 |
| 2 | p2_004 | `code_input` | 사용자별 대화 이력을 불러오는 GET 엔드포인트 구현 |
| 3 | p3_001 | `code_input` | 시스템 프롬프트 + 멀티턴 메시지를 처리하는 챗봇 API 전체 구현 |
| 3 | p3_002 | `code_input` | JWT 인증 미들웨어 + 보호된 /chat 엔드포인트 구현 |
| 3 | p3_003 | `code_input` | 파일 업로드를 받아 Claude로 분석하는 엔드포인트 구현 |

---

### 4-4. `langchain_bot` — LangChain RAG 봇

**프로젝트 설명:** LangChain으로 구성한 RAG(검색 증강 생성) 파이프라인. 문서 로드 → 임베딩 → 검색 → 답변.

| Phase | 번호 | 유형 | 출제 포인트 |
|---|---|---|---|
| 1 | p1_001 | `fill_in_blank` | `ChatPromptTemplate.from_messages()` 호출 빈칸 |
| 1 | p1_002 | `fill_in_blank` | `chain = prompt \| llm \| output_parser` 파이프 연결 빈칸 |
| 1 | p1_003 | `error_find` | `ConversationBufferMemory`의 `return_messages=False`여야 할 것을 `True`로 쓴 버그 |
| 1 | p1_004 | `fill_in_blank` | `vectorstore.as_retriever(search_kwargs={"k": ___})` 빈칸 |
| 1 | p1_005 | `error_find` | `FAISS.from_documents()` 대신 잘못된 메서드명 버그 |
| 2 | p2_001 | `code_input` | 문서를 청크로 분할하는 `split_documents()` 함수 구현 |
| 2 | p2_002 | `code_input` | 벡터스토어에서 관련 문서를 검색하는 `retrieve()` 함수 구현 |
| 2 | p2_003 | `code_input` | 대화 이력을 유지하는 `ConversationChain` 구성 구현 |
| 2 | p2_004 | `code_input` | RAG 체인 전체 파이프라인 구성 함수 구현 |
| 3 | p3_001 | `code_input` | 문서 로드 → 분할 → 임베딩 → 검색 → 답변 RAG 전체 구현 |
| 3 | p3_002 | `code_input` | 메모리 + RAG를 결합한 멀티턴 챗봇 전체 구현 |
| 3 | p3_003 | `code_input` | 여러 문서 소스를 합쳐 검색하는 앙상블 리트리버 구현 |

---

## 5. 문제 ID 네이밍 규칙

```
endboss_adv_{project}_{phase}_{순번}

예시:
endboss_adv_ai_agent_p1_001
endboss_adv_async_api_p2_003
endboss_adv_fastapi_server_p3_001
endboss_adv_langchain_bot_p1_005
```

---

## 6. Phase 3 Claude API 채점 프롬프트 기준

advanced Phase 3는 "설계 수준" code_input이라 채점 기준이 엄격해야 한다. 채점 프롬프트에 명시할 기준:

1. **기능 정확성** — 요구 사항을 모두 충족하는가 (가중치 50%)
2. **코드 구조** — 비동기/에이전트 루프/체인 구조를 올바르게 사용했는가 (가중치 30%)
3. **예외 처리** — try/except, 반복 제한, 엣지케이스 처리 여부 (가중치 20%)

기존 `endboss.py`의 채점 프롬프트에 고급 레벨 전용 기준 추가 필요.

---

## 7. 프론트엔드 수정 사항

### EndBossIntro.jsx

현재 `ENDBOSS_PROJECTS` 배열이 beginner 프로젝트로 하드코딩. `bossData.course_level`을 받아 레벨별 분기 처리:

```js
const PROJECTS_BY_LEVEL = {
  beginner: [
    { id: 'account',   label: '가계부 시스템', icon: '💰' },
    { id: 'wordchain', label: '끝말잇기 봇',   icon: '🗣️' },
    { id: 'grade',     label: '성적 관리기',   icon: '📊' },
    { id: 'gpa',       label: '학점 계산기',   icon: '🎓' },
  ],
  intermediate: [
    { id: 'todo',        label: 'TODO 매니저',    icon: '✅' },
    { id: 'contact',     label: '연락처 앱',       icon: '📇' },
    { id: 'log_parser',  label: '로그 파서',       icon: '🔍' },
    { id: 'weather',     label: '날씨 API 클라이언트', icon: '☁️' },
  ],
  advanced: [
    { id: 'ai_agent',        label: 'AI 에이전트',    icon: '🤖' },
    { id: 'async_api',       label: '비동기 API 클라이언트', icon: '⚡' },
    { id: 'fastapi_server',  label: 'FastAPI AI 서버', icon: '🚀' },
    { id: 'langchain_bot',   label: 'LangChain RAG 봇', icon: '🔗' },
  ],
}

// 사용
const ENDBOSS_PROJECTS = PROJECTS_BY_LEVEL[bossData?.course_level || 'beginner']
```

---

## 8. 백엔드 수정 사항

현재 `endboss.py`는 advanced 레벨을 이미 지원하는 구조 (course_level 기반 라우팅). 추가 수정 불필요. 단 채점 프롬프트 고도화 권장:

```python
# endboss.py answer 엔드포인트 내 Claude 채점 프롬프트
if needs_claude:
    difficulty_note = "설계 수준의 고난도 문제입니다. 기능 정확성(50%), 코드 구조(30%), 예외 처리(20%)를 기준으로 채점하세요." if level == "advanced" else ""
    prompt = f"""
당신은 파이썬을 가르치는 AI 튜터 '에이몬'입니다. 다음 문제에 대한 사용자 코드를 채점해주세요.
{difficulty_note}
JSON 외 텍스트는 출력하지 마세요.
...
"""
```

---

## 9. 작업 순서 (권장)

1. `advanced.json` 문제 데이터 제작 (총 48문제)
   - 프로젝트 4개 × (Phase 1 5문제 + Phase 2 4문제 + Phase 3 3문제)
   - 우선순위: `ai_agent` → `fastapi_server` → `async_api` → `langchain_bot`
2. `EndBossIntro.jsx` 레벨별 프로젝트 분기 처리
3. `endboss.py` advanced 채점 프롬프트 강화 (선택)
4. 테스트: advanced 유저 계정으로 엔드보스 도전 플로우 전체 검증

---

## 10. 참고: 문제 데이터 JSON 스키마

```json
{
  "question_id": "endboss_adv_ai_agent_p1_001",
  "quiz_category": "final_boss",
  "is_boss": true,
  "project": "ai_agent",
  "phase": 1,
  "stage": "final",
  "unit": 9,
  "course_level": "advanced",
  "difficulty": "hard",
  "type": "fill_in_blank",
  "question": "빈칸을 채워 올바른 Tool Use 코드를 완성하세요.\n\n```python\nresponse = client.messages.create(\n    model='claude-3-5-haiku-20241022',\n    max_tokens=1024,\n    ___=[get_weather_tool],\n    messages=[{'role': 'user', 'content': user_message}]\n)\n```",
  "answer": "tools",
  "feedback": {
    "correct": "정확합니다! Claude API에서 도구를 전달할 때는 `tools` 파라미터를 사용합니다.",
    "incorrect": "Tool Use에서 도구 목록은 `tools` 파라미터로 전달합니다. `functions`나 `tool_list`가 아닙니다."
  }
}
```

`code_input` 타입은 `choices` 없이 `answer`에 모범 답안 코드 작성:

```json
{
  "question_id": "endboss_adv_ai_agent_p2_001",
  "type": "code_input",
  "question": "덧셈, 뺄셈, 곱셈을 처리하는 `calculate` 도구 함수를 구현하세요.\n\n- 입력: `operation` (str: 'add'/'subtract'/'multiply'), `a` (float), `b` (float)\n- 반환: 계산 결과 (float)\n- 지원하지 않는 연산이면 ValueError 발생",
  "answer": "def calculate(operation: str, a: float, b: float) -> float:\n    if operation == 'add':\n        return a + b\n    elif operation == 'subtract':\n        return a - b\n    elif operation == 'multiply':\n        return a * b\n    else:\n        raise ValueError(f'지원하지 않는 연산: {operation}')",
  "feedback": {
    "correct": "완벽합니다! 각 연산 분기와 ValueError 처리까지 정확히 구현했습니다.",
    "incorrect": "operation 값에 따라 분기하고, 미지원 연산에는 ValueError를 발생시켜야 합니다."
  }
}
```
