import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../hooks/useAuthStore'
import './AICross.css'

// ─── 20개 세트 ────────────────────────────────────────────────
const WORD_SETS = [
  // [Set 1] 파이썬 기초 & 입출력
  [
    { id: 'python', word: 'PYTHON', clue: 'AI 학습에 가장 많이 쓰이는 프로그래밍 언어' },
    { id: 'print',  word: 'PRINT',  clue: '화면에 값을 출력하는 가장 기본적인 함수' },
    { id: 'loop',   word: 'LOOP',   clue: 'for / while로 만드는 반복 구조' },
    { id: 'range',  word: 'RANGE',  clue: 'for문에서 연속된 숫자 범위를 만드는 함수 — range(5)는 0~4' },
    { id: 'input',  word: 'INPUT',  clue: '실행 중에 사용자로부터 값을 입력받는 함수' },
    { id: 'string', word: 'STRING', clue: '따옴표로 감싸는 문자 데이터 자료형 — "hello"' },
  ],
  // [Set 2] 리스트 & 자료구조 기초
  [
    { id: 'list',   word: 'LIST',   clue: '순서 있는 데이터 묶음 — [ ]로 표현, 수정 가능' },
    { id: 'tuple',  word: 'TUPLE',  clue: '순서 있지만 수정 불가능한 자료형 — ( )로 표현' },
    { id: 'index',  word: 'INDEX',  clue: '리스트·문자열의 요소 위치 번호 (0부터 시작)' },
    { id: 'slice',  word: 'SLICE',  clue: '[시작:끝]으로 리스트·문자열의 일부를 잘라내는 기법' },
    { id: 'dict',   word: 'DICT',   clue: '키(key)와 값(value) 쌍으로 저장하는 자료형 — { }' },
    { id: 'append', word: 'APPEND', clue: '리스트의 맨 끝에 새 요소를 추가하는 메서드' },
  ],
  // [Set 3] 제어 키워드 & 함수
  [
    { id: 'return',   word: 'RETURN',   clue: '함수가 결과값을 호출한 곳으로 돌려줄 때 쓰는 키워드' },
    { id: 'break',    word: 'BREAK',    clue: '반복문 실행 중 즉시 루프를 탈출하는 키워드' },
    { id: 'while',    word: 'WHILE',    clue: '조건이 참인 동안 계속 반복하는 반복문' },
    { id: 'raise',    word: 'RAISE',    clue: '코드에서 의도적으로 예외를 발생시키는 키워드' },
    { id: 'continue', word: 'CONTINUE', clue: '현재 반복을 건너뛰고 다음 반복으로 넘어가는 키워드' },
    { id: 'class',    word: 'CLASS',    clue: '객체를 만들기 위한 설계도 — OOP의 핵심 개념' },
  ],
  // [Set 4] 함수 심화 & 변수 범위
  [
    { id: 'scope',    word: 'SCOPE',    clue: '변수가 유효한 범위(전역/지역)를 의미하는 개념' },
    { id: 'lambda',   word: 'LAMBDA',   clue: '이름 없이 한 줄로 정의하는 익명 함수' },
    { id: 'global',   word: 'GLOBAL',   clue: '함수 밖에서 선언되어 어디서든 접근 가능한 변수 범위' },
    { id: 'local',    word: 'LOCAL',    clue: '함수 안에서만 사용 가능한 지역 변수의 범위' },
    { id: 'value',    word: 'VALUE',    clue: '변수나 키(key)에 저장된 실제 데이터 값' },
    { id: 'argument', word: 'ARGUMENT', clue: '함수를 호출할 때 실제로 전달하는 값' },
  ],
  // [Set 5] 자료형
  [
    { id: 'boolean',  word: 'BOOLEAN',  clue: 'True 또는 False 두 가지 값만 갖는 논리 자료형' },
    { id: 'integer',  word: 'INTEGER',  clue: '소수점 없는 정수형 자료형 — int()' },
    { id: 'float',    word: 'FLOAT',    clue: '소수점이 있는 실수형 자료형 — float()' },
    { id: 'convert',  word: 'CONVERT',  clue: '자료형을 다른 타입으로 바꾸는 것 — int("3") → 3' },
    { id: 'variable', word: 'VARIABLE', clue: '데이터를 저장하기 위해 이름을 붙인 메모리 공간' },
    { id: 'type',     word: 'TYPE',     clue: '데이터의 종류를 확인하는 함수 — type(3) → int' },
  ],
  // [Set 6] 예외처리 & 디버깅
  [
    { id: 'except',  word: 'EXCEPT',  clue: 'try 블록에서 오류 발생 시 처리를 담당하는 키워드' },
    { id: 'error',   word: 'ERROR',   clue: '프로그램 실행 중 발생하는 오류의 총칭' },
    { id: 'debug',   word: 'DEBUG',   clue: '코드의 버그를 찾아서 수정하는 과정' },
    { id: 'syntax',  word: 'SYNTAX',  clue: '프로그래밍 언어의 문법 규칙 — 위반 시 SyntaxError 발생' },
    { id: 'handler', word: 'HANDLER', clue: '발생한 예외를 잡아서 처리하는 코드 블록' },
    { id: 'comment', word: 'COMMENT', clue: '코드 실행에는 영향 없는 설명글 — # 기호로 시작' },
  ],
  // [Set 7] 모듈 & 패키지
  [
    { id: 'import',  word: 'IMPORT',  clue: '외부 모듈·라이브러리를 현재 파일에 불러오는 키워드' },
    { id: 'module',  word: 'MODULE',  clue: '파이썬 코드를 담은 .py 파일 단위의 재사용 가능한 묶음' },
    { id: 'library', word: 'LIBRARY', clue: '특정 기능을 제공하는 모듈 모음 — numpy, pandas 등' },
    { id: 'install', word: 'INSTALL', clue: 'pip 명령으로 외부 패키지를 시스템에 설치하는 것' },
    { id: 'package', word: 'PACKAGE', clue: '관련 모듈을 폴더 단위로 묶은 것 — __init__.py 포함' },
    { id: 'version', word: 'VERSION', clue: '패키지나 파이썬의 릴리즈 번호 — pip show로 확인' },
  ],
  // [Set 8] 클래스 & OOP
  [
    { id: 'object',    word: 'OBJECT',    clue: '클래스(설계도)로 만들어진 실체 — 속성과 메서드를 가짐' },
    { id: 'inherit',   word: 'INHERIT',   clue: '부모 클래스의 속성·메서드를 자식 클래스가 물려받는 것' },
    { id: 'instance',  word: 'INSTANCE',  clue: '클래스를 통해 실제로 생성된 개별 객체' },
    { id: 'method',    word: 'METHOD',    clue: '클래스 안에 정의된 함수' },
    { id: 'attribute', word: 'ATTRIBUTE', clue: '객체가 가지는 데이터(변수) — self.name처럼 접근' },
    { id: 'parent',    word: 'PARENT',    clue: '상속 관계에서 기능을 물려주는 상위(부모) 클래스' },
  ],
  // [Set 9] 정규식
  [
    { id: 'regex',   word: 'REGEX',   clue: '문자열 패턴을 표현하는 정규 표현식의 줄임말' },
    { id: 'pattern', word: 'PATTERN', clue: '정규식에서 찾고자 하는 문자열의 규칙 형태' },
    { id: 'match',   word: 'MATCH',   clue: '문자열의 처음부터 패턴 일치 여부를 확인하는 함수' },
    { id: 'search',  word: 'SEARCH',  clue: '문자열 전체에서 패턴을 찾아 첫 번째 결과를 반환하는 함수' },
    { id: 'group',   word: 'GROUP',   clue: '정규식에서 괄호 ( )로 묶어 추출한 부분 문자열' },
    { id: 'replace', word: 'REPLACE', clue: '패턴과 일치하는 부분을 다른 문자열로 치환하는 것' },
  ],
  // [Set 10] API & HTTP 통신
  [
    { id: 'request',  word: 'REQUEST',  clue: '클라이언트가 서버에 데이터를 보내는 HTTP 요청' },
    { id: 'response', word: 'RESPONSE', clue: '서버가 요청에 대해 돌려주는 HTTP 응답' },
    { id: 'parse',    word: 'PARSE',    clue: 'JSON 등 응답 데이터를 파이썬 객체로 변환하는 것' },
    { id: 'header',   word: 'HEADER',   clue: 'HTTP 요청·응답에서 메타 정보를 담는 부분 (인증키 등)' },
    { id: 'status',   word: 'STATUS',   clue: '서버 응답의 성공 여부 코드 — 200(성공), 404(없음)' },
    { id: 'token',    word: 'TOKEN',    clue: 'API 인증에 사용되는 임시 접근 키' },
  ],
  // [Set 11] 문자열 메서드
  [
    { id: 'split',  word: 'SPLIT',  clue: '구분자를 기준으로 문자열을 나누어 리스트로 반환하는 메서드' },
    { id: 'join',   word: 'JOIN',   clue: '리스트의 요소들을 구분자로 연결해 하나의 문자열로 만드는 메서드' },
    { id: 'upper',  word: 'UPPER',  clue: '문자열의 모든 알파벳을 대문자로 바꾸는 메서드' },
    { id: 'lower',  word: 'LOWER',  clue: '문자열의 모든 알파벳을 소문자로 바꾸는 메서드' },
    { id: 'strip',  word: 'STRIP',  clue: '문자열 앞뒤의 공백(또는 지정 문자)을 제거하는 메서드' },
    { id: 'format', word: 'FORMAT', clue: '문자열 안에 변수 값을 삽입하는 메서드 — "{}".format(값)' },
  ],
  // [Set 12] 리스트 고급 조작
  [
    { id: 'sort',      word: 'SORT',      clue: '리스트 요소를 오름차순/내림차순으로 정렬하는 메서드' },
    { id: 'reverse',   word: 'REVERSE',   clue: '리스트의 요소 순서를 거꾸로 뒤집는 메서드' },
    { id: 'filter',    word: 'FILTER',    clue: '조건 함수를 만족하는 요소만 걸러내는 고차 함수' },
    { id: 'iterator',  word: 'ITERATOR',  clue: 'next()로 요소를 하나씩 꺼낼 수 있는 반복 가능한 객체' },
    { id: 'enumerate', word: 'ENUMERATE', clue: '반복 시 인덱스와 값을 동시에 반환하는 내장 함수' },
    { id: 'generator', word: 'GENERATOR', clue: 'yield 키워드로 값을 하나씩 생산하는 특수 함수' },
  ],
  // [Set 13] 파일 처리
  [
    { id: 'file',  word: 'FILE',  clue: '데이터를 저장하거나 읽어오는 디스크 상의 파일 객체' },
    { id: 'open',  word: 'OPEN',  clue: '파일을 읽기·쓰기 모드로 열어 파일 객체를 반환하는 함수' },
    { id: 'read',  word: 'READ',  clue: '파일의 내용을 문자열로 읽어오는 메서드' },
    { id: 'write', word: 'WRITE', clue: '파일에 문자열 데이터를 저장하는 메서드' },
    { id: 'close', word: 'CLOSE', clue: '사용이 끝난 파일 객체를 닫아 자원을 해제하는 메서드' },
    { id: 'path',  word: 'PATH',  clue: '파일이나 폴더가 위치한 경로를 나타내는 문자열' },
  ],
  // [Set 14] 딕셔너리 심화
  [
    { id: 'update',  word: 'UPDATE',  clue: '딕셔너리에 새 키-값 쌍을 추가하거나 기존 값을 수정하는 메서드' },
    { id: 'items',   word: 'ITEMS',   clue: '딕셔너리의 키-값 쌍을 튜플 형태로 모두 반환하는 메서드' },
    { id: 'values',  word: 'VALUES',  clue: '딕셔너리에 저장된 모든 값(value)을 반환하는 메서드' },
    { id: 'keys',    word: 'KEYS',    clue: '딕셔너리에 저장된 모든 키(key)를 반환하는 메서드' },
    { id: 'nested',  word: 'NESTED',  clue: '딕셔너리나 리스트 안에 또 다른 자료구조가 중첩된 구조' },
    { id: 'mapping', word: 'MAPPING', clue: '키(key)와 값(value)을 연결하는 딕셔너리 계열 자료형의 특성' },
  ],
  // [Set 15] OOP 심화
  [
    { id: 'super',     word: 'SUPER',     clue: '자식 클래스에서 부모 클래스의 메서드를 호출할 때 쓰는 함수' },
    { id: 'self',      word: 'SELF',      clue: '클래스 내에서 인스턴스 자기 자신을 참조하는 키워드' },
    { id: 'decorator', word: 'DECORATOR', clue: '함수나 클래스를 감싸서 기능을 추가하는 @표기 패턴' },
    { id: 'abstract',  word: 'ABSTRACT',  clue: '구현 없이 인터페이스만 정의하는 추상 클래스의 특성' },
    { id: 'property',  word: 'PROPERTY',  clue: '메서드를 속성처럼 접근할 수 있게 해주는 내장 데코레이터' },
    { id: 'override',  word: 'OVERRIDE',  clue: '자식 클래스에서 부모의 메서드를 재정의하는 것' },
  ],
  // [Set 16] 비동기 & 고급 문법
  [
    { id: 'async',    word: 'ASYNC',    clue: '비동기 함수를 정의할 때 def 앞에 붙이는 키워드' },
    { id: 'await',    word: 'AWAIT',    clue: '비동기 함수 안에서 코루틴 실행 완료를 기다리는 키워드' },
    { id: 'task',     word: 'TASK',     clue: 'asyncio에서 코루틴을 동시에 실행하기 위해 감싸는 단위' },
    { id: 'stream',   word: 'STREAM',   clue: '데이터를 한꺼번에 받지 않고 조금씩 연속으로 받는 방식' },
    { id: 'context',  word: 'CONTEXT',  clue: 'with문과 함께 쓰는 자원 관리 객체 — __enter__/__exit__ 구현' },
    { id: 'pipeline', word: 'PIPELINE', clue: '여러 처리 단계를 체인처럼 연결한 데이터 흐름 구조' },
  ],
  // [Set 17] LLM & AI 기초
  [
    { id: 'prompt', word: 'PROMPT', clue: 'AI 모델에 입력하는 질문 또는 지시문' },
    { id: 'model',  word: 'MODEL',  clue: '학습된 AI 알고리즘 — GPT, Claude 등' },
    { id: 'agent',  word: 'AGENT',  clue: '도구를 사용해 목표를 달성하는 자율 AI 프로그램' },
    { id: 'chain',  word: 'CHAIN',  clue: 'LangChain에서 여러 처리 단계를 연결한 파이프라인' },
    { id: 'memory', word: 'MEMORY', clue: '챗봇이 이전 대화 내용을 기억하는 기능' },
    { id: 'deploy', word: 'DEPLOY', clue: '개발한 AI 앱을 서버에 올려 사용 가능하게 배포하는 것' },
  ],
  // [Set 18] 데이터 & API 심화
  [
    { id: 'endpoint', word: 'ENDPOINT', clue: 'API에서 특정 기능에 접근하는 URL 경로' },
    { id: 'payload',  word: 'PAYLOAD',  clue: 'HTTP 요청·응답에서 실제로 전달되는 데이터 본문' },
    { id: 'schema',   word: 'SCHEMA',   clue: '데이터의 구조와 형식을 정의한 설계도' },
    { id: 'query',    word: 'QUERY',    clue: '데이터베이스나 API에 원하는 데이터를 요청하는 질의' },
    { id: 'fetch',    word: 'FETCH',    clue: '서버에서 데이터를 가져오는 HTTP 요청 행위' },
    { id: 'encode',   word: 'ENCODE',   clue: '데이터를 특정 형식(URL, Base64 등)으로 변환하는 것' },
  ],
  // [Set 19] 연산자 & 조건
  [
    { id: 'operator',  word: 'OPERATOR',  clue: '연산을 수행하는 기호 — +, -, *, /, ==, != 등' },
    { id: 'condition', word: 'CONDITION', clue: 'if문에서 참/거짓을 판단하는 조건식' },
    { id: 'logical',   word: 'LOGICAL',   clue: 'and, or, not처럼 조건을 결합하는 논리 연산의 유형' },
    { id: 'compare',   word: 'COMPARE',   clue: '두 값의 크기나 동일성을 비교하는 연산 — ==, >, < 등' },
    { id: 'assign',    word: 'ASSIGN',    clue: '변수에 값을 저장하는 대입 연산 — = 기호 사용' },
    { id: 'evaluate',  word: 'EVALUATE',  clue: '수식이나 조건식을 실제 값(True/False 등)으로 계산하는 것' },
  ],
  // [Set 20] 함수 & 실행 구조
  [
    { id: 'function',  word: 'FUNCTION',  clue: '특정 기능을 수행하는 코드 블록 — def 키워드로 정의' },
    { id: 'parameter', word: 'PARAMETER', clue: '함수 정의 시 입력을 받기 위해 선언하는 변수' },
    { id: 'recursion', word: 'RECURSION', clue: '함수가 자기 자신을 호출하며 문제를 푸는 방식' },
    { id: 'stack',     word: 'STACK',     clue: '함수 호출 시 쌓이고 반환 시 줄어드는 메모리 구조 (LIFO)' },
    { id: 'output',    word: 'OUTPUT',    clue: '함수나 프로그램이 실행 결과로 내보내는 값' },
    { id: 'define',    word: 'DEFINE',    clue: '함수나 변수를 선언하여 이름과 기능을 지정하는 것' },
  ],
]

