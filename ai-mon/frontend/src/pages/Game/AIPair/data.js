// 파이썬 개념 비유 짝 맞추기 — 4게임 × 6쌍 = 24쌍
// 카드 A: 파이썬 개념 (type: "concept")
// 카드 B: 일상 비유 이미지/단어 (type: "analogy")

export const PAIRS = [

  // ── Game 1 ── 기초 개념 (Beginner U1~U7) ──────────────────────────
  {
    "id": 1,
    "concept": { "type": "concept", "text": "변수\n(Variable)" },
    "analogy": { "type": "analogy", "text": "📦 데이터 상자" }
  },
  {
    "id": 2,
    "concept": { "type": "concept", "text": "리스트\n(List)" },
    "analogy": { "type": "analogy", "text": "🛒 장바구니" }
  },
  {
    "id": 3,
    "concept": { "type": "concept", "text": "조건문\n(if/else)" },
    "analogy": { "type": "analogy", "text": "🔀 갈림길" }
  },
  {
    "id": 4,
    "concept": { "type": "concept", "text": "반복문\n(Loop)" },
    "analogy": { "type": "analogy", "text": "🎠 회전목마" }
  },
  {
    "id": 5,
    "concept": { "type": "concept", "text": "함수\n(Function)" },
    "analogy": { "type": "analogy", "text": "🔧 만능 도구" }
  },
  {
    "id": 6,
    "concept": { "type": "concept", "text": "딕셔너리\n(Dictionary)" },
    "analogy": { "type": "analogy", "text": "📖 전화번호부" }
  },

  // ── Game 2 ── 입출력 & 문자열 (Beginner U2~U5) ───────────────────
  {
    "id": 7,
    "concept": { "type": "concept", "text": "print()" },
    "analogy": { "type": "analogy", "text": "📢 확성기" }
  },
  {
    "id": 8,
    "concept": { "type": "concept", "text": "input()" },
    "analogy": { "type": "analogy", "text": "🎤 마이크" }
  },
  {
    "id": 9,
    "concept": { "type": "concept", "text": "문자열\n(String)" },
    "analogy": { "type": "analogy", "text": "📿 단어 목걸이" }
  },
  {
    "id": 10,
    "concept": { "type": "concept", "text": "인덱싱\n(Indexing)" },
    "analogy": { "type": "analogy", "text": "🏠 집 주소" }
  },
  {
    "id": 11,
    "concept": { "type": "concept", "text": "for 반복문" },
    "analogy": { "type": "analogy", "text": "🏭 컨베이어 벨트" }
  },
  {
    "id": 12,
    "concept": { "type": "concept", "text": "while 반복문" },
    "analogy": { "type": "analogy", "text": "🚦 신호등" }
  },

  // ── Game 3 ── 제어 흐름 & 자료구조 (Beginner U4~U7) ─────────────
  {
    "id": 13,
    "concept": { "type": "concept", "text": "break" },
    "analogy": { "type": "analogy", "text": "🛑 비상 정지 버튼" }
  },
  {
    "id": 14,
    "concept": { "type": "concept", "text": "continue" },
    "analogy": { "type": "analogy", "text": "⏭️ 역 건너뜀" }
  },
  {
    "id": 15,
    "concept": { "type": "concept", "text": "튜플\n(Tuple)" },
    "analogy": { "type": "analogy", "text": "🔒 봉인된 상자" }
  },
  {
    "id": 16,
    "concept": { "type": "concept", "text": "세트\n(Set)" },
    "analogy": { "type": "analogy", "text": "🏷️ 중복 없는 스탬프" }
  },
  {
    "id": 17,
    "concept": { "type": "concept", "text": "람다\n(Lambda)" },
    "analogy": { "type": "analogy", "text": "🧻 일회용 도구" }
  },
  {
    "id": 18,
    "concept": { "type": "concept", "text": "리스트\n컴프리헨션" },
    "analogy": { "type": "analogy", "text": "🔽 자동 필터" }
  },

  // ── Game 4 ── OOP & 심화 (Intermediate U1~U8) ────────────────────
  {
    "id": 19,
    "concept": { "type": "concept", "text": "예외처리\n(try/except)" },
    "analogy": { "type": "analogy", "text": "🪂 에어백" }
  },
  {
    "id": 20,
    "concept": { "type": "concept", "text": "클래스\n(Class)" },
    "analogy": { "type": "analogy", "text": "🍞 붕어빵 틀" }
  },
  {
    "id": 21,
    "concept": { "type": "concept", "text": "상속\n(Inheritance)" },
    "analogy": { "type": "analogy", "text": "🧬 유전자" }
  },
  {
    "id": 22,
    "concept": { "type": "concept", "text": "가상환경\n(venv)" },
    "analogy": { "type": "analogy", "text": "🧪 독립된 실험실" }
  },
  {
    "id": 23,
    "concept": { "type": "concept", "text": "API" },
    "analogy": { "type": "analogy", "text": "🍽️ 레스토랑 웨이터" }
  },
  {
    "id": 24,
    "concept": { "type": "concept", "text": "모듈\n(Module)" },
    "analogy": { "type": "analogy", "text": "🧰 도구 상자" }
  },

]

// 게임 분할: id 1~6 = Game1, 7~12 = Game2, 13~18 = Game3, 19~24 = Game4
export const GAMES = [
  { gameId: 1, label: "기초 개념", pairs: PAIRS.slice(0, 6) },
  { gameId: 2, label: "입출력 & 문자열", pairs: PAIRS.slice(6, 12) },
  { gameId: 3, label: "제어 흐름 & 자료구조", pairs: PAIRS.slice(12, 18) },
  { gameId: 4, label: "OOP & 심화", pairs: PAIRS.slice(18, 24) },
]
