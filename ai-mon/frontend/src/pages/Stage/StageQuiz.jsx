import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../hooks/useAuthStore'
import QuizCard from '../../components/QuizCard/QuizCard'
import './BossMini.css'
import villainIcon from '../../assets/boss_midcmorg.png'
import amon from '../../assets/amon.png'



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
  score,
  minibossStartIndex,
  handleAnswer,
  handleNext,
  unitInfo,
}) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
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
  
  const tauntPool = VILLAIN_TAUNTS[currentQ?.type] || VILLAIN_TAUNTS.default
  const tauntText = VILLAIN_TAUNTS[(current || 0) % VILLAIN_TAUNTS.length]
  const levelLabel = (user?.lv || 1) <= 3 ? '초급' : (user?.lv || 1) <= 6 ? '중급' : '고급'

  /* ── 미니보스 모드 레이아웃 ── */
  if (isVillain) {
    return (
      <div className="mb-page">

        {/* 탑 네비 */}
        <div className="mb-topnav">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span className="mb-logo">AI MON</span>
            <span style={{ fontSize: 10, color: '#888' }}>UNIT {lessonId} · Stage {stageNum}</span>
          </div>
          <div className="mb-crown-pill">⭐ {score}</div>
          <div className="mb-user-info">
            <div className="mb-uavatar">
              <img src={charSrc} alt="캐릭터" style={{ width: 20, height: 20, objectFit: 'contain' }} />
            </div>
            <div className="mb-utext">
              <span className="mb-uname">{user?.username || '플레이어'}</span>
              <span className="mb-ulvl">{levelLabel}</span>
            </div>
            <button
              className="mb-escape-btn"
              onClick={() => navigate(`/lesson/${lessonId}`)}
            >
              나가기 ✕
            </button>
          </div>
        </div>

        {/* 진행도 스트립 */}
        <div className="mb-prog-strip">
          <span className="mb-prog-lbl">진행도</span>
          <div className="mb-prog-track">
            <div className="mb-prog-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="mb-prog-cnt">문제 {currentNum} / {totalQ}</span>
        </div>

        {/* 본문 */}
        <div className="mb-content">

          {/* 보스 영역 */}
          <div className="mb-boss-area">
            <img
              src={villainIcon}
              alt="미니보스"
              className="animate-float"
              style={{
                width: 110,
                height: 110,
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 16px rgba(83,74,183,0.35))',
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
    <div className="stage-page">

      {/* 히어로 섹션 */}
      <div className="stage-hero">
        <button
          className="stage-hero-close"
          onClick={() => navigate(`/lesson/${lessonId}`)}
          aria-label="레슨 목록으로"
        >✕</button>
        <div className="stage-hero-text">
          <p className="stage-breadcrumb">UNIT {lessonId} · Stage {stageNum}</p>
          {unitInfo?.title && <h1 className="stage-hero-title">{unitInfo.title}</h1>}
        </div>
        <div className="stage-score-badge">⭐ {score}</div>
      </div>

      {/* 상단 진행 바 */}
      <div className="stage-bottom-progress">
        <div className="stage-progress-label">
          <span>진행도</span>
          <span>문제 {currentNum} / {totalQ}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>


      
      {/* 캐릭터 영역 */}
      <div className="stage-char-area">
        <img src={charSrc} alt="캐릭터" className="stage-char-img animate-bob" />
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