// ─── 자동 배치 알고리즘 ──────────────────────────────────────
function buildCrossword(words) {
  const sorted = [...words].sort((a, b) => b.word.length - a.word.length)
  const placed = []
  const grid = {}

  const dr = { H: 0, V: 1 }
  const dc = { H: 1, V: 0 }

  const canPlace = (word, r, c, dir) => {
    const len = word.length
    const beforeKey = `${r - dr[dir]},${c - dc[dir]}`
    const afterKey  = `${r + dr[dir] * len},${c + dc[dir] * len}`
    if (grid[beforeKey] || grid[afterKey]) return false

    let intersects = 0
    for (let i = 0; i < len; i++) {
      const ri = r + dr[dir] * i
      const ci = c + dc[dir] * i
      const existing = grid[`${ri},${ci}`]
      if (existing) {
        if (existing !== word[i]) return false
        intersects++
      } else {
        if (dir === 'H') {
          if (grid[`${ri - 1},${ci}`] || grid[`${ri + 1},${ci}`]) return false
        } else {
          if (grid[`${ri},${ci - 1}`] || grid[`${ri},${ci + 1}`]) return false
        }
      }
    }
    return placed.length === 0 || intersects >= 1
  }

  const placeWord = (word, r, c, dir) => {
    for (let i = 0; i < word.length; i++) {
      grid[`${r + dr[dir] * i},${c + dc[dir] * i}`] = word[i]
    }
  }

  placeWord(sorted[0].word, 0, 0, 'H')
  placed.push({ ...sorted[0], r: 0, c: 0, dir: 'H' })

  for (let wi = 1; wi < sorted.length; wi++) {
    const w = sorted[wi]
    let best = null
    let bestScore = -Infinity

    for (const pw of placed) {
      const newDir = pw.dir === 'H' ? 'V' : 'H'
      for (let pi = 0; pi < pw.word.length; pi++) {
        const pr = pw.r + dr[pw.dir] * pi
        const pc = pw.c + dc[pw.dir] * pi
        for (let wi2 = 0; wi2 < w.word.length; wi2++) {
          if (pw.word[pi] !== w.word[wi2]) continue
          const nr = pr - dr[newDir] * wi2
          const nc = pc - dc[newDir] * wi2
          if (!canPlace(w.word, nr, nc, newDir)) continue

          let score = 0
          for (let i = 0; i < w.word.length; i++) {
            if (grid[`${nr + dr[newDir] * i},${nc + dc[newDir] * i}`]) score += 10
          }
          score -= (Math.abs(nr) + Math.abs(nc))
          if (score > bestScore) { bestScore = score; best = { ...w, r: nr, c: nc, dir: newDir } }
        }
      }
    }

    if (best) {
      placed.push(best)
      placeWord(best.word, best.r, best.c, best.dir)
    }
  }

  let minR = Infinity, minC = Infinity
  placed.forEach(p => {
    for (let i = 0; i < p.word.length; i++) {
      minR = Math.min(minR, p.r + dr[p.dir] * i)
      minC = Math.min(minC, p.c + dc[p.dir] * i)
    }
  })
  const normalized = placed.map(p => ({ ...p, r: p.r - minR, c: p.c - minC }))

  const starts = {}
  normalized.forEach(p => {
    const key = `${p.r},${p.c}`
    if (!starts[key]) starts[key] = []
    starts[key].push(p)
  })
  const sortedKeys = Object.keys(starts).sort((a, b) => {
    const [ar, ac] = a.split(',').map(Number)
    const [br, bc] = b.split(',').map(Number)
    return ar !== br ? ar - br : ac - bc
  })
  const numMap = {}
  sortedKeys.forEach((key, i) => { numMap[key] = i + 1 })

  const wordData = normalized.map(p => ({ ...p, num: numMap[`${p.r},${p.c}`] }))

  let maxR = 0, maxC = 0
  wordData.forEach(p => {
    for (let i = 0; i < p.word.length; i++) {
      maxR = Math.max(maxR, p.r + dr[p.dir] * i)
      maxC = Math.max(maxC, p.c + dc[p.dir] * i)
    }
  })

  return { wordData, rows: maxR + 1, cols: maxC + 1 }
}

