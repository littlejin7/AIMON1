import bossIcon from '../../assets/boss_finalorg.png'

export default function BossIntro({ bossData, errorMsg, onStart }) {
  const freeAttempts = bossData?.free_attempts_per_day ?? 0
  const crownCost = bossData?.crown_cost_from_attempt ?? 1
  const crowns = bossData?.crowns ?? 0
  const costLabel = freeAttempts > 0
    ? `무료 (오늘 ${freeAttempts}회 남음)`
    : crowns >= crownCost
      ? `왕관 ${crownCost}개`
      : `왕관 부족 (${crownCost}개 필요)`

  return (
    <div className="boss-card intro-card card-glass animate-fade-in-up">
      <div className="boss-avatar animate-float">
        <img src={bossIcon} alt="보스" />
      </div>

      <h1 className="boss-title">{bossData?.boss_name || '보스'} 출현!</h1>
      <p className="boss-desc">
        물리치면 <strong>{bossData?.xp_reward} 코인</strong>과 왕관을 얻을 수 있습니다!
      </p>

      {errorMsg && (
        <div style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>
          {errorMsg}
        </div>
      )}

      <div style={{ margin: '8px 0 16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.9rem', color: '#a0a0b0', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>도전 비용:</span>
          <span style={{ color: freeAttempts > 0 ? '#34d399' : crowns >= crownCost ? '#fbbf24' : '#ef4444' }}>{costLabel}</span>
        </div>
        {bossData?.hints_allowed > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>도움말:</span>
            <span>힌트 {bossData?.hints_allowed}회 사용 가능 (👑 소모)</span>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>도움말:</span>
            <span style={{ color: '#ef4444' }}>힌트 사용 불가</span>
          </div>
        )}
      </div>

      <button className="btn btn-primary btn-lg btn-full pulse-btn" onClick={onStart}>
        전투 시작 ⚔️
      </button>
    </div>
  )
}
