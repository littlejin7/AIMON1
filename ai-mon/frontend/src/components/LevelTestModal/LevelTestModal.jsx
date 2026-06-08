import { useState } from 'react'
import slimeIcon from '../../assets/character_slime.png'
import robotIcon from '../../assets/character_robot.png'
import finalGhostIcon from '../../assets/character_final_ghost.png'

// ── 레벨 테스트 문제 (10문항) ──
const LEVEL_TEST_QUESTIONS = [
  {
    id: 'lt1',
    question: 'Python에서 화면에 글자를 출력하는 함수는?',
    choices: ['show()', 'print()', 'display()', 'echo()'],
    answer: 1,
  },
  {
    id: 'lt2',
    question: "다음 코드의 출력 결과는?\n\nprint('a', 'b', sep='-')",
    choices: ['a b', 'ab', 'a-b', 'a, b'],
    answer: 2,
  },
  {
    id: 'lt3',
    question: "f-string 출력 결과는?\n\nname = '에이몬'\nprint(f'[{name}]')",
    choices: ['[f에이몬]', '[name]', '{에이몬]', '[에이몬]'],
    answer: 3,
  },
  {
    id: 'lt4',
    question: "다음 중 리스트를 만드는 올바른 방법은?",
    choices: ['list = (1, 2, 3)', 'list = {1, 2, 3}', 'list = [1, 2, 3]', 'list = <1, 2, 3>'],
    answer: 2,
  },
  {
    id: 'lt5',
    question: "for 반복문으로 1~5를 출력하려면?\n\nfor i in ___:\n    print(i)",
    choices: ['range(5)', 'range(1, 6)', 'range(1, 5)', 'range(0, 5)'],
    answer: 1,
  },
  {
    id: 'lt6',
    question: "다음 코드의 출력은?\n\nprint(10 // 3)",
    choices: ['3.33', '3', '4', '1'],
    answer: 1,
  },
  {
    id: 'lt7',
    question: "함수를 정의하는 키워드는?",
    choices: ['function', 'func', 'def', 'define'],
    answer: 2,
  },
  {
    id: 'lt8',
    question: "다음 코드의 출력은?\n\nx = [1, 2, 3]\nprint(x[-1])",
    choices: ['1', '2', '3', 'Error'],
    answer: 2,
  },
  {
    id: 'lt9',
    question: "딕셔너리에서 키 'name'의 값을 가져오는 방법은?\n\nd = {'name': '에이몬'}",
    choices: ["d('name')", "d['name']", "d.get['name']", "d{name}"],
    answer: 1,
  },
  {
    id: 'lt10',
    question: "다음 코드의 출력은?\n\ndef add(a, b=10):\n    return a + b\nprint(add(5))",
    choices: ['5', '10', '15', 'Error'],
    answer: 2,
  },
]

const LEVEL_RESULT = {
  beginner:     { label: '비기너',        icon: slimeIcon,      color: '#7c3aed', msg: '아기 슬라임 에이몬이 기다려요!',       desc: 'Python 기초부터 차근차근 함께해요 😊' },
  intermediate: { label: '인터미디에이트', icon: robotIcon,      color: '#06b6d4', msg: '로봇 에이몬이 당신을 알아봤어요!',    desc: 'print()는 알고, 더 깊이 파고들 준비 완료!' },
  advanced:     { label: '어드밴스드',    icon: finalGhostIcon, color: '#f59e0b', msg: '파이널 에이몬이 라이벌을 발견했어요!', desc: 'f-string까지 꿰뚫는 당신, 에이몬도 긴장했어요 🔥' },
}

// wrongCount: 틀린 문항 수
function calcLevelResult(wrongCount) {
  if (wrongCount <= 2) return 'advanced'
  if (wrongCount <= 6) return 'intermediate'
  return 'beginner'
}

