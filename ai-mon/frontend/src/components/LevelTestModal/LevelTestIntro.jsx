export default function LevelTestIntro({ onStart, onClose }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔍</div>
      <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>내 에이몬 찾기</h2>
      <p style={{ color: 'var(--clr-text-muted)', lineHeight: 1.75, marginBottom: '1.75rem', fontSize: '0.93rem' }}>
        딱 10문제만 풀면 나의 Python 레벨이 나와요!<br />
        결과에 맞는 에이몬이 기다리고 있어요 🎮
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <button className="btn btn-primary btn-lg" onClick={onStart} id="btn-level-test-start">
          🚀 테스트 시작
        </button>
        <button className="btn btn-ghost" onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}