// ─── 세트에서 레이아웃 계산 ───────────────────────────────────
function buildLayout(words) {
  const { wordData, rows, cols } = buildCrossword(words)

  const cellMap = {}
  const wordCells = {}

  wordData.forEach(({ id, word, r: sr, c: sc, dir, num }) => {
    wordCells[id] = []
    const dRow = dir === 'V' ? 1 : 0
    const dCol = dir === 'H' ? 1 : 0
    for (let i = 0; i < word.length; i++) {
      const r = sr + dRow * i
      const c = sc + dCol * i
      const key = `${r},${c}`
      if (!cellMap[key]) cellMap[key] = { letter: word[i], wordIds: [] }
      cellMap[key].wordIds.push(id)
      wordCells[id].push({ r, c })
    }
    const sk = `${sr},${sc}`
    if (cellMap[sk] && !cellMap[sk].num) cellMap[sk].num = num
  })

  return { wordData, rows, cols, cellMap, wordCells }
}

// ─── 랜덤 세트 선택 (이미 사용한 세트는 마지막에 재사용) ──────
function pickRandomSet(usedIndices) {
  // 아직 안 쓴 세트 인덱스
  const remaining = WORD_SETS.map((_, i) => i).filter(i => !usedIndices.has(i))
  if (remaining.length === 0) {
    // 전부 다 했으면 리셋
    const idx = Math.floor(Math.random() * WORD_SETS.length)
    return { idx, resetUsed: true }
  }
  const idx = remaining[Math.floor(Math.random() * remaining.length)]
  return { idx, resetUsed: false }
}

