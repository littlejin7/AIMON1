import villainIcon from '../../assets/boss_midcmorg.png'
import { useState } from 'react'

export default function MiniBossAlert({ onFight, onClose }) {
  const [fightClicked, setFightClicked] = useState(false)

  const handleFight = () => {
    if (fightClicked) return
    setFightClicked(true)
    try {
      onFight?.()
    } catch (err) {
      console.error('미니보스 시작 처리 실패', err)
    }
  }

  return (
    <div className="stage-page villain-mode">
      <div className="boss-container" style={{ paddingTop: '2rem' }}>
        <div className="boss-card intro-card card-glass animate-fade-in-up">
          <button
            type="button"
            className="miniboss-alert-close no-3d"
            onClick={onClose}
            aria-label="미니보스 시작 화면 닫기"
          >
            ✕
          </button>
          <div
            className="boss-avatar animate-float"
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
          >
            <img src={villainIcon} alt="미니보스" />
          </div>
          <h1 className="boss-title">‼️ 미니보스 등장!</h1>
          <p className="boss-desc">
            "크크크, 내가 코드를 망쳐놨지!<br />과연 날 이길 수 있을까?"
          </p>
          <button
            className="btn btn-primary btn-lg btn-full pulse-btn"
            onClick={handleFight}
            disabled={fightClicked}
          >
            ⚔️ 맞서 싸우기!
          </button>
        </div>
      </div>
    </div>
  )
}
