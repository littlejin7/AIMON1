import villainIcon from '../../assets/boss_midcmorg.png'

export default function MiniBossAlert({ onFight }) {
  return (
    <div className="stage-page villain-mode">
      <div className="boss-container" style={{ paddingTop: '2rem' }}>
        <div className="boss-card intro-card card-glass animate-fade-in-up">
          <div className="boss-avatar animate-float">
            <img src={villainIcon} alt="미니보스" />
          </div>
          <h1 className="boss-title">‼️ 미니보스 등장!</h1>
          <p className="boss-desc">
            "크크크, 내가 코드를 망쳐놨지!<br />과연 날 이길 수 있을까?"
          </p>
          <button className="btn btn-primary btn-lg btn-full pulse-btn" onClick={onFight}>
            ⚔️ 맞서 싸우기!
          </button>
        </div>
      </div>
    </div>
  )
}

