import { useState } from 'react'
import './CodeViewer.css'

const KEYWORD_SECTIONS = [
  {
    label: '출력 / 입력 / 주석',
    keywords: [
      {
        key: 'print', label: 'print', desc: '출력', progress: 100, fillClass: 'btp-fill-done',
        lines: 1,
        code: 'print("안녕하세요!")',
        output: '안녕하세요!',
        hint: '💡 print() 는 화면에 내용을 출력해요 — 콘솔의 스피커 역할이에요',
      },
      {
        key: 'input', label: 'input', desc: '입력', progress: 55, fillClass: 'btp-fill-mid',
        lines: 2,
        code: 'name = input("이름을 입력하세요: ")\nprint("안녕,", name)',
        output: '이름을 입력하세요: █\n(입력 후 → 안녕, 홍길동)',
        hint: '💡 input() 은 사용자가 타이핑할 수 있게 기다려요',
        outputStyle: 'input',
      },
      {
        key: 'comment', label: '#', desc: '주석', progress: 20, fillClass: 'btp-fill-low',
        lines: 3,
        code: '# 이 줄은 실행되지 않아요\nprint("코드 실행!")\n# print("이건 안 나와요")',
        output: '코드 실행!',
        hint: '💡 # 뒤의 내용은 파이썬이 무시해요 — 메모장 같은 거예요',
      },
      { key: 'lock1', locked: true },
      { key: 'lock2', locked: true },
    ],
  },
  {
    label: '자료구조',
    keywords: [
      {
        key: 'list', label: 'list', desc: '리스트', progress: 70, fillClass: 'btp-fill-mid',
        lines: 3,
        code: 'fruits = list(["🍎", "🍌", "🍇"])\nprint(fruits)\nprint(fruits[0])',
        output: "['🍎', '🍌', '🍇']\n🍎",
        hint: '💡 list 는 항목들을 순서대로 담는 바구니예요',
      },
      {
        key: 'len', label: 'len', desc: '길이', progress: 40, fillClass: 'btp-fill-mid',
        lines: 2,
        code: 'fruits = ["🍎", "🍌", "🍇"]\nprint(len(fruits))',
        output: '3',
        hint: '💡 len() 은 항목이 몇 개인지 세어줘요 — 자로 길이 재기',
      },
      { key: 'lock3', locked: true },
      { key: 'lock4', locked: true },
      { key: 'lock5', locked: true },
    ],
  },
  {
    label: '제어 흐름',
    keywords: [
      {
        key: 'if', label: 'if', desc: '조건', progress: 100, fillClass: 'btp-fill-done',
        lines: 4,
        code: 'score = 85\nif score >= 80:\n    print("합격! 🎉")\nelse:\n    print("재도전!")',
        output: '합격! 🎉',
        hint: '💡 if 는 갈림길 — 조건이 참이면 이쪽, 거짓이면 저쪽',
      },
      {
        key: 'for', label: 'for', desc: '반복', progress: 60, fillClass: 'btp-fill-mid',
        lines: 3,
        code: 'items = ["🍎", "🍌", "🍇"]\nfor item in items:\n    print(item)',
        output: '🍎\n🍌\n🍇',
        hint: '💡 for 는 컨베이어 벨트 — 항목을 하나씩 꺼내서 처리해요',
      },
      { key: 'lock6', locked: true },
      { key: 'lock7', locked: true },
      { key: 'lock8', locked: true },
    ],
  },
  {
    label: '출력화면',
    keywords: [
      {
        key: 'def', label: 'def', desc: '함수정의', progress: 0, fillClass: 'btp-fill-none',
        lines: 4,
        code: 'def greet(name):\n    print("안녕,", name)\n\ngreet("파이썬")',
        output: '안녕, 파이썬',
        hint: '💡 def 는 나만의 명령어를 만드는 것 — 레시피 작성하기',
      },
      {
        key: 'while', label: 'while', desc: '조건반복', progress: 0, fillClass: 'btp-fill-none',
        lines: 4,
        code: 'n = 3\nwhile n > 0:\n    print(n)\n    n -= 1',
        output: '3\n2\n1',
        hint: '💡 while 은 조건이 참인 동안 계속 반복 — 신호등이 빨간불일 때 기다리기',
      },
      {
        key: 'dict', label: 'dict', desc: '딕셔너리', progress: 0, fillClass: 'btp-fill-none',
        lines: 3,
        code: 'person = dict(name="철수", age=10)\nprint(person["name"])\nprint(person["age"])',
        output: '철수\n10',
        hint: '💡 dict 는 이름표가 붙은 서랍장 — 키로 값을 꺼내요',
      },
      {
        key: 'class', label: 'class', desc: '클래스', progress: 0, fillClass: 'btp-fill-none',
        lines: 5,
        code: 'class Dog:\n    def bark(self):\n        print("멍멍!")\n\nDog().bark()',
        output: '멍멍!',
        hint: '💡 class 는 설계도 — 강아지 설계도로 진짜 강아지를 만들어요',
      },
      {
        key: 'try', label: 'try', desc: '예외처리', progress: 0, fillClass: 'btp-fill-none',
        lines: 4,
        code: 'try:\n    print(10 / 0)\nexcept ZeroDivisionError:\n    print("0으로 못 나눠요!")',
        output: '0으로 못 나눠요!',
        hint: '💡 try/except 는 안전망 — 오류가 나도 프로그램이 멈추지 않아요',
      },
      {
        key: 'lambda', label: 'lambda', desc: '람다', progress: 0, fillClass: 'btp-fill-none',
        lines: 2,
        code: 'double = lambda x: x * 2\nprint(double(5))',
        output: '10',
        hint: '💡 lambda 는 이름 없는 미니 함수 — 일회용 메모처럼 간단하게',
      },
    ],
  },
]

