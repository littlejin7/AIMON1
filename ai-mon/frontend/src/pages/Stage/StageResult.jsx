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
  gpAwarded,
  unitInfo,
  stageNum,
  lessonId,
  isGuestTrial = false,
  handleMinibossRetry,
  handleRestartFromBeginning,
  resetStageState,
  retryWithNextSet,
  evoModal,
  setEvoModal,
}) {
  const navigate = useNavigate()
  const resultTitle = isGuestTrial
    ? '무료 체험 결과'
    : passed ? '스테이지 클리어!' : '다시 도전해보세요!'
  const resultDesc = isGuestTrial
    ? passed
      ? '1-1 체험 기록은 가입 후 이어받을 수 있어요.'
      : '가입하면 다시 도전하고 다음 스테이지를 이어가세요!'
    : `${isMinibossPlayed ? '미니보스 ' : ''}${evalTotalCount}문제 중 ${evalCorrectCount}개 정답`

  return (
    <div className="stage-result animate-fade-in">
      {/* 진화 모달 */}
      {evoModal && (
        <EvolutionModal
          fromChar={evoModal.fromChar}
          toChar={evoModal.toChar}
          stage={evoModal.stage}
          onClose={() => setEvoModal(null)}
        />
      )}

      {/* 결과 아이콘 */}
      <div
        className="result-icon animate-float"
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
      >
        {passed
          ? <img src={stageClearIcon} alt="클리어" />
          : <img src={stageFailIcon} alt="실패" />
        }
      </div>

      <h2 className="result-title">{resultTitle}</h2>

      <div className="result-score" style={{ color: passed ? '#10b981' : '#ef4444' }}>
        {finalScore}점
      </div>

      <p className="result-desc">{resultDesc}</p>

      {/* 코인(+GP) 보상 */}
      {!isGuestTrial && passed && xpAwarded > 0 && (
        <div className="result-reward" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '16px' }}>
          <span>⭐ 스테이지 완료</span>
          <span style={{ color: '#a6e3a1', fontWeight: 'bold' }}>
            +{xpAwarded} 코인 획득!{gpAwarded > 0 ? ` · +${gpAwarded} GP` : ''}
          </span>
        </div>
      )}
      {!isGuestTrial && passed && xpAwarded === 0 && (
        <div className="result-reward" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '16px' }}>
          <span>⭐ 스테이지 재완료</span>
          <span style={{ fontSize: '0.9em', color: '#a0a0b0' }}>이미 보상을 획득했습니다.</span>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="result-actions">
        {isGuestTrial ? (
          <button
            className="btn btn-primary"
            onClick={() => navigate('/register?from=trial')}
          >
            {passed ? '다음 스테이지 계속하기' : '가입하고 다시 도전하기'}
          </button>
        ) : passed && unitInfo && (
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
        <button className="btn btn-secondary" onClick={() => navigate(isGuestTrial ? '/lesson' : `/lesson/${lessonId}`)}>
          {isGuestTrial ? '레슨으로 돌아가기' : '홈으로 돌아가기'}
        </button>
        {!isGuestTrial && !passed && (
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
