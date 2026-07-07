import endbossClearIcon from '../../assets/endboss_finalvic.png'
import endbossFailIcon  from '../../assets/boss_finalfail.png'

export default function EndBossResult({
  phase,
  clearResult,
  selectedLevel,
  levelUpMessage,
  onRetry,
  onNavigateLesson,
}) {
  const isCleared = phase === 'cleared'
  const isReplayClear = clearResult?.already_cleared === true
  // 신규 계약: reward.coin_delta / reward.gp_delta. 구 응답(xp_awarded) 은 폴백.
  const coinAwarded = clearResult?.reward?.coin_delta ?? clearResult?.xp_awarded ?? 15000
  const gpAwarded = clearResult?.reward?.gp_delta ?? 0
  const crownsAwarded = clearResult?.crowns_awarded ?? 15
  const evolved = clearResult?.evolution?.evolved === true
  const levelLabel = {
    beginner: '초급',
    intermediate: '중급',
    advanced: '고급',
  }[selectedLevel] || '난이도'
  
  return (
    <div className="boss-card result-card card-glass animate-fade-in-up">
      <div className={`result-crown ${isCleared ? 'animate-float' : ''}`}>
        <img
          src={isCleared ? endbossClearIcon : endbossFailIcon}
          alt={isCleared ? '엔드보스 클리어' : '실패'}
        />
      </div>

      {isCleared ? (
        <>
          <h1 className="result-title" style={{ color: '#f59e0b' }}>엔드보스 처치 완료!</h1>
          <p className="result-desc">
            {isReplayClear
              ? '다시 정복했습니다. 이미 클리어한 레벨이라 추가 보상은 지급되지 않습니다.'
              : '훌륭합니다! 엔드보스를 쓰러뜨리고 거대한 전리품을 획득했습니다.'}
          </p>

          {/* 진화 성공 메시지를 보상보다 먼저 표시 */}
          {!isReplayClear && evolved && (
            <div className="result-evolution" style={{ margin: '20px 0 0', padding: '14px 16px', background: 'rgba(245,158,11,0.15)', borderRadius: '12px', border: '1px dashed #f59e0b', textAlign: 'center' }}>
              <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '1.15rem' }}>
                ✨ AI-Mon이 진화했습니다!
              </span>
            </div>
          )}

          <div className="result-rewards" style={{ margin: '24px 0', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
            {isReplayClear ? (
              <>
                <div className="reward-item" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                  <span className="reward-icon">↻</span>
                  <span style={{ fontWeight: 700, color: '#f9e2af', marginLeft: '8px' }}>
                    재도전 완료 · 추가 보상 없음
                  </span>
                </div>
                <div className="reward-item" style={{ fontSize: '1rem', marginBottom: '8px' }}>
                  <span className="reward-icon">💳</span>
                  <span style={{ fontWeight: 700, color: '#cdd6f4', marginLeft: '8px' }}>
                    이미 획득한 인증카드와 칭호는 유지됩니다.
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="reward-item" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                  <span className="reward-icon">🪙</span>
                  <span style={{ fontWeight: 700, color: '#a6e3a1', marginLeft: '8px' }}>
                    +{coinAwarded.toLocaleString()} 코인 획득!
                  </span>
                </div>
                {gpAwarded > 0 && (
                  <div className="reward-item" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                    <span className="reward-icon">💠</span>
                    <span style={{ fontWeight: 700, color: '#89b4fa', marginLeft: '8px' }}>
                      +{gpAwarded.toLocaleString()} GP 획득!
                    </span>
                  </div>
                )}
                <div className="reward-item" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                  <span className="reward-icon">👑</span>
                  <span style={{ fontWeight: 700, color: '#f9e2af', marginLeft: '8px' }}>
                    +{crownsAwarded.toLocaleString()} 왕관 획득!
                  </span>
                </div>
                <div className="reward-item" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                  <span className="reward-icon">💳</span>
                  <span style={{ fontWeight: 700, color: '#f9e2af', marginLeft: '8px' }}>
                    {levelLabel} 엔드보스 인증카드
                  </span>
                </div>
              </>
            )}
            {levelUpMessage && (
              <div className="reward-item" style={{ fontSize: '1.1rem', marginTop: '12px', padding: '8px', background: 'rgba(166,227,161,0.15)', borderRadius: '8px', border: '1px dashed #a6e3a1' }}>
                <span style={{ fontWeight: 700, color: '#a6e3a1' }}>{levelUpMessage}</span>
              </div>
            )}
          </div>

          <button className="btn btn-primary btn-lg btn-full" onClick={onNavigateLesson}>
            보스 클리어!
          </button>
        </>
      ) : (
        <>
          <h1 className="result-title" style={{ color: '#f38ba8' }}>엔드보스 처치 실패...</h1>
          <p className="result-desc">아쉽네요. 엔드보스의 체력을 다 깎지 못했습니다.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
            <button className="btn btn-primary btn-lg btn-full pulse-btn" onClick={onRetry}>
              프로젝트 선택으로 돌아가기
            </button>
            <button className="btn btn-secondary btn-full" onClick={onNavigateLesson}>
              레슨으로 돌아가기
            </button>
          </div>
        </>
      )}
    </div>
  )
}
