import bossIcon    from '../../assets/boss_finalorg.png'
import endbossIcon from '../../assets/endboss_finalorg.png'

export default function BossIntro({ bossData, isFinalBoss, errorMsg, onStart }) {
  return (
    <div className="boss-card intro-card card-glass animate-fade-in-up">
      <div className="boss-avatar animate-float">
        <img src={isFinalBoss ? endbossIcon : bossIcon} alt="보스" />
      </div>

      <h1 className="boss-title">{bossData?.boss_name} 출현!</h1>
      <p className="boss-desc">
        Unit {isFinalBoss ? 'Final' : bossData?.unit_id}의 모든 지식을 시험할 보스가 나타났습니다.<br />
        물리치면 특별한 인증카드와 <strong>{bossData?.xp_reward} XP</strong>를 얻을 수 있습니다!
      </p>

      {errorMsg && (
        <div style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>
          {errorMsg}
        </div>
      )}

      <div style={{ margin: '8px 0 16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.9rem', color: '#a0a0b0', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>도전 비용:</span>
          <span style={{ color: '#34d399' }}>무료 (오늘 {bossData?.free_attempts_per_day}회 남음)</span>
        </div>
        {bossData?.hints_allowed > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>도움말:</span>
            <span>힌트 {bossData?.hints_allowed}회 사용 가능 (👑 소모)</span>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>도움말:</span>
            <span style={{ color: '#ef4444' }}>파이널 보스 (힌트 사용 불가)</span>
          </div>
        )}
      </div>

      <button className="btn btn-primary btn-lg btn-full pulse-btn" onClick={onStart}>
        전투 시작 ⚔️
      </button>
    </div>
  )
}
