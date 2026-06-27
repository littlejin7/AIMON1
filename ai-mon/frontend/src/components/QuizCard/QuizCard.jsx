import { useState, useEffect } from 'react'
import { quizApi } from '../../api/index'
import { usePyodide } from '../../hooks/usePyodide'
import { useAuthStore } from '../../hooks/useAuthStore'
import ChoiceOptions from './ChoiceOptions'
import ErrorFindLines from './ErrorFindLines'
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

function CodeBlock({ lines }) {
  return (
    <div style={{
      background: '#1E1B4B', borderRadius: '11px',
      padding: '11px 13px', overflowX: 'auto', margin: '0 0 8px',
    }}>
      <pre style={{
        fontFamily: "'d2coding', monospace", fontSize: '18px',
        lineHeight: '1.7', color: '#ffffff', whiteSpace: 'pre', margin: 0,
      }}>
        {lines.map((line, i) => (
          <div key={i} style={{ color: line.trim().startsWith('#') ? '#6B7280' : '#E9D5FF' }}>
            {line}
          </div>
        ))}
      </pre>
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
  const choicesList   = question.choices || question.options || []


  // "N줄:" 형식 코드 + "A. N줄" 형식 선택지 → 줄 클릭 UI
  const isLineSelectErrorFind =
    type === 'error_find' &&
    codeLines?.length > 0 &&
    /^\d+줄:/.test(codeLines[0])

  const isChoiceType  = type === 'multiple_choice' || type === 'output_select' ||
                        (type === 'error_find' && !isLineSelectErrorFind)
  const isCodeInput   = type === 'code_input'



  
  // ── AI 피드백 호출 (SSE 스트리밍) ──
  const fetchAiFeedback = async (userAnswer) => {
    const staticFallback = question.feedback?.wrong || '정답을 다시 확인해 보세요!'
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

      // 스트리밍이 빈 응답으로 끝난 경우 staticFallback
      if (!accumulated) setAiFeedback(staticFallback)
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
        if (res.data?.feedback && !res.data?.is_ai_fallback) {
          setAiFeedback(res.data.feedback)
        } else {
          setAiFeedback(staticFallback)
        }
      } catch {
        setAiFeedback(staticFallback)
      }
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
        <p>{questionText}</p>
      </div>
      {codeLines && !isLineSelectErrorFind && <CodeBlock lines={codeLines} />}

      {isLineSelectErrorFind && (
        <ErrorFindLines
          codeLines={codeLines}
          choicesList={choicesList}
          selected={selected}
          revealed={revealed}
          answer={question.answer}
          onSelect={(opt) => { if (!revealed) setSelected(opt) }}
          onSubmit={handleSubmitChoice}
        />
      )}


      
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
              <button className="quiz-submit-btn" onClick={onNext}>
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
