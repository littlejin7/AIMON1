import { LEVEL_RESULT } from './levelTestData'

export default function LevelTestResult({ levelKey, isLoggedIn, onFinish, onClose }) {
  const res = LEVEL_RESULT[levelKey]
  if (!res) return null

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
}
