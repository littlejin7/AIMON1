export default function LevelTestIntro({ onStart, onClose }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--clr-primary-lt)' }}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>내 에이몬 찾기</h2>
      <p style={{ color: 'var(--clr-text-muted)', lineHeight: 1.75, marginBottom: '1.75rem', fontSize: '0.93rem' }}>
        딱 10문제만 풀면 나의 Python 레벨이 나와요!<br />
        결과에 맞는 에이몬이 기다리고 있어요 🎮
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <button className="btn btn-primary btn-lg" onClick={onStart} id="btn-level-test-start" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 16.5c-1.5 1.5-1.5 4.5 0 4.5 0 1.5 3 1.5 4.5 0L19 7l-5-5L4.5 16.5z"/>
            <path d="M12 8l-4.5 4.5"/>
            <path d="M20 4l-5 1-1 5"/>
          </svg>
          테스트 시작
        </button>
        <button className="btn btn-ghost" onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}
