import { useState, useEffect } from 'react'
import { quizApi } from '../../api/index'
import { usePyodide } from '../../hooks/usePyodide'
import { useAuthStore } from '../../hooks/useAuthStore'
import ChoiceOptions from './ChoiceOptions'
import FillInput from './FillInput'
import CodeInput from './CodeInput'
import AiFeedback from './AiFeedback'
import './QuizCard.css'

function parseQuestionCode(raw) {
  const match = raw.match(/^([\s\S]*?)```(?:python)?\n([\s\S]*?)```([\s\S]*)$/m)
  if (!match) return { questionText: raw.trim(), codeLines: null }
  const before = match[1].trim()
  const after  = match[3].trim()
  const code   = match[2].trimEnd()
  const questionText = [before, after].filter(Boolean).join('\n').trim()
  return { questionText, codeLines: code.split('\n') }
}

function TerminalBlock({ lines }) {
  return (
    <div style={{ margin: '10px 0 12px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #313244' }}>
      <div style={{
        background: '#181825', padding: '6px 12px',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
        <span style={{ color: '#585b70', fontSize: '0.72rem', marginLeft: 8 }}>Python</span>
      </div>
      <div style={{
        background: '#1e1e2e', padding: '0.85rem 1rem',
        fontFamily: 'monospace', fontSize: '1.4rem', color: '#cdd6f4',
        whiteSpace: 'pre', overflowX: 'auto',
      }}>
        {lines.map((line, i) => (
          <div key={i} style={{ color: line.trim().startsWith('#') ? '#6c7086' : '#cdd6f4' }}>
            <span style={{ color: '#585b70', userSelect: 'none', marginRight: 10 }}>&gt;&gt;&gt;</span>
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function QuizCard({
  question,
  onAnswer,
  onNext,
  disabled = false,
  initialSelected = null,
  initialInput = '',
  initialRevealed = false,
  initialAiFeedback = '',
  initialIsCorrectResult = null,
  onFeedbackUpdate,
}) {
  const [selected,          setSelected]          = useState(initialSelected)
  const [input,             setInput]             = useState(initialInput)
  const [revealed,          setRevealed]          = useState(initialRevealed)
  const [retried,           setRetried]           = useState(false)
  const [aiFeedback,        setAiFeedback]        = useState(initialAiFeedback)
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false)
  const [codeRunResult,     setCodeRunResult]     = useState(null)
  const [isCorrectResult,   setIsCorrectResult]   = useState(initialIsCorrectResult)

  const { runPython, pyLoading } = usePyodide()
  const user        = useAuthStore((s) => s.user)
  const courseLevel = user?.course_level || 'beginner'

  useEffect(() => {
    if (aiFeedback) {
      onFeedbackUpdate?.(aiFeedback)
    }
  }, [aiFeedback, onFeedbackUpdate])

  if (!question) return null
  
  let rawQuestion = question.question || ''
  if (question.code && !rawQuestion.includes('```')) {
    rawQuestion += `\n\n\`\`\`python\n${question.code}\n\`\`\``
  }
  
  const { questionText, codeLines } = parseQuestionCode(rawQuestion) 
  
  const type          = question.quiz_type || question.type
  const isChoiceType  = type === 'multiple_choice' || type === 'output_select' || type === 'error_find'
  const isCodeInput   = type === 'code_input'
  const choicesList   = question.choices || question.options || []

  // ── AI 피드백 호출 (SSE 스트리밍) ──
  const fetchAiFeedback = async (userAnswer) => {
    const staticFallback = question.feedback?.wrong || '정답을 다시 확인해 보세요!'
    setAiFeedback(staticFallback)
    setAiFeedbackLoading(true)

    let fullQuestionText = question.question
    if (isChoiceType && choicesList.length > 0) {
      fullQuestionText += '\n\n[선택지]\n' + choicesList.join('\n')
    }

    const body = JSON.stringify({
      question_id:    question.question_id || question.id || '',
      question:       fullQuestionText,
      correct_answer: question.answer,
      user_answer:    userAnswer,
      level:          courseLevel,
    })

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    const token   = (await import('../../hooks/useAuthStore')).useAuthStore.getState().token
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    try {
      const res = await fetch(`${baseUrl}/quiz/ai-feedback/stream`, {
        method:  'POST',
        headers,
        body,
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) {
              accumulated += parsed.text
              setAiFeedback(accumulated)
            }
          } catch { /* JSON 파싱 실패 무시 */ }
        }
      }
    } catch (streamErr) {
      // 스트리밍 실패 → 기존 단순 POST 폴백
      try {
        const res = await quizApi.getAiFeedback({ 
          question_id: question.question_id || question.id || '',
          question: fullQuestionText, 
          correct_answer: question.answer, 
          user_answer: userAnswer, 
          level: courseLevel 
        })
        if (res.data?.feedback && !res.data?.is_ai_fallback) setAiFeedback(res.data.feedback)
      } catch { /* staticFallback 유지 */ }
    } finally {
      setAiFeedbackLoading(false)
    }
  }

  // ── 객관식 제출 ──
  const handleSubmitChoice = () => {
    if (!selected || revealed) return
    setRevealed(true)
    const isLetterAnswer = question.answer.length === 1 && /^[A-Z]$/.test(question.answer)
    const correct = isLetterAnswer
      ? selected.startsWith(question.answer + '.')
      : selected === question.answer
    setIsCorrectResult(correct)
    if (!correct) fetchAiFeedback(selected)
    onAnswer?.({ correct, userAnswer: selected, retried })
  }

  // ── 단답 제출 ──
  const handleFillSubmit = () => {
    if (!input.trim() || revealed) return
    setSelected(input.trim())
    setRevealed(true)
    const correct = input.trim().toLowerCase() === question.answer.toLowerCase()
    setIsCorrectResult(correct)
    if (!correct) fetchAiFeedback(input.trim())
    onAnswer?.({ correct, userAnswer: input.trim(), retried })
  }

  // ── 코드 제출 ──
  const handleCodeSubmit = async () => {
    if (!input.trim() || revealed) return
    const result = await runPython(input)
    setCodeRunResult(result)
    const correct = result.success && result.stdout.trim() === (question.answer || '').trim()
    setSelected(input)
    setRevealed(true)
    setIsCorrectResult(correct)
    if (!correct) fetchAiFeedback(input)
    onAnswer?.({ correct, userAnswer: input, retried })
  }

  // ── 다시 풀기 ──
  const handleRetry = () => {
    setRevealed(false)
    setSelected(null)
    setInput('')
    setAiFeedback('')
    setRetried(true)
  }

  return (
    <div className="quiz-card animate-fade-in-up">
      {/* 문제 */}
      <div className="quiz-question">
        <span className="quiz-q-icon">❓</span>
        <p style={{ fontSize: '1.4rem' }}>{questionText}</p>
      </div>
      {codeLines && <TerminalBlock lines={codeLines} />}

      {/* 입력 영역 */}
      {isChoiceType && (
        <ChoiceOptions
          choicesList={choicesList}
          selected={selected}
          revealed={revealed}
          disabled={disabled}
          answer={question.answer}
          onSelect={(opt) => { if (!revealed) setSelected(opt) }}
          onSubmit={handleSubmitChoice}
        />
      )}

      {!isChoiceType && !isCodeInput && (
        <FillInput
          input={input}
          setInput={setInput}
          revealed={revealed}
          disabled={disabled}
          onSubmit={handleFillSubmit}
        />
      )}

      {isCodeInput && (
        <CodeInput
          input={input}
          setInput={setInput}
          revealed={revealed}
          disabled={disabled}
          pyLoading={pyLoading}
          codeRunResult={codeRunResult}
          onSubmit={handleCodeSubmit}
        />
      )}

      {/* 결과 영역 */}
      {revealed && (
        <div className={`quiz-explanation ${isCorrectResult ? 'correct' : 'wrong'}`}>
          <div style={{ marginBottom: '8px' }}>
            {isCorrectResult ? '✅ 정답!' : '❌ 오답'}
          </div>

          {isCorrectResult && (
            <>
              <p>{question.feedback?.correct || question.explanation}</p>
              <button
                className="btn btn-primary btn-sm"
                style={{ width: '100%', marginTop: '12px' }}
                onClick={onNext}
              >
                다음으로 ➔
              </button>
            </>
          )}

          {!isCorrectResult && (
            <AiFeedback
              aiFeedback={aiFeedback}
              aiFeedbackLoading={aiFeedbackLoading}
              onRetry={handleRetry}
              onNext={onNext}
            />
          )}
        </div>
      )}
    </div>
  )
}
