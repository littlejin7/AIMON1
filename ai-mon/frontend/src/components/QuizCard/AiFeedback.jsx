export default function AiFeedback({ aiFeedback, aiFeedbackLoading, onRetry, onNext }) {
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
      <strong style={{ color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        🧠 Claude AI 피드백
        {aiFeedbackLoading && (
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
      </strong>

      <p style={{ margin: 0, color: 'var(--clr-text-muted)', marginBottom: '12px', whiteSpace: 'pre-line' }}>
        {aiFeedback}
      </p>

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
    </div>
  )
}
