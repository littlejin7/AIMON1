import { useNavigate } from 'react-router-dom'

export default function TrainLocked({ reason = 'unit' }) {
  const navigate = useNavigate()

  if (reason === 'login') {
    return (
      <div className="tr-page app-locked-screen">
        <div className="tr-locked-card app-locked-card">
          <button
            className="app-locked-close no-3d"
            onClick={() => navigate('/')}
            aria-label="닫기"
          >
            ✕
          </button>
          <div className="app-locked-icon">🔒</div>
          <h2 className="app-locked-title">훈련 잠김</h2>
          <p className="app-locked-desc">
            로그인하시면 <strong>훈련</strong>을 진행하고{' '}
            복습 문제와 학습 보상을 이어서 확인할 수 있습니다!
          </p>
          <button className="tr-go-btn" onClick={() => navigate('/auth')}>
            로그인하러 가기
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="tr-page app-locked-screen">
      <div className="tr-locked-card app-locked-card">
        <button
          className="app-locked-close no-3d"
          onClick={() => navigate('/')}
          aria-label="닫기"
        >
          ✕
        </button>
        <div className="app-locked-icon">🔒</div>
        <h2 className="app-locked-title">훈련장 잠김</h2>
        <p className="app-locked-desc">
          <strong>Unit 1</strong>을 모두 완료하면 훈련장이 해금됩니다!
        </p>
        <button className="tr-go-btn" onClick={() => navigate('/lesson')}>
          레슨으로 가기
        </button>
      </div>
    </div>
  )
}
