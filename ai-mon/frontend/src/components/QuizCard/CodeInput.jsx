export default function CodeInput({ input, setInput, revealed, disabled, pyLoading, codeRunResult, onSubmit }) {
  return (
    <div className="quiz-code-input">
      {/* 코드 에디터 */}
      <div className="battle-editor-mock" style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: '8px', overflow: 'hidden' }}>
        <div className="editor-tab" style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 12px', fontSize: '0.8rem', color: '#a0a0b0', borderBottom: '1px solid #313244' }}>
          main.py
        </div>
        <textarea
          className="editor-textarea"
          style={{ width: '100%', background: 'transparent', border: 'none', padding: '12px', color: '#cdd6f4', fontFamily: 'monospace', resize: 'none', outline: 'none' }}
          placeholder="# 파이썬 코드를 작성하세요"
          rows={6}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || revealed}
        />
      </div>

      {/* 실행 결과 */}
      {codeRunResult && (
        <div style={{ marginTop: '8px', padding: '10px', background: '#1e1e2e', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {codeRunResult.stdout       && <div style={{ color: '#a6e3a1' }}>▶ {codeRunResult.stdout}</div>}
          {codeRunResult.stderr       && <div style={{ color: '#f38ba8' }}>⚠ {codeRunResult.stderr}</div>}
          {codeRunResult.compile_output && <div style={{ color: '#fab387' }}>⚙ {codeRunResult.compile_output}</div>}
        </div>
      )}

      <button
        className="btn btn-primary btn-full"
        style={{ marginTop: '12px' }}
        onClick={onSubmit}
        disabled={!input.trim() || disabled || revealed || pyLoading}
      >
        {pyLoading ? '⏳ Python 실행 중...' : '확인하기 ✓'}
      </button>
    </div>
  )
}