// ── 레벨 테스트 모달 ──
export default function LevelTestModal({ onClose, onFinish, isLoggedIn }) {
  const [step, setStep]         = useState(0)
  const [wrongCount, setWrongCount] = useState(0)   // ← score → wrongCount
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [levelKey, setLevelKey] = useState(null)

  const q = LEVEL_TEST_QUESTIONS[step - 1]

  const handleSelect = (idx) => {
    if (answered) return
    setSelected(idx)
    setAnswered(true)
    const isWrong = idx !== q.answer
    const newWrongCount = wrongCount + (isWrong ? 1 : 0)
    setTimeout(() => {
      const nextStep = step + 1
      if (nextStep > LEVEL_TEST_QUESTIONS.length) {
        setLevelKey(calcLevelResult(newWrongCount))
        setWrongCount(newWrongCount)
        setStep(LEVEL_TEST_QUESTIONS.length + 1)   // 결과 스텝
      } else {
        setWrongCount(newWrongCount)
        setStep(nextStep)
        setSelected(null)
        setAnswered(false)
      }
    }, 900)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in-up"
        style={{
          background: '#1e1e2e',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '22px', padding: '2rem 1.75rem',
          maxWidth: '420px', width: '100%',
          boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
        }}
      >
        {/* ── 인트로 ── */}
        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔍</div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>내 에이몬 찾기</h2>
            <p style={{ color: 'var(--clr-text-muted)', lineHeight: 1.75, marginBottom: '1.75rem', fontSize: '0.93rem' }}>
              딱 10문제만 풀면 나의 Python 레벨이 나와요!<br />
              결과에 맞는 에이몬이 기다리고 있어요 🎮
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-primary btn-lg" onClick={() => setStep(1)} id="btn-level-test-start">
                🚀 테스트 시작
              </button>
              <button className="btn btn-ghost" onClick={onClose}>닫기</button>
            </div>
          </div>
        )}

        {/* ── 문제 ── */}
        {step >= 1 && step <= LEVEL_TEST_QUESTIONS.length && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--clr-text-muted)', marginBottom: '6px' }}>
                <span>레벨 테스트</span>
                <span>{step} / {LEVEL_TEST_QUESTIONS.length}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99 }}>
                <div style={{
                  height: '100%', borderRadius: 99, background: 'var(--grad-primary)',
                  width: `${(step / LEVEL_TEST_QUESTIONS.length) * 100}%`, transition: 'width 0.35s'
                }} />
              </div>
            </div>

            <p style={{ fontWeight: 700, lineHeight: 1.75, marginBottom: '1.25rem', whiteSpace: 'pre-line', fontSize: '0.95rem' }}>
              {q.question}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {q.choices.map((c, i) => {
                const isCorrect  = i === q.answer
                const isSelected = i === selected
                let bg     = 'rgba(255,255,255,0.04)'
                let border = '1px solid rgba(255,255,255,0.1)'
                if (answered && isSelected && isCorrect)  { bg = 'rgba(16,185,129,0.18)'; border = '1px solid #10b981' }
                else if (answered && isSelected)           { bg = 'rgba(239,68,68,0.15)';  border = '1px solid #ef4444' }
                else if (answered && isCorrect)            { bg = 'rgba(16,185,129,0.08)'; border = '1px solid rgba(16,185,129,0.35)' }
                return (
                  <button
                    key={i}
                    id={`lt-q${step}-c${i}`}
                    onClick={() => handleSelect(i)}
                    style={{
                      background: bg, border, borderRadius: '10px',
                      padding: '0.75rem 1rem', textAlign: 'left',
                      cursor: answered ? 'default' : 'pointer',
                      color: 'var(--clr-text)', fontSize: '0.9rem',
                      transition: 'all 0.2s', fontWeight: isSelected ? 700 : 400,
                    }}
                  >
                    {answered && isCorrect && '✅ '}
                    {answered && isSelected && !isCorrect && '❌ '}
                    {c}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 결과 ── */}
        {step === LEVEL_TEST_QUESTIONS.length + 1 && levelKey && (() => {
          const res = LEVEL_RESULT[levelKey]
          return (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '0.75rem', filter: `drop-shadow(0 0 24px ${res.color}99)` }}>
                <img src={res.icon} alt={res.label} className="home-result-icon" />
              </div>
              <div style={{
                display: 'inline-block', background: res.color + '22',
                border: `1px solid ${res.color}55`, borderRadius: 99,
                padding: '4px 16px', fontSize: '0.75rem', fontWeight: 800,
                color: res.color, marginBottom: '1rem', letterSpacing: '0.06em'
              }}>
                {res.label} 유형!
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>{res.msg}</h2>
              <p style={{ color: 'var(--clr-text-muted)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1.75rem' }}>
                {res.desc}<br />
                <strong style={{ color: 'var(--clr-primary-lt)' }}>
                  {isLoggedIn ? '설정을 완료하면 레벨에 맞는 에이몬이 분양됩니다! 🔥' : '지금 가입하면 에이몬이 바로 시작돼요! 🔥'}
                </strong>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => onFinish(levelKey)}
                  id="btn-level-test-register"
                >
                  {isLoggedIn ? '✨ 에이몬 레벨 설정하기' : '✨ 가입하고 에이몬 받기'}
                </button>
                <button className="btn btn-ghost" onClick={onClose}>
                  {isLoggedIn ? '취소' : '나중에 할게요'}
                </button>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
