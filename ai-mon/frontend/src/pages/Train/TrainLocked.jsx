import { useNavigate } from 'react-router-dom'

export default function TrainLocked() {
  const navigate = useNavigate()
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
