export default function CodeInput({ input, setInput, revealed, disabled, pyLoading, codeRunResult, onSubmit }) {
  return (
    <div className="quiz-code-input">
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
        onClick={onSubmit}
        disabled={!input.trim() || disabled || revealed || pyLoading}
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

      <button
        className="quiz-submit-btn"
        onClick={onSubmit}
        disabled={!input.trim() || disabled || revealed || pyLoading}
      >
        확인하기
      </button>
    </div>
  )
}
