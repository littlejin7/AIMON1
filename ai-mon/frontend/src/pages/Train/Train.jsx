import './Train.css'

export default function Train() {
  return (
    <div className="train-page">
      <div className="train-hero">
        <div className="train-hero-icon animate-float">🔄</div>
        <h1 className="train-hero-title">훈련</h1>
        <p className="train-hero-desc">
          유닛을 완료하면 오답 복습과 반복 학습이<br />
          이곳에서 열립니다
        </p>
      </div>

      <div className="train-locked-notice container">
        <div className="train-locked-card card-glass">
          <span className="train-locked-icon">🔒</span>
          <p className="train-locked-text">
            Unit 1 보스를 클리어하면<br />
            훈련 모드가 해금됩니다!
          </p>
          <div className="train-locked-sub">
            <span>✅ 스테이지 퀴즈 완료</span>
            <span>→</span>
            <span>⚔️ 유닛 보스 클리어</span>
            <span>→</span>
            <span>🔓 훈련 해금</span>
          </div>
        </div>
      </div>
    </div>
  )
}
