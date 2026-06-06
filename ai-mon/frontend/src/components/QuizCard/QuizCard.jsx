import { useState } from 'react'
import { quizApi } from '../../api/index'
import { usePyodide } from '../../hooks/usePyodide'
import { useAuthStore } from '../../hooks/useAuthStore'
import './QuizCard.css'
import villainIcon from '../../assets/boss_midcmorg.png'

export default function QuizCard({ question, onAnswer, disabled = false }) {
  const [selected, setSelected] = useState(null)
  const [input, setInput] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [retried, setRetried] = useState(false)
  const [aiFeedback, setAiFeedback] = useState('')
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false)
  const [codeRunResult, setCodeRunResult] = useState(null)
  const { runPython, pyLoading } = usePyodide()

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

  const user = useAuthStore((s) => s.user)
  const courseLevel = user?.course_level || 'beginner'

  const fetchAiFeedback = async (userAnswer) => {
    // 1) questions.json의 feedback.wrong을 즉시 fallback으로 표시
    const staticFallback = question.feedback?.wrong || '정답을 다시 확인해 보세요!'
    setAiFeedback(staticFallback)
    setAiFeedbackLoading(true)

    // 2) Claude API 호출 (5초 타임아웃)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await quizApi.getAiFeedback(
        {
          question: question.question,
          correct_answer: question.answer,
          user_answer: userAnswer,
          level: courseLevel,
        },
        { signal: controller.signal }
      )
      // Claude 성공 시 → AI 응답으로 업그레이드 (is_ai_fallback=false이고 feedback이 있을 때만)
      if (res.data?.feedback && !res.data?.is_ai_fallback) {
        setAiFeedback(res.data.feedback)
      }
      // is_ai_fallback=true면 staticFallback 유지 (이미 표시 중)
    } catch {
      // 타임아웃 / 네트워크 오류 → staticFallback 유지 (이미 표시 중)
    } finally {
      clearTimeout(timer)
      setAiFeedbackLoading(false)
    }
  }

  const handleSelect = (option) => {
    if (disabled || revealed) return
    setSelected(option)
    setRevealed(true)
    const correct = option === question.answer
    if (!correct) fetchAiFeedback(option)
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
    if (!correct) fetchAiFeedback(input.trim())
    if (correct) {
      setTimeout(() => onAnswer?.({ correct, userAnswer: input.trim(), retried }), 1500)
    }
  }

  const handleCodeSubmit = async () => {
    if (!input.trim() || revealed) return
    // Pyodide로 브라우저에서 직접 실행
    const result = await runPython(input)
    setCodeRunResult(result)
    const correct = result.success && result.stdout.trim() === (question.answer || '').trim()
    setSelected(input)
    setRevealed(true)
    if (!correct) fetchAiFeedback(input)
    if (correct) {
      setTimeout(() => onAnswer?.({ correct, userAnswer: input, retried }), 1500)
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
          {codeRunResult && (
            <div style={{ marginTop: '8px', padding: '10px', background: '#1e1e2e', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
              {codeRunResult.stdout && <div style={{ color: '#a6e3a1' }}>▶ {codeRunResult.stdout}</div>}
              {codeRunResult.stderr && <div style={{ color: '#f38ba8' }}>⚠ {codeRunResult.stderr}</div>}
              {codeRunResult.compile_output && <div style={{ color: '#fab387' }}>⚙ {codeRunResult.compile_output}</div>}
            </div>
          )}
          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: '12px' }}
            onClick={handleCodeSubmit}
            disabled={!input.trim() || disabled || revealed || pyLoading}
          >
            {pyLoading ? '⏳ Python 실행 중...' : '코드 실행 및 제출 🚀'}
          </button>
        </div>
      )}

      {revealed && (
        <div className={`quiz-explanation ${selected === question.answer ? 'correct' : 'wrong'}`}>
          <div style={{ marginBottom: '8px' }}>
            {selected === question.answer ? '✅ 정답!' : '❌ 오답'}
          </div>
          <p style={{ marginBottom: selected !== question.answer ? '12px' : '0' }}>
            {selected === question.answer ? (question.feedback?.correct || question.explanation) : ''}
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
