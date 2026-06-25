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

function addLineBreaks(text) {
  if (!text) return null
  return text.split('\n').map((sentence, i, arr) => (
    <span key={i}>
      {sentence}{i < arr.length - 1 && <br />}
    </span>
  ))
}

function highlightLine(line) {
  if (line.trim().startsWith('#')) {
    return <span className="sb-cm">{line}</span>
  }

  const commentMatch = line.match(/^(.*?)(\s+#.*)$/)
  const code    = commentMatch ? commentMatch[1] : line
  const comment = commentMatch ? commentMatch[2] : ''

  const regex = /(".*?"|'.*?'|\bTrue\b|\bFalse\b|\bNone\b|\b(?:print|input|len|range|int|str|float|list|dict|type|zip|map|filter|sorted|enumerate)\b|\b\d+(?:\.\d+)?\b|[^\s"'#]+|\s+)/g
  const tokens = []
  let match
  let idx = 0
  while ((match = regex.exec(code)) !== null) {
    const t = match[0]
    if (/^(".*"|'.*')$/.test(t)) {
      tokens.push(<span key={idx++} className="sb-str">{t}</span>)
    } else if (/^(?:print|input|len|range|int|str|float|list|dict|type|zip|map|filter|sorted|enumerate)$/.test(t)) {
      tokens.push(<span key={idx++} className="sb-fn">{t}</span>)
    } else if (/^(?:True|False|None)$/.test(t) || /^\d+(?:\.\d+)?$/.test(t)) {
      tokens.push(<span key={idx++} className="sb-nm">{t}</span>)
    } else {
      tokens.push(t)
    }
  }

  return (
    <>
      {tokens}
      {comment && <span className="sb-cm">{comment}</span>}
    </>
  )
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
  const user     = useAuthStore((s) => s.user)
  const charSrc  = CHARACTER_MAP[user?.character] || slimeIcon

  const slide   = briefings[briefingIndex]
  const total   = briefings.length
  const isFirst = briefingIndex === 0
  const isLast  = briefingIndex === total - 1
  const progress = ((briefingIndex + 1) / total) * 100

  return (
    <div className="sb-page">

      {/* ── Progress ── */}
      <div className="sb-progress-wrap">
        <div className="sb-progress-track">
          <div className="sb-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="sb-body">

        <div className="sb-unit-badge">
          📘 {slide.topic || `슬라이드 ${slide.order}`}
        </div>

        {unitInfo?.title && (
          <div className="sb-lesson-title">{unitInfo.title}</div>
        )}

        <div className="sb-mascot-bubble">
          <div className="sb-mascot-avatar">
            <img src={charSrc} alt="캐릭터" />
          </div>
          <div className="sb-bubble-text">{addLineBreaks(slide.text)}</div>
        </div>

        {slide.terminal && (
          <div className="sb-code-block">
            <pre>
              {slide.terminal.code.map((line, i) => (
                <div key={i}>{highlightLine(line)}</div>
              ))}
            </pre>
          </div>
        )}

        {slide.terminal?.output?.length > 0 && (
          <div className="sb-output-wrap">
            <div className="sb-output-label">▶ 실행 결과</div>
            <div className="sb-output-box">{slide.terminal.output.join('\n')}</div>
          </div>
        )}

        {slide.tip && (
          <div className="sb-tip">
            <strong className="sb-tip-label">💡 에이몬의 팁</strong>
            <p className="sb-tip-text">{addLineBreaks(slide.tip)}</p>
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="sb-nav-bar">
        <button
          className="sb-nav-btn sb-nav-prev"
          onClick={() => setBriefingIndex(b => b - 1)}
          disabled={isFirst}
        >
          ← 이전
        </button>

        <div className="sb-slide-dots">
          {briefings.map((_, i) => (
            <div key={i} className={`sb-dot${i === briefingIndex ? ' active' : ''}`} />
          ))}
        </div>

        <button
          className="sb-nav-btn sb-nav-next"
          onClick={() => {
            if (isLast) setShowBriefing(false)
            else setBriefingIndex(b => b + 1)
          }}
        >
          {isLast ? '퀴즈 시작 🚀' : '다음 →'}
        </button>
        </div>

      </div>

    </div>
  )
}
