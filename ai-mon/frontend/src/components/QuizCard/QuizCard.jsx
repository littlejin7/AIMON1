import { useState, useEffect } from 'react'
import { quizApi, codeApi } from '../../api/index'
import { usePyodide } from '../../hooks/usePyodide'
import { useAuthStore } from '../../hooks/useAuthStore'
import ChoiceOptions from './ChoiceOptions'
import ErrorFindLines from './ErrorFindLines'
import FillInput from './FillInput'
import CodeInput from './CodeInput'
import AiFeedback from './AiFeedback'
import { getFillFeedback } from '../../data/fillFeedback'
import { getChoiceFeedback, choiceLetterOf } from '../../data/choiceFeedback'
import './QuizCard.css'

function parseQuestionContent(raw) {
  const regex = /```(?:python)?\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: raw.substring(lastIndex, match.index)
      });
    }
    parts.push({
      type: 'code',
      lines: match[1].trimEnd().split('\n')
    });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < raw.length) {
    parts.push({
      type: 'text',
      content: raw.substring(lastIndex)
    });
  }
  return parts;
}


function CodeBlock({ lines }) {
  return (
    <div style={{
      background: '#1E1B4B', borderRadius: '11px',
      padding: '11px 13px', overflowX: 'auto', margin: '0 0 8px',
    }}>
      <pre style={{
        fontFamily: "'d2coding', monospace", fontSize: '18px',
        lineHeight: '1.7', color: '#ffffff', whiteSpace: 'pre-wrap', margin: 0,
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
  stageKey = '',
  disabled = false,
  initialSelected = null,
  initialInput = '',
  initialRevealed = false,
  initialAiFeedback = '',
  initialIsCorrectResult = null,
  onFeedbackUpdate,
}) {
  const [selected, setSelected] = useState(initialSelected)
  const [input, setInput] = useState(initialInput)
  const [revealed, setRevealed] = useState(initialRevealed)
  const [retried, setRetried] = useState(false)
  const [aiFeedback, setAiFeedback] = useState(initialAiFeedback)
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false)
  const [codeRunResult, setCodeRunResult] = useState(null)
  const [isCorrectResult, setIsCorrectResult] = useState(initialIsCorrectResult)
  const [gradingError, setGradingError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // 서버 채점 응답에서 받은 reveal 정보(F: 정답이 클라 문제객체엔 없음).
  // correct_answer 는 '제출 후' 응답에만 담겨 와서 reveal 하이라이트에만 쓰인다.
  const [revealedAnswer, setRevealedAnswer] = useState('')
  const [revealFeedback, setRevealFeedback] = useState('')

  const { runPython, pyLoading } = usePyodide()
  const user = useAuthStore((s) => s.user)
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

  const parsedContent = parseQuestionContent(rawQuestion)
  const codeLines = parsedContent.find(p => p.type === 'code')?.lines || null

  const type = question.quiz_type || question.type
  const choicesList = question.choices || question.options || []


  // "N줄:" 형식 코드 + "A. N줄" 형식 선택지 → 줄 클릭 UI
  const isLineSelectErrorFind =
    type === 'error_find' &&
    codeLines?.length > 0 &&
    /^\d+줄:/.test(codeLines[0])

  const isChoiceType = type === 'multiple_choice' || type === 'output_select' ||
    (type === 'error_find' && !isLineSelectErrorFind)
  const isCodeInput = type === 'code_input'




  // ── AI 피드백 호출 (SSE 스트리밍) ──
  // correct_answer 는 더 이상 보내지 않는다(F: 클라에 정답 없음). 서버가 question_id 로 조회.
  const fetchAiFeedback = async (userAnswer, fallbackText) => {
    const staticFallback = fallbackText || '정답을 다시 확인해 보세요!'

    // fill_in_blank: 정답이 1개라 오답 해설을 문항당 1건으로 고정할 수 있다.
    // 사전 생성 정적 번들(src/data/fillFeedback)에서 먼저 찾고, 히트하면 Claude 호출을
    // 건너뛴다(토큰·왕복 절감). 미스/오류면 아래 기존 Claude 스트리밍으로 폴백.
    if (type === 'fill_in_blank') {
      try {
        const unit = parseInt(question.unit, 10) ||
          parseInt(String(stageKey).split('-')[0], 10)
        const qid = question.question_id || question.id || ''
        const bundled = await getFillFeedback(courseLevel, unit, qid)
        if (bundled) {
          setAiFeedback(bundled)
          return
        }
      } catch { /* 번들 미스/오류 → Claude 폴백 */ }
    }

    // 객관식: 오답은 선택지 개수로 유한 → 선택지별 고정 해설을 사전 생성 번들에서 조회.
    // 히트하면 Claude 호출을 건너뛴다. 미스(신규 문항/번들 미포함)면 Claude 폴백.
    if (isChoiceType) {
      try {
        const unit = parseInt(question.unit, 10) ||
          parseInt(String(stageKey).split('-')[0], 10)
        const qid = question.question_id || question.id || ''
        const map = await getChoiceFeedback(courseLevel, unit, qid)
        if (map) {
          const letter = choiceLetterOf(userAnswer, choicesList)
          const bundled = letter && map[letter]
          if (bundled) {
            setAiFeedback(bundled)
            return
          }
        }
      } catch { /* 번들 미스/오류 → Claude 폴백 */ }
    }

    setAiFeedbackLoading(true)

    let fullQuestionText = question.question
    if (isChoiceType && choicesList.length > 0) {
      fullQuestionText += '\n\n[선택지]\n' + choicesList.join('\n')
    }

    const body = JSON.stringify({
      question_id: question.question_id || question.id || '',
      question: fullQuestionText,
      user_answer: userAnswer,
      level: courseLevel,
    })

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    const token = (await import('../../hooks/useAuthStore')).useAuthStore.getState().token
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    try {
      const res = await fetch(`${baseUrl}/quiz/ai-feedback/stream`, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
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
    } catch {
      // 스트리밍 실패 → 기존 단순 POST 폴백
      try {
        const res = await quizApi.getAiFeedback({
          question_id: question.question_id || question.id || '',
          question: fullQuestionText,
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

  // ── 공통: 서버 채점 결과 적용 ──
  // 클라는 정답을 모른다(F). onAnswer 가 서버 채점을 수행하고 결과를 돌려준다.
  const applyGradeResult = (result, userAnswer) => {
    const r = result || { is_correct: false, feedback: '', hint: '', correct_answer: '' }
    setRevealed(true)
    setRevealedAnswer(r.correct_answer || '')
    setIsCorrectResult(!!r.is_correct)
    setRevealFeedback(r.feedback || '')
    if (!r.is_correct) {
      // 서버 정적 피드백을 우선 노출 후 AI 스트리밍으로 보강
      if (r.feedback) setAiFeedback(r.feedback)
      fetchAiFeedback(userAnswer, r.feedback)
    }
  }

  // ── 객관식 제출 (서버 채점) ──
  const handleSubmitChoice = async () => {
    if (!selected || revealed || submitting) return
    setGradingError('')
    setSubmitting(true)
    let result
    try {
      result = await onAnswer?.({ userAnswer: selected, retried })
    } catch {
      setSubmitting(false)
      setGradingError('채점 서버에 연결하지 못했어요. 잠시 후 다시 [확인하기]를 눌러주세요.')
      return
    }
    setSubmitting(false)
    applyGradeResult(result, selected)
  }

  // ── 단답 제출 (서버 채점) ──
  const handleFillSubmit = async () => {
    if (!input.trim() || revealed || submitting) return
    const answer = input.trim()
    setSelected(answer)
    setGradingError('')
    setSubmitting(true)
    let result
    try {
      result = await onAnswer?.({ userAnswer: answer, retried })
    } catch {
      setSubmitting(false)
      setGradingError('채점 서버에 연결하지 못했어요. 잠시 후 다시 [확인하기]를 눌러주세요.')
      return
    }
    setSubmitting(false)
    applyGradeResult(result, answer)
  }

  // ── 코드 실행 (출력 확인 전용, 채점 없음) ──
  const handleCodeRun = async () => {
    if (!input.trim() || revealed) return
    setGradingError('')
    const result = await runPython(input)
    setCodeRunResult(result)
  }

  // ── 코드 제출 (채점·revealed·onAnswer 전담) ──
  // 채점 단일 소스 = 백엔드 /code/submit. Pyodide 는 실행/출력 표시 + output·error 전달용(채점 권한 아님).
  // award=false: Train·미니보스 모두 무보상으로 호출 — 백엔드가 200 XP·(unit,stage) 진행도를 쓰지 않는다.
  // 미니보스 보상은 onAnswer → Stage.handleAnswer → minibossApi.submitAnswer(HP/클리어/보상)가 소유.
  const handleCodeSubmit = async () => {
    if (!input.trim() || revealed) return
    setGradingError('')

    // 1) Pyodide 실행 → 출력/에러 표시 및 백엔드 전달값 확보
    const runResult = await runPython(input)
    setCodeRunResult(runResult)

    const unit = parseInt(question.unit, 10) || parseInt(String(stageKey).split('-')[0], 10) || 1
    const stage = question.stage || stageKey || ''

    // 2) 백엔드 채점 호출 (submitting = '🤖 채점 중...' 로딩, pyLoading 과 별개)
    setSubmitting(true)
    let res
    try {
      res = await codeApi.submitCode({
        question_id: question.question_id || question.id || '',
        code: input,
        output: runResult.stdout || '',
        error: runResult.stderr || runResult.compile_output || '',
        unit,
        stage,
        course_level: courseLevel,
        award: false,
      })
    } catch {
      // 백엔드 호출 실패 → HP/XP/진행도 미변경 + 재시도 안내 (D-1 규칙)
      setGradingError('채점 서버에 연결하지 못했어요. 잠시 후 다시 [확인하기]를 눌러주세요.')
      return
    } finally {
      setSubmitting(false)
    }

    const data = res?.data || {}
    // AI 채점 실패 → 상태 변경 없이 재시도 안내 (D-1 규칙)
    if (data.grading_failed) {
      setGradingError('AI 채점이 일시적으로 실패했어요. 잠시 후 다시 [확인하기]를 눌러주세요.')
      return
    }

    // 3) 백엔드 결과로 정답표시 — /code/submit 가 코드 채점 단일 소스
    const correct = !!data.is_correct
    setSelected(input)
    setRevealed(true)
    setIsCorrectResult(correct)
    // onAnswer 가 결과를 서버에 기록(미니보스는 배틀세션, 일반은 /attempts)하고 reveal 정보 반환
    let result
    try {
      result = await onAnswer?.({ userAnswer: input, retried, clientIsCorrect: correct })
    } catch { result = null }
    const r = result || {}
    setRevealedAnswer(r.correct_answer || '')
    setRevealFeedback(r.feedback || '')
    if (!correct) setAiFeedback(data.feedback || r.feedback || '정답을 다시 확인해 보세요!')
  }

  // ── 다시 풀기 ──
  const handleRetry = () => {
    setRevealed(false)
    setSelected(null)
    setInput('')
    setAiFeedback('')
    setGradingError('')
    setRetried(true)
  }

  return (
    <div className="quiz-card animate-fade-in-up">
      {/* 문제 */}
      <div className="quiz-question" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {parsedContent.map((part, idx) => {
          if (part.type === 'code' && !isLineSelectErrorFind) {
            return <CodeBlock key={idx} lines={part.lines} />;
          } else if (part.type === 'text') {
            return (
              <p key={idx} style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {part.content.trim()}
              </p>
            );
          }
          return null;
        })}
      </div>

      {isLineSelectErrorFind && (
        <ErrorFindLines
          codeLines={codeLines}
          choicesList={choicesList}
          selected={selected}
          revealed={revealed}
          answer={revealedAnswer}
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
          disabled={disabled || submitting}
          answer={revealedAnswer}
          onSelect={(opt) => { if (!revealed) setSelected(opt) }}
          onSubmit={handleSubmitChoice}
        />
      )}

      {!isChoiceType && !isCodeInput && (
        <FillInput
          input={input}
          setInput={setInput}
          revealed={revealed}
          disabled={disabled || submitting}
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
          gradingError={gradingError}
          submitting={submitting}
          onRun={handleCodeRun}
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
              <p>{revealFeedback}</p>
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
