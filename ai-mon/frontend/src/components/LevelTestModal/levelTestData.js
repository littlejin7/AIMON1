// 판정 기준 (누적 게이트):
//   beginnerOK && intermediateOK && advancedOK → 'advanced'
//   beginnerOK && intermediateOK               → 'intermediate'
//   그 외                                       → 'beginner'
//
//   beginnerOK     = beginner >= 3   (초급 4문제 중 3개)
//   intermediateOK = intermediate >= 2 (중급 3문제 중 2개)
//   advancedOK     = advanced >= 2   (고급 3문제 중 2개)

export const LEVEL_TEST_QUESTIONS = [
  // ── 초급 4문제 ──────────────────────────────────────────
  {
    id: 'lt1',
    level: 'beginner',
    category: 'syntax',
    question: 'Python에서 화면에 글자를 출력하는 함수는?',
    choices: ['show()', 'print()', 'display()', 'echo()'],
    answer: 1,
  },
  {
    id: 'lt2',
    level: 'beginner',
    category: 'syntax',
    question: "for 반복문으로 1~5를 출력하려면?\n\n```python\nfor i in ___:\n    print(i)\n```",
    choices: ['range(5)', 'range(1, 6)', 'range(1, 5)', 'range(0, 5)'],
    answer: 1,
  },
  {
    id: 'lt3',
    level: 'beginner',
    category: 'structure',
    question: "다음 코드의 출력은?\n\n```python\nx = [1, 2, 3, 4, 5]\nprint(x[1:3])\n```",
    choices: ['[1, 2]', '[2, 3]', '[1, 2, 3]', '[3, 4]'],
    answer: 1,
  },
  {
    id: 'lt4',
    level: 'beginner',
    category: 'structure',
    question: "다음 코드의 출력은?\n\n```python\nd = {'hp': 100, 'mp': 50}\nprint(d['mp'])\n```",
    choices: ['100', '50', 'mp', 'Error'],
    answer: 1,
  },

  // ── 중급 3문제 ──────────────────────────────────────────
  {
    id: 'lt5',
    level: 'intermediate',
    category: 'syntax',
    question: "다음 코드에서 출력되는 값은?\n\n```python\nadd = lambda x, y: x + y\nprint(add(3, 7))\n```",
    choices: ['37', '10', '3', 'Error'],
    answer: 1,
  },
  {
    id: 'lt6',
    level: 'intermediate',
    category: 'syntax',
    question: "리스트 컴프리헨션으로 1~5의 제곱 리스트를 만들려면?\n\n```python\nresult = ___\n```",
    choices: [
      '[x^2 for x in range(1,6)]',
      '[x**2 for x in range(1,6)]',
      '[x*x in range(1,6)]',
      'map(x**2, range(1,6))',
    ],
    answer: 1,
  },
  {
    id: 'lt7',
    level: 'intermediate',
    category: 'control',
    question: "다음 코드에서 except 블록이 실행되는 이유는?\n\n```python\ntry:\n    print(1 / 0)\nexcept ZeroDivisionError:\n    print('0으로 나눌 수 없어요')\n```",
    choices: [
      'print()가 잘못 사용되어서',
      '1이 0보다 커서',
      '0으로 나누기는 허용되지 않아서',
      'ZeroDivisionError가 항상 발생해서',
    ],
    answer: 2,
  },

  // ── 고급 3문제 ──────────────────────────────────────────
  {
    id: 'lt8',
    level: 'advanced',
    category: 'control',
    question: "데코레이터(@)의 역할로 가장 적절한 것은?",
    choices: [
      '변수에 주석을 단다',
      '함수를 감싸서 기능을 추가한다',
      '클래스를 상속받는다',
      '모듈을 임포트한다',
    ],
    answer: 1,
  },
  {
    id: 'lt9',
    level: 'advanced',
    category: 'control',
    question: "Python에서 async / await를 사용하는 주된 이유는?",
    choices: [
      '코드를 더 짧게 쓰기 위해',
      'I/O 대기 시간에 다른 작업을 처리하기 위해',
      '멀티코어 CPU를 완전히 활용하기 위해',
      '에러를 자동으로 처리하기 위해',
    ],
    answer: 1,
  },
  {
    id: 'lt10',
    level: 'advanced',
    category: 'control',
    question: "FastAPI에서 경로 함수(path function)에 async def를 쓰는 이유는?",
    choices: [
      '모든 FastAPI 함수는 반드시 async여야 해서',
      'DB·외부 API 같은 I/O 작업을 비동기로 처리해 성능을 높이기 위해',
      'return 값을 자동으로 JSON으로 변환하기 위해',
      '라우터 경로를 자동 생성하기 위해',
    ],
    answer: 1,
  },
]

// 레벨 키('beginner'|'intermediate'|'advanced')를 화면 표기 라벨로 매핑
export const LEVEL_RESULT = {
  beginner: { label: '초급' },
  intermediate: { label: '중급' },
  advanced: { label: '고급' },
}

export { calcLevelResult } from './calcLevelResult.js'
