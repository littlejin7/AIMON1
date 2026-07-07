export default function TrainResult({ correctCount, total, onDone }) {
  const isPerfect = correctCount === total
  return (
    <div className="tr-page" style={{ textAlign: 'center', paddingTop: '4rem' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{isPerfect ? '🎉' : '👏'}</div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1A1A2E', marginBottom: '0.5rem' }}>
        {isPerfect ? '완벽합니다!' : '훈련 완료!'}
      </h2>
      <p style={{ color: '#7A7A94', marginBottom: '2rem' }}>
        {total}문제 중 {correctCount}개 정답
      </p>
      {isPerfect && (
        <div style={{ background: '#EAF3DE', borderRadius: 12, padding: '1rem', marginBottom: '2rem' }}>
          <strong style={{ color: '#3B6D11' }}>완벽 보상 획득!</strong>
          <p style={{ margin: '0.5rem 0 0', color: '#3B6D11' }}>+100 코인 / +1 왕관 👑</p>
        </div>
      )}
      <button className="tr-go-btn" onClick={onDone}>훈련 종료</button>
    </div>
  )
}
