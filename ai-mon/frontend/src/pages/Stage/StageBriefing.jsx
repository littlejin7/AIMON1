import { useNavigate } from 'react-router-dom'
import { highlightLineTokens } from '../../utils/pythonHighlight'
import './StageBriefing.css'


function addLineBreaks(text) {
  if (!text) return null
  return text.split('\n').map((sentence, i, arr) => (
    <span key={i}>
      {sentence}{i < arr.length - 1 && <br />}
    </span>
  ))
}

function highlightLine(line, keyPrefix = '') {
  return highlightLineTokens(line, keyPrefix)
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

  const navigate = useNavigate()
 
  const slide   = briefings[briefingIndex]
  const total   = briefings.length
  const isFirst = briefingIndex === 0
  const isLast  = briefingIndex === total - 1
  const progress = ((briefingIndex + 1) / total) * 100

  return (
    <div className="sb-page">

      {/* ── 헤더 ── */}
      <div className="stage-hero">
        <button
          className="stage-hero-close"
          onClick={() => navigate(`/lesson/${lessonId}`)}
          aria-label="레슨 목록으로"
        >✕</button>
        <div className="stage-hero-text">
          <p className="stage-breadcrumb">UNIT {lessonId} · Stage {stageNum}</p>
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* ── 진행도 ── */}
      <div className="stage-bottom-progress">
        <div className="stage-progress-label">
          <span>진행도</span>
          <span>슬라이드 {briefingIndex + 1} / {total}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {unitInfo?.title && (
        <div className="sb-lesson-title">{unitInfo.title}</div>
      )}

      {/* ── Body ── */}
      <div className="sb-body">

        <div className="sb-mascot-bubble">
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
          ✕
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
