import { useState } from 'react'
import './QuizCard.css'

export default function QuizCard({ question, onAnswer, disabled = false }) {
  const [selected, setSelected] = useState(null)
  const [input, setInput] = useState('')
  const [revealed, setRevealed] = useState(false)

  if (!question) return null

  const isMultipleChoice = question.type === 'multiple_choice'
  const isCorrect = (ans) => {
    if (!revealed) return false
    return ans === question.answer
  }
  const isWrong = (ans) => {
    if (!revealed) return false
    return ans === selected && ans !== question.answer
  }

  const handleSelect = (option) => {
    if (disabled || revealed) return
    setSelected(option)
    setRevealed(true)
    const correct = option === question.answer
    setTimeout(() => onAnswer?.({ correct, userAnswer: option }), 900)
  }

  const handleFillSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() || revealed) return
    setSelected(input.trim())
    setRevealed(true)
    const correct = input.trim().toLowerCase() === question.answer.toLowerCase()
    setTimeout(() => onAnswer?.({ correct, userAnswer: input.trim() }), 900)
  }

  return (
    <div className="quiz-card animate-fade-in-up">
      <div className="quiz-question">
        <span className="quiz-q-icon">❓</span>
        <p>{question.question}</p>
      </div>

      {isMultipleChoice ? (
        <div className="quiz-options stagger">
          {question.options.map((opt) => (
            <button
              key={opt}
              id={`option-${opt.replace(/\s+/g, '-')}`}
              className={`quiz-option
                ${selected === opt ? 'selected' : ''}
                ${isCorrect(opt) ? 'correct' : ''}
                ${isWrong(opt) ? 'wrong' : ''}
              `}
              onClick={() => handleSelect(opt)}
              disabled={disabled || revealed}
            >
              <span className="option-bullet" />
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={handleFillSubmit} className="quiz-fill-form">
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
            제출하기
          </button>
        </form>
      )}

      {revealed && (
        <div className={`quiz-explanation ${selected === question.answer ? 'correct' : 'wrong'}`}>
          <span>{selected === question.answer ? '✅ 정답!' : '❌ 오답'}</span>
          <p>{question.explanation}</p>
        </div>
      )}
    </div>
  )
}
