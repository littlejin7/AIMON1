import { useNavigate } from 'react-router-dom'
import AppHeader from '../../components/AppHeader/AppHeader'
import { highlightLineTokens } from '../../utils/pythonHighlight'
import './StageBriefing.css'

// 레슨페이지(/lesson)와 동일한 상단 헤더. 경로 매핑엔 /stage 가 없으므로 override 로 강제 렌더.
const STAGE_APP_HEADER = { title: 'LESSON', compact: true, sound: true, settings: true }


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
  const stageLabel = `UNIT ${lessonId} · Stage ${stageNum}`

  return (
    <div className="sb-page sb-page--app-header">

      {/* ── 레슨 헤더 (레슨페이지와 동일) ── */}
      <AppHeader override={STAGE_APP_HEADER} />

      {/* ── 진행도 ── */}
      <div className="stage-bottom-progress">
        <div className="stage-progress-label">
          <span className="stage-progress-title">{stageLabel}</span>
          <span>슬라이드 {briefingIndex + 1} / {total}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* ── 대제목 + 나가기(오른쪽) ── */}
      <div className="sb-title-row">
        {unitInfo?.title && (
          <div className="sb-lesson-title">{unitInfo.title}</div>
        )}
        <button
          className="stage-exit-btn"
          onClick={() => navigate(`/lesson/${lessonId}`)}
          aria-label="레슨 목록으로"
        >✕</button>
      </div>

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
          style={{ visibility: isFirst ? 'hidden' : 'visible' }}
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
