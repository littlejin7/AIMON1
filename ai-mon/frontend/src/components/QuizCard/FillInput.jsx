export default function FillInput({ input, setInput, revealed, disabled, onSubmit }) {
  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="quiz-fill-form">
      <div className="fib-wrap">
        <span className="fib-lbl">답</span>
        <input
          className="fib-input"
          type="text"
          placeholder="코드를 입력하세요..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || revealed}
          autoFocus
        />
      </div>
      <button
        type="submit"
        className="quiz-submit-btn"
        disabled={!input.trim() || disabled || revealed}
      >
        확인하기
      </button>
    </form>
  )
}
