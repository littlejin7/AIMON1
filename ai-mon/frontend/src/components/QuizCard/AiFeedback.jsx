export default function AiFeedback({ aiFeedback, aiFeedbackLoading, onRetry, onNext }) {
  const showCursor = aiFeedbackLoading && aiFeedback.length > 0

  const renderFormattedText = (text) => {
    if (!text) return null
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\n)/g)
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} style={{
            color: '#534AB7', fontWeight: 700,
            background: 'rgba(127,119,221,0.12)',
            padding: '1px 5px', borderRadius: '4px', margin: '0 2px',
          }}>
            {part.slice(2, -2)}
          </strong>
        )
      } else if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} style={{
            fontFamily: "'Courier New', monospace",
            background: 'rgba(127,119,221,0.1)',
            color: '#7F77DD',
            padding: '1px 5px', borderRadius: '4px', fontSize: '0.9em', margin: '0 2px',
          }}>
            {part.slice(1, -1)}
          </code>
        )
      } else if (part === '\n') {
        return <br key={index} />
      }
      return part
    })
  }

  return (
    <div className="ai-feedback-box">
      <div className="ai-feedback-header">
        🧠 AI 피드백
        {aiFeedbackLoading && aiFeedback.length === 0 && (
          <span className="ai-feedback-badge" style={{ animation: 'pulse 1.5s infinite' }}>
            분석 중...
          </span>
        )}
        {aiFeedbackLoading && aiFeedback.length > 0 && (
          <span className="ai-feedback-badge">✍️ 작성 중</span>
        )}
      </div>

      <p className="ai-feedback-text">
        {renderFormattedText(aiFeedback)}
        {showCursor && (
          <span style={{
            display: 'inline-block', width: '2px', height: '1em',
            background: '#7F77DD', marginLeft: '2px',
            verticalAlign: 'text-bottom',
            animation: 'blink-cursor 0.7s step-end infinite',
          }} />
        )}
      </p>

      {!aiFeedbackLoading && (
        <div className="ai-feedback-actions">
          <button className="ai-btn-retry" onClick={onRetry}>🔄 다시 풀기</button>
          <button className="ai-btn-next"  onClick={onNext}>다음으로 ➔</button>
        </div>
      )}
    </div>
  )
}
