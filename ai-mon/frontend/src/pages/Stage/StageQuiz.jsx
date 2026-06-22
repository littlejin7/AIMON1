import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../hooks/useAuthStore'
import QuizCard from '../../components/QuizCard/QuizCard'
import villainIcon from '../../assets/boss_midcmorg.png'
import slimeIcon from '../../assets/character_slime.png'
import robotIcon from '../../assets/character_robot.png'
import speechBubbleIcon from '../../assets/character_bubble.png'
import finalGhostIcon from '../../assets/character_final_ghost.png'

const CHARACTER_MAP = {
  slime:         slimeIcon,
  robot:         robotIcon,
  speech_bubble: speechBubbleIcon,
  final_ghost:   finalGhostIcon,
}

export default function StageQuiz({
  lessonId,
  stageNum,
  questions,
  current,
  score,
  minibossStartIndex,
  handleAnswer,
  handleNext,
  unitInfo,
}) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const charSrc = CHARACTER_MAP[user?.character] || slimeIcon

  const currentQ = questions[current]
  const isVillain = currentQ?.quiz_category === 'miniboss'

  const totalQ = minibossStartIndex !== null
    ? questions.length - minibossStartIndex
    : Math.min(10, questions.length)
  const currentNum = minibossStartIndex !== null
    ? current - minibossStartIndex + 1
    : current + 1
  const progressPct = (currentNum / totalQ) * 100

  return (
    <div className={`stage-page ${isVillain ? 'villain-mode' : ''}`}>

      {/* ── 히어로 섹션 ── */}
      <div className="stage-hero">
        <button
          className="stage-hero-close"
          onClick={() => navigate(`/lesson/${lessonId}`)}
          aria-label="레슨 목록으로"
        >✕</button>
        <div className="stage-hero-text">
          <p className="stage-breadcrumb">
            UNIT {lessonId} · Stage {stageNum}
          </p>
          {unitInfo?.title && (
            <h1 className="stage-hero-title">{unitInfo.title}</h1>
          )}
        </div>
        <div className="stage-score-badge">⭐ {score}</div>
      </div>

      {/* ── 캐릭터 영역 ── */}
      <div className="stage-char-area">
        {isVillain ? (
          <img src={villainIcon} alt="빌런" className="stage-char-img villain-char animate-float" />
        ) : (
          <img src={charSrc} alt="캐릭터" className="stage-char-img animate-bob" />
        )}
      </div>

      {/* ── 퀴즈 카드 ── */}
      <div className="stage-content container">
        {isVillain && (
          <div className="villain-speech animate-fade-in-up">
            "엉뚱한 코드로 널 괴롭혀주지! 코드몬 등장!"
          </div>
        )}
        <QuizCard
          key={current}
          question={currentQ}
          onAnswer={handleAnswer}
          onNext={handleNext}
        />
      </div>

      {/* ── 하단 진행 바 ── */}
      <div className="stage-bottom-progress">
        <div className="stage-progress-label">
          <span>진행도</span>
          <span>문제 {currentNum} / {totalQ}</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

    </div>
  )
}
