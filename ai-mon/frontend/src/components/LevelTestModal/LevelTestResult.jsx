const LEVEL_META = {
  beginner:     { label: '초급', color: '#7F77DD', emoji: '🐣', desc: '기초부터 차근차근 시작해요!\n아기 슬라임 에이몬이 기다려요 😊' },
  intermediate: { label: '중급', color: '#06b6d4', emoji: '🌱', desc: '기초 개념은 탄탄해요!\n자료구조부터 시작하면 빠르게 성장할 수 있어요.' },
  advanced:     { label: '고급', color: '#534AB7', emoji: '🔥', desc: '데코레이터·비동기까지 꿰뚫는 당신,\n에이몬도 긴장했어요 🔥' },
}

// 각 레벨 최대 문제 수
const LEVEL_MAX = { beginner: 4, intermediate: 3, advanced: 3 }

function ScoreRing({ score }) {
  const r = 46
  const circ = 2 * Math.PI * r  // ≈ 289
  const offset = circ * (1 - score / 100)
  return (
    <div style={{ position: 'relative', width: '110px', height: '110px' }}>
      <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="#EEEDFE" strokeWidth="9"/>
        <circle
          cx="55" cy="55" r={r} fill="none"
          stroke="url(#rg)" strokeWidth="9"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7F77DD"/>
            <stop offset="100%" stopColor="#534AB7"/>
          </linearGradient>
        </defs>
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: '28px', fontWeight: 800, color: '#26215C' }}>{score}</div>
        <div style={{ fontSize: '10px', color: '#9B96D0', fontWeight: 500 }}>점 / 100</div>
      </div>
    </div>
  )
}

function RadarChart({ syntax = 0, structure = 0, control = 0 }) {
  const cx = 110
  const cy = 115
  const maxR = 75
  const cos30 = 0.866
  const sin30 = 0.5

  const getPt = (score, angleType) => {
    const r = (score / 100) * maxR
    if (angleType === 'syntax') {
      return { x: cx, y: cy - r }
    } else if (angleType === 'structure') {
      return { x: cx - r * cos30, y: cy + r * sin30 }
    } else {
      return { x: cx + r * cos30, y: cy + r * sin30 }
    }
  }

  const pSyntax = getPt(syntax, 'syntax')
  const pStructure = getPt(structure, 'structure')
  const pControl = getPt(control, 'control')

  const pointsStr = `${pSyntax.x},${pSyntax.y} ${pControl.x},${pControl.y} ${pStructure.x},${pStructure.y}`
  const levels = [25, 50, 75, 100]

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '20px 0', background: '#F9F8FE', borderRadius: '20px',
      boxShadow: 'inset 0 2px 8px rgba(83,74,183,0.06)',
      position: 'relative'
    }}>
      <svg width="220" height="230" viewBox="0 0 220 230">
        {levels.map((lv) => {
          const s = getPt(lv, 'syntax')
          const str = getPt(lv, 'structure')
          const ctrl = getPt(lv, 'control')
          return (
            <polygon
              key={lv}
              points={`${s.x},${s.y} ${ctrl.x},${ctrl.y} ${str.x},${str.y}`}
              fill="none"
              stroke="#E5E2F8"
              strokeWidth="1.5"
              strokeDasharray={lv === 100 ? '0' : '3 3'}
            />
          )
        })}

        <line x1={cx} y1={cy} x2={cx} y2={cy - maxR} stroke="#E5E2F8" strokeWidth="1.5" />
        <line x1={cx} y1={cy} x2={cx - maxR * cos30} y2={cy + maxR * sin30} stroke="#E5E2F8" strokeWidth="1.5" />
        <line x1={cx} y1={cy} x2={cx + maxR * cos30} y2={cy + maxR * sin30} stroke="#E5E2F8" strokeWidth="1.5" />

        <polygon
          points={pointsStr}
          fill="url(#chartGrad)"
          stroke="#7F77DD"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <animate
            attributeName="points"
            dur="1s"
            repeatCount="1"
            from={`${cx},${cy} ${cx},${cy} ${cx},${cy}`}
            to={pointsStr}
            fill="freeze"
          />
        </polygon>

        <circle cx={pSyntax.x} cy={pSyntax.y} r="5" fill="#534AB7" stroke="#ffffff" strokeWidth="2" />
        <circle cx={pStructure.x} cy={pStructure.y} r="5" fill="#534AB7" stroke="#ffffff" strokeWidth="2" />
        <circle cx={pControl.x} cy={pControl.y} r="5" fill="#534AB7" stroke="#ffffff" strokeWidth="2" />

        <text x={cx} y={cy - maxR - 10} textAnchor="middle" fill="#26215C" fontSize="12" fontWeight="700">
          기본 문법 ({syntax}%)
        </text>
        <text x={cx - maxR * cos30 - 15} y={cy + maxR * sin30 + 15} textAnchor="start" fill="#26215C" fontSize="12" fontWeight="700">
          자료구조 ({structure}%)
        </text>
        <text x={cx + maxR * cos30 + 15} y={cy + maxR * sin30 + 15} textAnchor="middle" fill="#26215C" fontSize="12" fontWeight="700">
          논리 제어 ({control}%)
        </text>

        <defs>
          <linearGradient id="chartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7F77DD" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#534AB7" stopOpacity="0.85" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

