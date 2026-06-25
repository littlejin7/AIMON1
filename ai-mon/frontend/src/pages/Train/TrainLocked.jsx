import { useNavigate } from 'react-router-dom'

export default function TrainLocked({ reason = 'unit' }) {
  const navigate = useNavigate()

  if (reason === 'login') {
    return (
      <div className="tr-page">
        <div className="tr-locked-card">
          <div className="tr-locked-icon">🔒</div>
          <h2 className="tr-locked-title">에이팡 잠김</h2>
          <p className="tr-locked-desc">
            로그인하시면 <strong>에이팡</strong> 미니게임을 플레이하고{' '}
            다양한 코딩 학습 모험과 <strong>XP, 왕관</strong> 보상을 받을 수 있습니다!
          </p>
          <button className="tr-go-btn" onClick={() => navigate('/auth')}>
            로그인하러 가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="tr-page">
      <div className="tr-locked-card">
        <div className="tr-locked-icon">🔒</div>
        <h2 className="tr-locked-title">훈련장 잠김</h2>
        <p className="tr-locked-desc">
          <strong>Unit 1</strong>을 모두 완료하면 훈련장이 해금됩니다!
        </p>
        <button className="tr-go-btn" onClick={() => navigate('/lesson')}>
          레슨으로 가기
        </button>
      </div>
    </div>
  )
}
