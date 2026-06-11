import { LEVEL_TEST_QUESTIONS } from './levelTestData'

export default function LevelTestQuestion({ step, selected, answered, onSelect }) {
  const q = LEVEL_TEST_QUESTIONS[step - 1]

  return (
    <div>
      {/* 진행 바 */}
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

      {/* 문제 */}
      <p style={{ fontWeight: 700, lineHeight: 1.75, marginBottom: '1.25rem', whiteSpace: 'pre-line', fontSize: '0.95rem' }}>
        {q.question}
      </p>

      {/* 선택지 */}
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
              onClick={() => onSelect(i)}
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
  )
}
