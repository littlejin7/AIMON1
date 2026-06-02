import { useState } from 'react'
import './QuizCard.css'

export default function QuizCard({ question, onAnswer, disabled = false }) {
  const [selected, setSelected] = useState(null)
  const [input, setInput] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [retried, setRetried] = useState(false)

  if (!question) return null

  const type = question.quiz_type || question.type
  const isChoiceType = type === 'multiple_choice' || type === 'output_select'
  const isCodeInput = type === 'code_input'
  const choicesList = question.choices || question.options || []
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
    if (correct) {
      setTimeout(() => onAnswer?.({ correct, userAnswer: option, retried }), 1500)
    }
  }

  const handleFillSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() || revealed) return
    setSelected(input.trim())
    setRevealed(true)
    const correct = input.trim().toLowerCase() === question.answer.toLowerCase()
    if (correct) {
      setTimeout(() => onAnswer?.({ correct, userAnswer: input.trim(), retried }), 1500)
    }
  }

  const handleRetry = () => {
    setRevealed(false)
    setSelected(null)
    setInput('')
    setRetried(true)
  }

  return (
    <div className="quiz-card animate-fade-in-up">
      <div className="quiz-question">
        <span className="quiz-q-icon">❓</span>
        <p>{question.question}</p>
      </div>

      {isChoiceType && (
        <div className="quiz-options stagger">
          {choicesList.map((opt) => (
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
      )}

      {!isChoiceType && !isCodeInput && (
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

      {isCodeInput && (
        <div className="quiz-code-input">
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
          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: '12px' }}
            onClick={handleFillSubmit}
            disabled={!input.trim() || disabled || revealed}
          >
            코드 실행 및 제출 🚀
          </button>
        </div>
      )}

      {revealed && (
        <div className={`quiz-explanation ${selected === question.answer ? 'correct' : 'wrong'}`}>
          <div style={{ marginBottom: '8px' }}>
            {selected === question.answer ? '✅ 정답!' : '❌ 오답'}
          </div>
          <p style={{ marginBottom: selected !== question.answer ? '12px' : '0' }}>
            {question.explanation}
          </p>
          
          {selected !== question.answer && (
            <div className="ai-feedback-box" style={{
              background: 'rgba(124,58,237,0.1)',
              border: '1px solid rgba(124,58,237,0.3)',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '8px',
              fontSize: '0.9rem'
            }}>
              <strong style={{ color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                🧠 Claude AI 피드백
              </strong>
              <p style={{ margin: 0, color: 'var(--clr-text-muted)', marginBottom: '12px' }}>
                혹시 헷갈리셨나요? 개념을 비유하자면, 마치 <strong>{question.answer}</strong> 처럼 동작한다고 생각해보세요! 천천히 다시 확인해 보세요.
              </p>
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ width: '100%', borderColor: 'rgba(124,58,237,0.4)', color: '#c4b5fd' }}
                onClick={handleRetry}
              >
                🔄 다시 시도하기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
