import { LEVEL_TEST_QUESTIONS } from './levelTestData'

const KEYS = ['A', 'B', 'C', 'D']

const DIFF_META = {
  beginner:     { dots: [true, false, false], label: '난이도 쉬움',   color: '#4ADE80' },
  intermediate: { dots: [true, true,  false], label: '난이도 보통',   color: '#FAC775' },
  advanced:     { dots: [true, true,  true],  label: '난이도 어려움', color: '#FF6B6B' },
}

const TYPE_BADGE = {
  beginner:     { label: '📋 개념 이해', bg: '#EEEDFE', color: '#534AB7' },
  intermediate: { label: '💻 출력 예측', bg: '#E0F2FE', color: '#0369A1' },
  advanced:     { label: '🧠 고급 개념', bg: '#F3E8FF', color: '#6D28D9' },
}

export default function LevelTestQuestion({
  step, total, selected, timer,
  onSelect, onNext, onSkip, onBack,
}) {
  const q    = LEVEL_TEST_QUESTIONS[step - 1]
  const diff = DIFF_META[q.level]
  const badge = TYPE_BADGE[q.level]
  const pct   = Math.round((step / total) * 100)
  const isLast = step === total

  return (
    <div>
      {/* ── 헤더 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px 12px',
      }}>
        <button
          onClick={onBack}
          style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: '#F4F3FF', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '17px', color: '#534AB7',
          }}
        >←</button>
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#26215C', letterSpacing: '-.3px' }}>
          레벨 테스트
        </span>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#7F77DD', fontVariantNumeric: 'tabular-nums' }}>
          {timer}
        </span>
      </div>

      {/* ── 진행바 ── */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', color: '#9B96D0' }}>
            문제 {step} / {total}{isLast ? ' · 마지막!' : ''}
          </span>
          <span style={{ fontSize: '11px', color: '#7F77DD', fontWeight: 500 }}>진행 {pct}%</span>
        </div>
        <div style={{ height: '5px', background: '#EEEDFE', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '99px',
            background: 'linear-gradient(90deg,#7F77DD,#534AB7)',
            width: `${pct}%`, transition: 'width 0.4s cubic-bezier(.22,1,.36,1)',
          }} />
        </div>
      </div>

      {/* ── 바디 ── */}
      <div style={{ padding: '0 20px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* 난이도 + 유형 배지 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {diff.dots.map((on, i) => (
              <div key={i} style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: on ? diff.color : '#E5E2F8',
              }} />
            ))}
            <span style={{ fontSize: '11px', color: '#9B96D0', marginLeft: '4px' }}>{diff.label}</span>
          </div>
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '3px 10px',
            borderRadius: '20px', letterSpacing: '.3px',
            background: badge.bg, color: badge.color,
          }}>
            {badge.label}
          </span>
        </div>

        {/* 문제 카드 */}
        <div style={{
          background: '#F9F8FE', border: '0.5px solid #E5E2F8',
          borderRadius: '18px', padding: '16px',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          <p style={{
            fontSize: '13.5px', fontWeight: 500, color: '#26215C',
            lineHeight: 1.6, whiteSpace: 'pre-line', margin: 0,
          }}>
            {q.question}
          </p>

          {/* 선택지 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {q.choices.map((c, i) => {
              const isSelected = i === selected

              let borderColor = '#E8E6FA'
              let bg = 'white'
              let keyBg = 'transparent'
              let keyBorderColor = '#C4BFEE'
              let keyColor = '#9B96D0'
              let keyLabel = KEYS[i]

              if (isSelected) {
                borderColor = '#7F77DD'; bg = '#F4F3FF'
                keyBg = '#7F77DD'; keyBorderColor = '#7F77DD'; keyColor = 'white'
              }

              return (
                <button
                  key={i}
                  id={`lt-q${step}-c${i}`}
                  onClick={() => onSelect(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    border: `1.5px solid ${borderColor}`, borderRadius: '13px',
                    padding: '11px 14px', cursor: 'pointer',
                    background: bg, textAlign: 'left', width: '100%',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
                    border: `1.5px solid ${keyBorderColor}`, background: keyBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 600, color: keyColor,
                    transition: 'all .15s',
                  }}>
                    {keyLabel}
                  </div>
                  <span style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: '12.5px', color: '#26215C', whiteSpace: 'pre-line', fontWeight: 600,
                  }}>
                    {c}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 다음 버튼 */}
        <button
          onClick={onNext}
          style={{
            width: '100%', padding: '15px',
            background: selected !== null ? '#7F77DD' : '#C4BFEE',
            color: 'white', border: 'none', borderRadius: '14px',
            fontSize: '15px', fontWeight: 600,
            cursor: selected !== null ? 'pointer' : 'not-allowed',
            boxShadow: selected !== null ? '0 4px 0 #534AB7' : 'none',
            transition: 'all .2s',
          }}
        >
          {isLast ? '제출하고 결과 보기 🎉' : '다음 문제 →'}
        </button>

        {/* 건너뛰기 */}
        <button
          onClick={onSkip}
          style={{
            width: '100%', padding: '13px',
            background: 'transparent', color: '#C4BFEE',
            border: '1.5px solid #F0EFFE', borderRadius: '14px',
            fontSize: '12px', fontWeight: 500, cursor: 'pointer',
          }}
        >
          이 문제 건너뛰기
        </button>
      </div>
    </div>
  )
}
