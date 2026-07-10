import { useNavigate } from 'react-router-dom'
import QuizCard from '../../components/QuizCard/QuizCard'
import AppHeader from '../../components/AppHeader/AppHeader'
import './BossMini.css'
import villainIcon from '../../assets/boss_midcmorg.png'
import amon from '../../assets/amon.png'

// 레슨페이지(/lesson)와 동일한 상단 헤더. 경로 매핑엔 /stage 가 없으므로 override 로 강제 렌더.
const STAGE_APP_HEADER = { title: 'LESSON', compact: true, sound: true, settings: true }



const VILLAIN_TAUNTS = {
  fill_in_blank:   ['"빈칸을 채워야 살아남는다! 어디 해봐!"', '"빈칸이 두렵냐? 채워봐!"'],
  multiple_choice: ['"엉뚱한 코드로 널 괴롭혀주지! 코드몬 등장!"', '"Python 기초도 모르면 통과 불가야!"'],
  code_input:      ['"코드를 직접 입력해봐! 틀리면 끝이야!"', '"제법이군... 하지만 아직 멀었다! 💥"'],
  error_find:      ['"버그를 찾아봐! 숨겨놨으니까 힘들걸?"', '"에러를 못 잡으면 여기서 끝이야!"'],
  default:         ['"제법이군... 하지만 아직 멀었다! 💥"', '"넌 여기서 멈추게 될 거야!"'],
}

export default function StageQuiz({
  lessonId,
  stageNum,
  questions,
  current,
  minibossStartIndex,
  handleAnswer,
  handleNext,
  unitInfo,
}) {
  const navigate = useNavigate()
  const charSrc = amon

  const currentQ = questions[current]
  const isVillain = currentQ?.quiz_category === 'miniboss'
  const stageKey = `${lessonId}-${stageNum}`

  const totalQ = minibossStartIndex !== null
    ? questions.length - minibossStartIndex
    : Math.min(10, questions.length)
  const currentNum = minibossStartIndex !== null
    ? current - minibossStartIndex + 1
    : current + 1
  const progressPct = (currentNum / totalQ) * 100
  const stageLabel = `UNIT ${lessonId} · Stage ${stageNum}`
  
  const tauntPool = VILLAIN_TAUNTS[currentQ?.type] || VILLAIN_TAUNTS.default
  const tauntText = VILLAIN_TAUNTS[(current || 0) % VILLAIN_TAUNTS.length]

  /* ── 미니보스 모드 레이아웃 ── */
  if (isVillain) {
    return (
      <div className="mb-page">

        {/* 상단 진행 바 */}
        <div className="stage-bottom-progress">
          <div className="stage-progress-label">
            <span className="stage-progress-title">{stageLabel}</span>
            <span>문제 {currentNum} / {totalQ}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* 본문 */}
        <div className="mb-content">

          {/* 보스 영역 */}
          <div
            className="mb-boss-area"
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
          >
            <img
              src={villainIcon}
              alt="미니보스"
              className="animate-float"
              draggable={false}
              style={{
                width: 200,
                height: 200,
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 16px rgba(83,74,183,0.35))',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitUserDrag: 'none',
                WebkitTouchCallout: 'none',
              }}
            />
            <div className="mb-speech">{tauntText}</div>
          </div>

          {/* 퀴즈 카드 */}
          <QuizCard
            key={current}
            question={currentQ}
            stageKey={stageKey}
            onAnswer={handleAnswer}
            onNext={handleNext}
          />

        </div>
      </div>
    )
  }

  /* ── 일반 스테이지 레이아웃 ── */
  return (
    <div className="stage-page stage-page--app-header">

      {/* 레슨 헤더 (레슨페이지와 동일) */}
      <AppHeader override={STAGE_APP_HEADER} />

      {/* 상단 진행 바 */}
      <div className="stage-bottom-progress">
        <div className="stage-progress-label">
          <span className="stage-progress-title">{stageLabel}</span>
          <span>문제 {currentNum} / {totalQ}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* 캐릭터 영역 (나가기 버튼은 이 배경 안 우상단에 배치) */}
      <div className="stage-char-area">
        <button
          className="stage-exit-btn"
          onClick={() => navigate(`/lesson/${lessonId}`)}
          aria-label="레슨 목록으로"
        >✕</button>
        <img
          src={charSrc}
          alt="캐릭터"
          className="stage-char-img animate-bob"
          draggable={false}
        />
      </div>

      {/* 퀴즈 카드 */}
      <div className="stage-content container">
        <QuizCard
          key={current}
          question={currentQ}
          stageKey={stageKey}
          onAnswer={handleAnswer}
          onNext={handleNext}
        />
      </div>


    </div>
  )
}
