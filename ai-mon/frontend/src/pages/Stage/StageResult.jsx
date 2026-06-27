import { useNavigate } from 'react-router-dom'
import EvolutionModal from '../../components/Evolution/Evolution'
import stageClearIcon from '../../assets/boss_midcmlose.png'
import stageFailIcon from '../../assets/boss_midcmorg.png'

export default function StageResult({
  passed,
  finalScore,
  evalTotalCount,
  evalCorrectCount,
  isMinibossPlayed,
  xpAwarded,
  unitInfo,
  stageNum,
  lessonId,
  showAuthModal,
  setShowAuthModal,
  handleMinibossRetry,
  handleRestartFromBeginning,
  resetStageState,
  retryWithNextSet,
  evoModal,
  setEvoModal,
}) {
  const navigate = useNavigate()

  return (
    <div className="stage-result animate-fade-in">
      {/* 진화 모달 */}
      {evoModal && (
        <EvolutionModal
          fromChar={evoModal.fromChar}
          toChar={evoModal.toChar}
          newLevel={evoModal.newLevel}
          onClose={() => setEvoModal(null)}
        />
      )}

      {/* 비로그인 체험 완료 모달 */}
      {showAuthModal && (
        <div className="auth-modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="auth-modal" onClick={e => e.stopPropagation()}>
            <h2>🎉 1-1 클리어!</h2>
            <p>회원가입하면 모든 스테이지를 계속 진행할 수 있어요.</p>
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginBottom: '0.5rem' }}
              onClick={() => navigate('/register')}
            >
              회원가입하기
            </button>
            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginBottom: '0.5rem' }}
              onClick={() => navigate('/auth')}
            >
              이미 계정이 있어요
            </button>
            <button
              className="btn btn-ghost"
              style={{ width: '100%' }}
              onClick={() => setShowAuthModal(false)}
            >
              나중에 할게요
            </button>
          </div>
        </div>
      )}

      {/* 결과 아이콘 */}
      <div className="result-icon animate-float">
        {passed
          ? <img src={stageClearIcon} alt="클리어" />
          : <img src={stageFailIcon} alt="실패" />
        }
      </div>

      <h2 className="result-title">{passed ? '스테이지 클리어!' : '다시 도전해보세요!'}</h2>

      <div className="result-score" style={{ color: passed ? '#10b981' : '#ef4444' }}>
        {finalScore}점
      </div>

      <p className="result-desc">
        {isMinibossPlayed && '미니보스 '}{evalTotalCount}문제 중 {evalCorrectCount}개 정답
      </p>

      {/* XP 보상 */}
      {passed && xpAwarded > 0 && (
        <div className="result-reward" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '16px' }}>
          <span>⭐ 스테이지 완료</span>
          <span style={{ color: '#a6e3a1', fontWeight: 'bold' }}>+{xpAwarded} XP 획득!</span>
        </div>
      )}
      {passed && xpAwarded === 0 && (
        <div className="result-reward" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '16px' }}>
          <span>⭐ 스테이지 재완료</span>
          <span style={{ fontSize: '0.9em', color: '#a0a0b0' }}>이미 보상을 획득했습니다.</span>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="result-actions">
        {passed && unitInfo && (
          <button
            className="btn btn-primary"
            onClick={() => {
              if (stageNum < unitInfo.stages) {
                navigate(`/stage/${lessonId}/${stageNum + 1}`)
                resetStageState()
              } else {
                navigate(`/boss/${lessonId}`)
              }
            }}
          >
            다음 스테이지로 ➔
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => navigate(`/lesson/${lessonId}`)}>
          레슨으로 돌아가기
        </button>
        {!passed && (
          isMinibossPlayed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <button className="btn btn-primary" onClick={handleMinibossRetry}>
                미니보스 다시 도전 ⚔️
              </button>
              <button className="btn btn-secondary" onClick={handleRestartFromBeginning}>
                개념 퀴즈부터 다시 도전 🔄
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={retryWithNextSet}>
              다시 도전 🔄
            </button>
          )
        )}
      </div>
    </div>
  )
}
