import bossClearIcon   from '../../assets/boss_finalclear.png'
import bossFailIcon    from '../../assets/boss_finalfail.png'
import endbossClearIcon from '../../assets/endboss_finalvic.png'
import endbossFailIcon  from '../../assets/boss_finalfail.png'

export default function BossResult({
  phase,
  isFinalBoss,
  aiResult,
  levelUpMessage,
  lessonId,
  onRetry,
  onNavigateLesson,
}) {
  const isCleared = phase === 'cleared'

  return (
    <div className="boss-card result-card card-glass animate-fade-in-up">
      <div className={`result-crown ${isCleared ? 'animate-float' : ''}`}>
        <img
          src={isCleared
            ? (isFinalBoss ? endbossClearIcon : bossClearIcon)
            : (isFinalBoss ? endbossFailIcon  : bossFailIcon)
          }
          alt={isCleared ? '클리어' : '실패'}
        />
      </div>

      {isCleared ? (
        <>
          <h1 className="result-title" style={{ color: '#f59e0b' }}>보스 처치 완료!</h1>
          <p className="result-desc">훌륭합니다! 보스를 쓰러뜨리고 전리품을 획득했습니다.</p>

          <div className="result-rewards" style={{ margin: '24px 0', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
            <div className="reward-item" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
              <span className="reward-icon">⭐</span>
              <span style={{ fontWeight: 700, color: '#a6e3a1', marginLeft: '8px' }}>+3000 XP 획득!</span>
            </div>
            <div className="reward-item" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
              <span className="reward-icon">💳</span>
              <span style={{ fontWeight: 700, color: '#f9e2af', marginLeft: '8px' }}>
                {isFinalBoss ? 'Level' : `Unit ${lessonId}`} 클리어 인증카드
              </span>
            </div>
            {aiResult?.crowns_awarded > 0 && (
              <div className="reward-item" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                <span className="reward-icon">👑</span>
                <span style={{ fontWeight: 700, color: '#f59e0b', marginLeft: '8px' }}>+{aiResult.crowns_awarded} 왕관 획득!</span>
              </div>
            )}
            {aiResult?.unlocked_unit !== undefined && aiResult.unlocked_unit <= 8 && (
              <div className="reward-item" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                <span className="reward-icon">🔓</span>
                <span style={{ fontWeight: 700, color: '#60a5fa', marginLeft: '8px' }}>Unit {aiResult.unlocked_unit} 해제!</span>
              </div>
            )}
            {levelUpMessage && (
              <div className="reward-item" style={{ fontSize: '1.1rem', marginTop: '12px', padding: '8px', background: 'rgba(166,227,161,0.15)', borderRadius: '8px', border: '1px dashed #a6e3a1' }}>
                <span style={{ fontWeight: 700, color: '#a6e3a1' }}>{levelUpMessage}</span>
              </div>
            )}
          </div>

          <button className="btn btn-primary btn-lg btn-full" onClick={onNavigateLesson}>
            레슨 홈으로 돌아가기
          </button>
        </>
      ) : (
        <>
          <h1 className="result-title" style={{ color: '#f38ba8' }}>보스 처치 실패...</h1>
          <p className="result-desc">아쉽네요. 보스의 체력을 다 깎지 못했습니다.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
            <button className="btn btn-primary btn-lg btn-full pulse-btn" onClick={onRetry}>
              👑 왕관 1개를 소모하고 재도전할까요?
            </button>
            <button className="btn btn-secondary btn-full" onClick={onNavigateLesson}>
              포기하기 (레슨으로 돌아가기)
            </button>
          </div>
        </>
      )}
    </div>
  )
}
