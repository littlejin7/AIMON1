import { useNavigate } from 'react-router-dom'
import slimeIcon from '../../assets/character_slime.png'
import robotIcon from '../../assets/character_robot.png'
import speechBubbleIcon from '../../assets/character_bubble.png'
import finalGhostIcon from '../../assets/character_final_ghost.png'
import { useAuthStore } from '../../hooks/useAuthStore'

const CHARACTER_MAP = {
  slime:         slimeIcon,
  robot:         robotIcon,
  speech_bubble: speechBubbleIcon,
  final_ghost:   finalGhostIcon,
}

export default function StageBriefing({
  briefings,
  briefingIndex,
  setBriefingIndex,
  setShowBriefing,
  lessonId,
  stageNum,
  unitInfo,
}) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const charSrc = CHARACTER_MAP[user?.character] || slimeIcon

  const slide = briefings[briefingIndex]
  const isLast = briefingIndex === briefings.length - 1
  const progress = ((briefingIndex + 1) / briefings.length) * 100

  return (
    <div className="stage-page">

      {/* ── 히어로 섹션 ── */}
      <div className="stage-hero">
        <button
          className="stage-hero-close"
          onClick={() => navigate(`/lesson/${lessonId}`)}
          aria-label="레슨 목록으로"
        >✕</button>
        <div className="stage-hero-text">
          <p className="stage-breadcrumb">
            UNIT {lessonId} · Stage {stageNum} · 슬라이드 {slide.order}
          </p>
          {unitInfo?.title && (
            <h1 className="stage-hero-title">{unitInfo.title}</h1>
          )}
        </div>
      </div>

      {/* ── 캐릭터 영역 ── */}
      <div className="stage-char-area">
        <img
          src={charSrc}
          alt="캐릭터"
          className="stage-char-img animate-bob"
        />
      </div>

      {/* ── 컨텐츠 카드 ── */}
      <div className="stage-content container">
        <div
          className="briefing-card card-glass animate-fade-in-up"
          key={slide.order}
        >
          {/* 개념 설명 텍스트 */}
          <p className="briefing-text">
            {slide.text}
          </p>

          {/* 터미널 블록 */}
          {slide.terminal && (
            <div className="briefing-terminal">
              <div className="terminal-titlebar">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
                <span className="terminal-lang">Python</span>
              </div>
              <div className="terminal-body">
                {slide.terminal.code.map((line, i) => (
                  <div key={i} className={line.startsWith('#') ? 'term-comment' : 'term-line'}>
                    <span className="term-prompt">&gt;&gt;&gt;</span>
                    {line}
                  </div>
                ))}
              </div>
              {slide.terminal.output?.length > 0 && (
                <div className="terminal-output">
                  {slide.terminal.output.map((line, i) => (
                    <div key={i} className="term-out-line">{line}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 팁 블록 */}
          {slide.tip && (
            <div className="briefing-tip">
              <strong className="tip-label">💡 에이몬의 팁</strong>
              <p className="tip-text">{slide.tip}</p>
            </div>
          )}

          <button
            className="btn btn-primary btn-lg btn-full"
            onClick={() => {
              if (isLast) setShowBriefing(false)
              else setBriefingIndex(b => b + 1)
            }}
          >
            {isLast ? '🚀 퀴즈 시작하기' : '다음 슬라이드 ➔'}
          </button>
        </div>
      </div>

      {/* ── 하단 진행 바 ── */}
      <div className="stage-bottom-progress">
        <div className="stage-progress-label">
          <span>진행도</span>
          <span>{briefingIndex + 1} / {briefings.length} 슬라이드</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

    </div>
  )
}