export default function CodeViewer({ onBack }) {
  const [activeKw, setActiveKw] = useState(null)

  const lineNums = activeKw
    ? activeKw.code.split('\n').map((_, i) => i + 1).join('\n')
    : '1'

  return (
    <div className="btp-page">
      {/* 헤더 */}
      <div className="btp-header">
        <button className="btp-back-btn" onClick={onBack}>✕</button>
        <h1 className="btp-title">🐍 코드를 배워요!</h1>
        <p className="btp-subtitle">키워드를 눌러 코드 예시를 확인하세요</p>
      </div>

      <div className="btp-scroll">
        {/* 코드 미리보기 패널 */}
        <div className="btp-preview-panel">
          <div className="btp-code-area">
            <pre className="btp-line-nums">{lineNums}</pre>
            <pre className="btp-code-content">
              {activeKw
                ? activeKw.code
                : '___("안녕하세요!")'}
            </pre>
          </div>
          <div className="btp-output-area">
            <div className="btp-output-label">출력 결과</div>
            <div className={`btp-output-text${!activeKw ? ' btp-output-empty' : activeKw.outputStyle === 'input' ? ' btp-output-input' : ''}`}>
              {activeKw ? activeKw.output : '← 키워드를 눌러보세요'}
            </div>
          </div>
        </div>

        <p className="btp-hint-text">
          {activeKw ? activeKw.hint : '💡 아래 키워드 중 하나를 골라 빈칸을 채워보세요'}
        </p>

        {/* 섹션별 키워드 그리드 */}
        {KEYWORD_SECTIONS.map((section, si) => (
          <div key={si}>
            {si > 0 && <div className="btp-divider" />}
            <div className="btp-section-label">{section.label}</div>
            <div className="btp-grid">
              {section.keywords.map(kw => kw.locked ? (
                <div key={kw.key} className="btp-card btp-locked">
                  <span className="btp-lock-icon">🔒</span>
                  <span className="btp-card-desc">???</span>
                  <div className="btp-progress-bar"><div className="btp-progress-fill" /></div>
                </div>
              ) : (
                <div
                  key={kw.key}
                  className={`btp-card${activeKw?.key === kw.key ? ' btp-active' : ''}`}
                  onClick={() => setActiveKw(kw)}
                >
                  <span className="btp-card-keyword">{kw.label}</span>
                  <span className="btp-card-desc">{kw.desc}</span>
                  <div className="btp-progress-bar">
                    <div className={`btp-progress-fill ${kw.fillClass}`} style={{ width: `${kw.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

      </div>
    </div>
  )
}