export default function LevelTestResult({
  levelKey, correctByLevel, categoryPercentages = { syntax: 0, structure: 0, control: 0 }, totalCorrect, total, skipped,
  isLoggedIn, updatedUser, onFinish, onClose,
}) {
  const meta = LEVEL_META[levelKey]
  if (!meta) return null

  const score = Math.round((totalCorrect / total) * 100)

  const topDiff =
    correctByLevel.advanced     > 0 ? '🔴 어려움' :
    correctByLevel.intermediate > 0 ? '🟡 보통'   :
    correctByLevel.beginner     > 0 ? '🟢 쉬움'   : '-'

  const stats = [
    { label: '정답률',         val: `${totalCorrect} / ${total} (${score}%)` },
    { label: '최고 난이도 정답', val: topDiff },
    { label: '건너뛴 문제',    val: `${skipped}문제` },
  ]

  return (
    <div>
      {/* ── 결과 헤더 ── */}
      <div style={{
        background: 'linear-gradient(160deg,#F0EFFE 0%,#E4E0F8 100%)',
        padding: '28px 24px 20px', borderRadius: '24px 24px 0 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '14px', textAlign: 'center',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#7F77DD', letterSpacing: '1px' }}>
          TEST RESULT
        </div>

        <ScoreRing score={score} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '8px 20px', borderRadius: '99px',
          background: meta.color + '22', border: `1px solid ${meta.color}55`,
          fontSize: '15px', fontWeight: 700, color: meta.color,
        }}>
          {meta.emoji} {meta.label} 유형!
        </div>

        <div style={{ fontSize: '15px', fontWeight: 600, color: '#26215C', lineHeight: 1.7 }}>
          초급 · 중급 · 고급 중에<br/>너의 레벨은{' '}
          <span style={{ color: meta.color }}>{meta.label}</span>이야!
        </div>

        <div style={{ fontSize: '13px', color: '#534AB7', lineHeight: 1.65, whiteSpace: 'pre-line' }}>
          {meta.desc}
        </div>
      </div>

      {/* ── 상세 결과 ── */}
      <div style={{ padding: '16px 20px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* 점수 요약 */}
        <div style={{ background: '#F9F8FE', borderRadius: '16px', padding: '14px 16px' }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: i < stats.length - 1 ? '1px solid #F0EFFE' : 'none',
            }}>
              <span style={{ fontSize: '12px', color: '#9B96D0' }}>{s.label}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#26215C' }}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* 영역별 분석 */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#26215C', marginBottom: '12px' }}>
            📊 영역별 분석
          </div>
          <RadarChart
            syntax={categoryPercentages.syntax}
            structure={categoryPercentages.structure}
            control={categoryPercentages.control}
          />
        </div>

        {/* CTA */}
        <button
          id="btn-level-test-register"
          onClick={() => onFinish(levelKey, updatedUser)}
          style={{
            width: '100%', padding: '15px',
            background: '#7F77DD', color: 'white',
            border: 'none', borderRadius: '14px',
            fontSize: '15px', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 0 #534AB7',
          }}
        >
          {isLoggedIn ? `🚀 ${meta.label}으로 학습 시작하기` : '✨ 가입하고 에이몬 받기'}
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '13px',
            background: 'transparent', color: '#9B96D0',
            border: '1.5px solid #E5E2F8', borderRadius: '14px',
            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
          }}
        >
          {isLoggedIn ? '취소' : '나중에 할게요'}
        </button>
      </div>
    </div>
  )
}
