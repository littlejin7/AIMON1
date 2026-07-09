import bossClearIcon   from '../../assets/boss_finalclear.png'
import bossFailIcon    from '../../assets/boss_finalfail.png'

export default function BossResult({
  phase,
  aiResult,
  bossData,
  levelUpMessage,
  lessonId,
  onRetry,
  onNavigateLesson,
}) {
  const isCleared = phase === 'cleared'
  const freeAttempts = bossData?.free_attempts_per_day ?? 0
  const crownCost = bossData?.crown_cost_from_attempt ?? 1
  const crowns = bossData?.crowns ?? 0
  const retryLabel = freeAttempts > 0
    ? `무료 도전 ${freeAttempts}회 남음 - 재도전할까요?`
    : crowns >= crownCost
      ? `👑 왕관 ${crownCost}개를 소모하고 재도전할까요?`
      : `왕관이 부족합니다 (${crownCost}개 필요)`

  return (
    <div className="boss-card result-card card-glass animate-fade-in-up">
      <div className={`result-crown ${isCleared ? 'animate-float' : ''}`}>
        <img
          src={isCleared ? bossClearIcon : bossFailIcon}
          alt={isCleared ? '클리어' : '실패'}
        />
      </div>

      {isCleared ? (
        <>
          <h1 className="result-title" style={{ color: '#7c3aed' }}>보스 처치완료</h1>
          <p className="result-desc">훌륭합니다! 보스를 쓰러뜨리고 전리품을 획득했습니다.</p>

          <button className="btn btn-primary btn-lg btn-full" style={{ marginTop: '24px' }} onClick={onNavigateLesson}>
            다음 유닛으로 넘어가기
          </button>
        </>
      ) : (
        <>
          <h1 className="result-title" style={{ color: '#f38ba8' }}>보스 처치 실패...</h1>
          <p className="result-desc">아쉽네요. 보스의 체력을 다 깎지 못했습니다.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
            <button
              className="btn btn-primary btn-lg btn-full pulse-btn"
              onClick={onRetry}
              disabled={freeAttempts <= 0 && crowns < crownCost}
            >
              {retryLabel}
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
