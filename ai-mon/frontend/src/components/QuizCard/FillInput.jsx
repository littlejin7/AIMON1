export default function FillInput({ input, setInput, revealed, disabled, onSubmit }) {
  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="quiz-fill-form">
      <input
        className="input"
        type="text"
        placeholder="정답을 입력하세요"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={disabled || revealed}
        autoFocus
      />
      <button
        type="submit"
        className="btn btn-primary btn-full"
        disabled={!input.trim() || disabled || revealed}
      >
        확인하기 ✓
      </button>
    </form>
  )
}
