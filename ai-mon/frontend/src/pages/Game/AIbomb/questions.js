// ═══════════════════════════════════════════════════════════════
//  questions.js — 문제 데이터, 게임 상수, 유틸
// ═══════════════════════════════════════════════════════════════

export const INITIAL_TIME  = 20;
export const PENALTY_SEC   = 10;
export const TOTAL_STAGES  = 10;

export function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

export const QUESTIONS = [
  // ── Lv1 기초 ──
  {
    before: 'for i in ', after: '(1, 5):',
    answer: 'range', choices: ['range', 'len', 'list'],
    hint: 'for 반복문의 범위 생성 함수',
  },
  {
    before: 'n = ', after: '([1, 2, 3])',
    answer: 'len', choices: ['len', 'list', 'range'],
    hint: '리스트의 원소 개수를 반환',
  },
  {
    before: 'items = ', after: '(range(5))',
    answer: 'list', choices: ['list', 'tuple', 'set'],
    hint: 'range를 리스트로 변환',
  },
  // ── Lv2 형 변환 ──
  {
    before: 'x = ', after: '(3.7)',
    answer: 'int', choices: ['int', 'str', 'float'],
    hint: '소수를 정수로 변환 (내림)',
  },
  {
    before: 's = ', after: '(42)',
    answer: 'str', choices: ['str', 'int', 'bool'],
    hint: '숫자를 문자열로 변환',
  },
  {
    before: 'b = ', after: '(0)',
    answer: 'bool', choices: ['bool', 'int', 'str'],
    hint: '0은 False, 나머지는 True',
  },
  // ── Lv3 컬렉션 함수 ──
  {
    before: 'big = ', after: '([5, 2, 9, 1])',
    answer: 'max', choices: ['max', 'min', 'sum'],
    hint: '가장 큰 값을 반환',
  },
  {
    before: 'total = ', after: '([1, 2, 3, 4])',
    answer: 'sum', choices: ['sum', 'max', 'len'],
    hint: '모든 원소의 합을 계산',
  },
  {
    before: 'nums = ', after: '([3, 1, 4, 1, 5])',
    answer: 'sorted', choices: ['sorted', 'list', 'reversed'],
    hint: '새로운 정렬된 리스트를 반환',
  },
  // ── Lv4 고급 ──
  {
    before: 'pairs = ', after: '([1,2], [\'a\',\'b\'])',
    answer: 'zip', choices: ['zip', 'map', 'filter'],
    hint: '두 리스트를 묶어 튜플 쌍으로',
  },
];
