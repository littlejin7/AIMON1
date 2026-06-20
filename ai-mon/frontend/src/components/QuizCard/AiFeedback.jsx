export default function AiFeedback({ aiFeedback, aiFeedbackLoading, onRetry, onNext }) {
  // 스트리밍 중이면 커서 깜빡임, 완료 후 숨김
  const showCursor = aiFeedbackLoading && aiFeedback.length > 0

  return (
    <div
      className="ai-feedback-box"
      style={{
        background: 'rgba(124,58,237,0.1)',
        border: '1px solid rgba(124,58,237,0.3)',
        borderRadius: '8px',
        padding: '12px',
        marginTop: '8px',
        fontSize: '0.9rem',
      }}
    >
      {/* 헤더 */}
      <strong style={{ color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        🧠 Claude AI 피드백
        {aiFeedbackLoading && aiFeedback.length === 0 && (
          <span style={{
            fontSize: '0.7rem',
            background: 'rgba(124,58,237,0.25)',
            border: '1px solid rgba(124,58,237,0.4)',
            borderRadius: '999px',
            padding: '1px 8px',
            color: '#c4b5fd',
            fontWeight: 400,
            animation: 'pulse 1.5s infinite',
          }}>
            AI 분석 중...
          </span>
        )}
        {aiFeedbackLoading && aiFeedback.length > 0 && (
          <span style={{
            fontSize: '0.7rem',
            background: 'rgba(124,58,237,0.15)',
            border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: '999px',
            padding: '1px 8px',
            color: '#a78bfa',
            fontWeight: 400,
          }}>
            ✍️ 작성 중
          </span>
        )}
      </strong>

      {/* 피드백 텍스트 + 타이핑 커서 */}
      <p style={{ margin: 0, color: 'var(--clr-text-muted)', marginBottom: '12px', whiteSpace: 'pre-line', lineHeight: 1.7 }}>
        {aiFeedback}
        {showCursor && (
          <span style={{
            display: 'inline-block',
            width: '2px',
            height: '1em',
            background: '#c4b5fd',
            marginLeft: '2px',
            verticalAlign: 'text-bottom',
            animation: 'blink-cursor 0.7s step-end infinite',
          }} />
        )}
      </p>

      {/* 버튼 (스트리밍 완료 후만 표시) */}
      {!aiFeedbackLoading && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ flex: 1, borderColor: 'rgba(124,58,237,0.4)', color: '#c4b5fd' }}
            onClick={onRetry}
          >
            🔄 다시 풀기
          </button>
          <button
            className="btn btn-primary btn-sm"
            style={{ flex: 1 }}
            onClick={onNext}
          >
            다음으로 ➔
          </button>
        </div>
      )}
    </div>
  )
}
