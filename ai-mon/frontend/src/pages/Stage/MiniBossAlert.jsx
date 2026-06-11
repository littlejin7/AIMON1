import villainIcon from '../../assets/boss_midcmorg.png'

export default function MiniBossAlert({ onFight }) {
  return (
    <div className="stage-page villain-mode">
      <div
        className="stage-content container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          gap: '1.5rem',
          textAlign: 'center',
        }}
      >
        <img src={villainIcon} alt="미니보스" className="villain-emoji animate-float" />
        <div style={{
          background: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: '16px',
          padding: '1.5rem 2rem',
        }}>
          <h2 style={{ color: '#f38ba8', fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            ‼️ 미니보스 등장!
          </h2>
          <p style={{ color: '#cdd6f4', lineHeight: 1.7 }}>
            "크크크, 내가 코드를 망쳐놨지!<br />과연 날 이길 수 있을까?"
          </p>
        </div>
        <button className="btn btn-danger btn-lg" onClick={onFight}>
          ⚔️ 맞서 싸우기!
        </button>
      </div>
    </div>
  )
}