// ─── 컴포넌트 ─────────────────────────────────────────────────
export default function AICross() {
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const wrapRef = useRef(null)

  const [usedIndices, setUsedIndices] = useState(new Set())
  const [setIndex, setSetIndex] = useState(() => Math.floor(Math.random() * WORD_SETS.length))
  const [layout, setLayout] = useState(() => buildLayout(WORD_SETS[Math.floor(Math.random() * WORD_SETS.length)]))

  const { wordData, rows, cols, cellMap, wordCells } = layout

  const [inputs, setInputs] = useState({})
  const [selectedId, setSelectedId] = useState(wordData[0]?.id)
  const [cursor, setCursor] = useState({ r: wordData[0]?.r ?? 0, c: wordData[0]?.c ?? 0 })
  const [checked, setChecked] = useState({})
  const [won, setWon] = useState(false)
  const [reward, setReward] = useState(null) // { xp_awarded, already_claimed }

  // 초기 세트 인덱스를 usedIndices에 등록
  useEffect(() => {
    setUsedIndices(new Set([setIndex]))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selWord = wordData.find(w => w.id === selectedId)
  const selSet = selectedId
    ? new Set(wordCells[selectedId].map(({ r, c }) => `${r},${c}`))
    : new Set()

  const selectWord = (id, jumpToStart = false) => {
    setSelectedId(id)
    if (jumpToStart) {
      const w = wordData.find(x => x.id === id)
      if (w) setCursor({ r: w.r, c: w.c })
    }
  }

  const handleCellClick = (r, c) => {
    const key = `${r},${c}`
    if (!cellMap[key]) return
    const wordsHere = cellMap[key].wordIds
      .map(id => wordData.find(w => w.id === id))
      .filter(Boolean)
    setCursor({ r, c })
    if (wordsHere.length === 1) {
      setSelectedId(wordsHere[0].id)
    } else if (wordsHere.some(w => w.id === selectedId)) {
      const other = wordsHere.find(w => w.id !== selectedId)
      if (other) setSelectedId(other.id)
    } else {
      const h = wordsHere.find(w => w.dir === 'H')
      setSelectedId(h ? h.id : wordsHere[0].id)
    }
  }

  const handleKeyDown = useCallback((e) => {
    const letter = e.key.toUpperCase()
    const { r, c } = cursor
    const key = `${r},${c}`

    if (e.key.length === 1 && /^[A-Za-z]$/.test(e.key)) {
      e.preventDefault()
      setInputs(prev => ({ ...prev, [key]: letter }))
      setChecked(prev => { const n = { ...prev }; delete n[key]; return n })
      if (selWord) {
        const cells = wordCells[selWord.id]
        const idx = cells.findIndex(x => x.r === r && x.c === c)
        if (idx < cells.length - 1) setCursor(cells[idx + 1])
      }
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      if (inputs[key]) {
        setInputs(prev => { const n = { ...prev }; delete n[key]; return n })
        setChecked(prev => { const n = { ...prev }; delete n[key]; return n })
      } else if (selWord) {
        const cells = wordCells[selWord.id]
        const idx = cells.findIndex(x => x.r === r && x.c === c)
        if (idx > 0) {
          const prev = cells[idx - 1]
          setCursor(prev)
          const pk = `${prev.r},${prev.c}`
          setInputs(p => { const n = { ...p }; delete n[pk]; return n })
          setChecked(p => { const n = { ...p }; delete n[pk]; return n })
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const idx = wordData.findIndex(w => w.id === selectedId)
      const next = wordData[(idx + (e.shiftKey ? wordData.length - 1 : 1)) % wordData.length]
      setSelectedId(next.id)
      setCursor({ r: next.r, c: next.c })
    }
  }, [cursor, selWord, selectedId, inputs, wordData, wordCells])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => { wrapRef.current?.focus() }, [])

  const callClearAPI = async (score) => {
    try {
      const res = await fetch('/api/game/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ game_id: 'aicross', score }),
      })
      if (res.ok) {
        const data = await res.json()
        setReward(data)
      }
    } catch {
      setReward({ xp_awarded: 0, already_claimed: false })
    }
  }

  const handleCheck = () => {
    const result = {}
    let allCorrect = true
    Object.entries(cellMap).forEach(([key, { letter }]) => {
      const u = inputs[key]
      if (u) {
        result[key] = u === letter ? 'correct' : 'wrong'
        if (u !== letter) allCorrect = false
      } else {
        allCorrect = false
      }
    })
    setChecked(result)
    if (allCorrect && Object.keys(result).length === Object.keys(cellMap).length) {
      setWon(true)
      const total = Object.keys(cellMap).length
      const correct = Object.values(result).filter(v => v === 'correct').length
      const score = Math.round((correct / total) * 100)
      callClearAPI(score)
    }
  }

  const handleReveal = () => {
    const all = {}
    const res = {}
    Object.entries(cellMap).forEach(([key, { letter }]) => {
      all[key] = letter
      res[key] = 'correct'
    })
    setInputs(all)
    setChecked(res)
    setWon(true)
    callClearAPI(0)
  }

  const handleReset = () => {
    setInputs({})
    setChecked({})
    setWon(false)
    setSelectedId(wordData[0]?.id)
    setCursor({ r: wordData[0]?.r ?? 0, c: wordData[0]?.c ?? 0 })
  }

  const acrossWords = wordData.filter(w => w.dir === 'H').sort((a, b) => a.num - b.num)
  const downWords   = wordData.filter(w => w.dir === 'V').sort((a, b) => a.num - b.num)

  const SET_NAMES = [
    '파이썬 기초 & 입출력', '리스트 & 자료구조 기초', '제어 키워드 & 함수',
    '함수 심화 & 변수 범위', '자료형', '예외처리 & 디버깅',
    '모듈 & 패키지', '클래스 & OOP', '정규식',
    'API & HTTP 통신', '문자열 메서드', '리스트 고급 조작',
    '파일 처리', '딕셔너리 심화', 'OOP 심화',
    '비동기 & 고급 문법', 'LLM & AI 기초', '데이터 & API 심화',
    '연산자 & 조건', '함수 & 실행 구조',
  ]

  return (
    <div className="aicross-wrap" ref={wrapRef} tabIndex={-1}>
      <div className="aicross-header">
        <button className="aicross-back" onClick={() => navigate('/game')}>←</button>
        <div className="aicross-header-title-group">
          <span className="aicross-header-title">AI 크로스워드</span>
          <span className="aicross-set-label">{SET_NAMES[setIndex]}</span>
        </div>
        <div className="aicross-header-btns">
          <button className="acbtn acbtn--check" onClick={handleCheck}>확인</button>
          <button className="acbtn acbtn--reveal" onClick={handleReveal}>정답</button>
          <button className="acbtn acbtn--reset" onClick={handleReset}>초기화</button>
        </div>
      </div>

      {selWord && (
        <div className="aicross-active-clue">
          <span className="aicross-clue-tag">
            {selWord.num}{selWord.dir === 'H' ? '→' : '↓'}
          </span>
          <span className="aicross-clue-text">{selWord.clue}</span>
        </div>
      )}

      {won && (
        <div className="aicross-win-overlay">
          <div className="aicross-win-modal">
            <div className="aicross-win-emoji">🎉</div>
            <div className="aicross-win-title">완성!</div>
            <div className="aicross-win-sub">모든 단어를 맞혔어요!</div>
            {reward ? (
              reward.already_claimed
                ? <div className="aicross-win-xp aicross-win-xp--claimed">오늘 보상은 이미 받았어요 (최대 3판)</div>
                : <div className="aicross-win-xp">⚡ +{reward.xp_awarded} XP 획득!</div>
            ) : (
              <div className="aicross-win-xp aicross-win-xp--loading">보상 계산 중…</div>
            )}
            <button className="acbtn acbtn--next" onClick={() => navigate('/game')}>← 목록으로</button>
          </div>
        </div>
      )}

      <div className="aicross-body">
        <div className="aicross-grid-box">
          <div
            className="aicross-grid"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
          >
            {Array.from({ length: rows * cols }, (_, i) => {
              const r = Math.floor(i / cols)
              const c = i % cols
              const key = `${r},${c}`
              const cell = cellMap[key]

              if (!cell) return <div key={key} className="ac-cell ac-cell--void" />

              const isSel = selSet.has(key)
              const isCur = cursor.r === r && cursor.c === c
              const status = checked[key]

              return (
                <div
                  key={key}
                  className={[
                    'ac-cell',
                    isSel && !isCur ? 'is-selected' : '',
                    isCur ? 'is-cursor' : '',
                    status === 'correct' ? 'is-correct' : '',
                    status === 'wrong' ? 'is-wrong' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleCellClick(r, c)}
                >
                  {cell.num && <span className="ac-num">{cell.num}</span>}
                  <span className="ac-letter">{inputs[key] || ''}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="aicross-clues">
          <div className="aicross-clue-col">
            <div className="aicross-clue-heading">가로 →</div>
            {acrossWords.map(w => (
              <div
                key={w.id}
                className={`aicross-clue-item${selectedId === w.id ? ' is-active' : ''}`}
                onClick={() => selectWord(w.id, true)}
              >
                <b>{w.num}.</b> {w.clue}
              </div>
            ))}
          </div>
          <div className="aicross-clue-col">
            <div className="aicross-clue-heading">세로 ↓</div>
            {downWords.map(w => (
              <div
                key={w.id}
                className={`aicross-clue-item${selectedId === w.id ? ' is-active' : ''}`}
                onClick={() => selectWord(w.id, true)}
              >
                <b>{w.num}.</b> {w.clue}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
