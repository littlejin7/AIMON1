import { useNavigate } from 'react-router-dom'
import QuizCard from '../../components/QuizCard/QuizCard'
import villainIcon from '../../assets/boss_midcmorg.png'

export default function StageQuiz({
  lessonId,
  stageNum,
  questions,
  current,
  score,
  minibossStartIndex,
  handleAnswer,
  handleNext,
}) {
  const navigate = useNavigate()
  const currentQ = questions[current]
  const isVillain = currentQ?.quiz_category === 'miniboss'

  return (
    <div className={`stage-page ${isVillain ? 'villain-mode' : ''}`}>
      {/* 헤더 */}
      <div className="stage-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/lesson/${lessonId}`)}>
          ✕
        </button>
        <div className="stage-progress-section">
          <div className="stage-progress-label">
            <span>UNIT {lessonId} · Stage {stageNum}</span>
            <span>
              {minibossStartIndex !== null
                ? `문제 ${current - minibossStartIndex + 1} / ${questions.length - minibossStartIndex}`
                : `문제 ${current + 1} / ${Math.min(10, questions.length)}`
              }
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{
                width: `${minibossStartIndex !== null
                  ? ((current - minibossStartIndex + 1) / (questions.length - minibossStartIndex)) * 100
                  : ((current + 1) / Math.min(10, questions.length)) * 100
                }%`
              }}
            />
          </div>
        </div>
        <div className="stage-score-badge">
          ⭐ {score}
        </div>
      </div>

      {/* 퀴즈 영역 */}
      <div className="stage-content container">
        {isVillain && (
          <div className="villain-intro animate-fade-in-up">
            <img src={villainIcon} alt="빌런" className="villain-emoji" />
            <div className="villain-speech">
              "엉뚱한 코드로 널 괴롭혀주지! 코드몬 등장!"
            </div>
          </div>
        )}
        <QuizCard
          key={current}
          question={currentQ}
          onAnswer={handleAnswer}
          onNext={handleNext}
        />
      </div>
    </div>
  )
}
