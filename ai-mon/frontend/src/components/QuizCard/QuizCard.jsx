import { useState } from 'react'
import { quizApi } from '../../api/index'
import { usePyodide } from '../../hooks/usePyodide'
import { useAuthStore } from '../../hooks/useAuthStore'
import ChoiceOptions from './ChoiceOptions'
import FillInput from './FillInput'
import CodeInput from './CodeInput'
import AiFeedback from './AiFeedback'
import './QuizCard.css'

export default function QuizCard({ question, onAnswer, onNext, disabled = false }) {
  const [selected,          setSelected]          = useState(null)
  const [input,             setInput]             = useState('')
  const [revealed,          setRevealed]          = useState(false)
  const [retried,           setRetried]           = useState(false)
  const [aiFeedback,        setAiFeedback]        = useState('')
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false)
  const [codeRunResult,     setCodeRunResult]     = useState(null)
  const [isCorrectResult,   setIsCorrectResult]   = useState(null)

  const { runPython, pyLoading } = usePyodide()
  const user        = useAuthStore((s) => s.user)
  const courseLevel = user?.course_level || 'beginner'

  if (!question) return null

  const type          = question.quiz_type || question.type
  const isChoiceType  = type === 'multiple_choice' || type === 'output_select' || type === 'error_find'
  const isCodeInput   = type === 'code_input'
  const choicesList   = question.choices || question.options || []

  // ── AI 피드백 호출 ──
  const fetchAiFeedback = async (userAnswer) => {
    const staticFallback = question.feedback?.wrong || '정답을 다시 확인해 보세요!'
    setAiFeedback(staticFallback)
    setAiFeedbackLoading(true)

    let fullQuestionText = question.question
    if (isChoiceType && choicesList.length > 0) {
      fullQuestionText += '\n\n[선택지]\n' + choicesList.join('\n')
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await quizApi.getAiFeedback(
        {
          question:       fullQuestionText,
          correct_answer: question.answer,
          user_answer:    userAnswer,
          level:          courseLevel,
        },
        { signal: controller.signal }
      )
      if (res.data?.feedback && !res.data?.is_ai_fallback) {
        setAiFeedback(res.data.feedback)
      }
    } catch {
      // 타임아웃/네트워크 오류 → staticFallback 유지
    } finally {
      clearTimeout(timer)
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
        <p>{question.question}</p>
      </div>

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
