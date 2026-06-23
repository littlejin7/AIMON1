export default function AiFeedback({ aiFeedback, aiFeedbackLoading, onRetry, onNext }) {
  // 스트리밍 중이면 커서 깜빡임, 완료 후 숨김
  const showCursor = aiFeedbackLoading && aiFeedback.length > 0

  // Markdown parser helper for **bold** and `code`
  const renderFormattedText = (text) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\n)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const cleanText = part.slice(2, -2);
        return (
          <strong
            key={index}
            style={{
              color: '#c4b5fd', // Light violet
              fontWeight: '800',
              background: 'rgba(196, 181, 253, 0.15)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid rgba(196, 181, 253, 0.3)',
              margin: '0 2px',
              display: 'inline-block',
            }}
          >
            {cleanText}
          </strong>
        );
      } else if (part.startsWith('`') && part.endsWith('`')) {
        const cleanText = part.slice(1, -1);
        return (
          <code
            key={index}
            style={{
              fontFamily: 'Consolas, Monaco, monospace',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              color: '#fda4af', // Light rose
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '0.9em',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              margin: '0 4px',
            }}
          >
            {cleanText}
          </code>
        );
      } else if (part === '\n') {
        return <br key={index} />;
      }
      return part;
    });
  };

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
      <p style={{ margin: 0, color: 'var(--clr-text-muted)', marginBottom: '12px', lineHeight: 1.7 }}>
        {renderFormattedText(aiFeedback)}
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
