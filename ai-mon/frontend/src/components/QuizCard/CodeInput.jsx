export default function CodeInput({ input, setInput, choices, revealed, disabled, pyLoading, codeRunResult, gradingError, submitting, onRun, onSubmit }) {
  const handleChoiceClick = (choice) => {
    if (disabled || revealed) return
    setInput((prev) => {
      const trimmed = prev.trim()
      return trimmed ? `${trimmed}\n${choice}` : choice
    })
  }

  const handleClear = () => {
    if (disabled || revealed) return
    setInput('')
  }

  return (
    <div className="quiz-code-input">
      {choices && choices.length > 0 && (
        <div className="quiz-code-choices" style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#4C4465', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>코드 조각 예시</span>
            <button 
              type="button" 
              onClick={handleClear} 
              disabled={disabled || revealed}
              style={{
                background: 'transparent', border: 'none', color: '#DC2626', fontSize: '11px', cursor: 'pointer', fontWeight: 600
              }}
            >
              전체 지우기
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {choices.map((choice, idx) => (
              <div
                key={idx}
                style={{
                  textAlign: 'left',
                  background: '#F3F4F6',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontFamily: "'D2Coding', monospace",
                  fontSize: '14px',
                  color: '#1F2937',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {choice}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="quiz-code-editor">
        <div className="quiz-code-editor-lbl"># 여기에 코드를 작성하세요</div>
        <textarea
          className="quiz-code-textarea"
          placeholder="코드 입력..."
          rows={5}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || revealed}
        />
      </div>

      <button
        className="quiz-run-btn"
        onClick={onRun}
        disabled={!input.trim() || disabled || revealed || pyLoading || submitting}
      >
        {pyLoading ? '⏳ 실행 중...' : '▶ 실행하기'}
      </button>

      {codeRunResult && (
        <div className={`quiz-code-output${!codeRunResult.stdout ? ' empty' : ''}`}>
          {codeRunResult.stdout        && <span style={{ color: '#534AB7' }}>{codeRunResult.stdout}</span>}
          {codeRunResult.stderr        && <span style={{ color: '#DC2626' }}>{codeRunResult.stderr}</span>}
          {codeRunResult.compile_output && <span style={{ color: '#D97706' }}>{codeRunResult.compile_output}</span>}
          {!codeRunResult.stdout && !codeRunResult.stderr && !codeRunResult.compile_output && '(출력 없음)'}
        </div>
      )}

      {gradingError && (
        <div className="quiz-code-grading-error" style={{ color: '#DC2626', margin: '6px 0', fontSize: '14px' }}>
          {gradingError}
        </div>
      )}

      <button
        className="quiz-submit-btn"
        onClick={onSubmit}
        disabled={!input.trim() || disabled || revealed || pyLoading || submitting}
      >
        {submitting ? '🤖 채점 중...' : '확인하기'}
      </button>
    </div>
  )
}
