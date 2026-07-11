import { useEffect, useRef, useMemo } from 'react'

export default function MultiBlankInput({
  type,
  codeTemplate,
  answersCount,
  values,
  choices,
  correctAnswers,
  onChange,
  revealed,
  disabled,
  submitting,
  onSubmit,
  gradingError,
}) {
  const firstInputRef = useRef(null)

  useEffect(() => {
    // Focus first input on mount
    if (firstInputRef.current && !disabled && !revealed) {
      firstInputRef.current.focus()
    }
  }, [codeTemplate, disabled, revealed])

  const templateLines = codeTemplate ? codeTemplate.split('\n') : []

  // Parse lines for slots
  const parseLine = (line) => {
    const regex = /\{slot(\d+)\}/g
    const parts = []
    let lastIndex = 0
    let match
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: line.substring(lastIndex, match.index) })
      }
      parts.push({ type: 'slot', index: parseInt(match[1], 10) })
      lastIndex = regex.lastIndex
    }
    if (lastIndex < line.length) {
      parts.push({ type: 'text', content: line.substring(lastIndex) })
    }
    return parts
  }

  // Create slot numbers 1 to answersCount
  const slotIndices = Array.from({ length: answersCount }, (_, i) => i + 1)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit()
  }

  const displayChoices = useMemo(() => {
    if (choices && choices.length > 0) {
      return choices
    }
    if (Array.isArray(correctAnswers)) {
      const correct = correctAnswers
      const distractors = ['await', 'run', 'async', 'gather', 'sleep(1)', 'create_task', 'def'].filter(
        d => !correct.includes(d)
      )
      const targetCount = Math.max(5, correct.length + 1)
      const extra = distractors.slice(0, targetCount - correct.length)
      const combined = [...correct, ...extra]
      return combined.sort(() => 0.5 - Math.random())
    }
    return []
  }, [choices, correctAnswers])

  return (
    <div className="quiz-multi-blank">
      <div className="mbi-container">
        {/* Left Side: Code Block with Inline Slot Visualizer */}
        <div className="mbi-left">
          <div className="quiz-code-editor-lbl"># 코드 빈칸 채우기</div>
          <div className="mbi-code-block">
            <pre className="mbi-pre">
              {templateLines.map((line, lineIdx) => {
                const parts = parseLine(line)
                return (
                  <div key={lineIdx} className="mbi-code-line">
                    {parts.map((part, partIdx) => {
                      if (part.type === 'text') {
                        return <span key={partIdx} className="mbi-code-text">{part.content}</span>
                      } else {
                        const slotNum = part.index
                        const val = values[slotNum - 1] || ''
                        return (
                          <input
                            key={partIdx}
                            type="text"
                            className={`mbi-inline-input ${val ? 'has-val' : ''} ${revealed ? 'revealed' : ''}`}
                            value={val}
                            onChange={(e) => onChange(slotNum - 1, e.target.value)}
                            disabled={disabled || revealed}
                            placeholder={`blank ${slotNum}`}
                            style={{
                              width: `${Math.max(80, val.length * 9 + 24)}px`,
                            }}
                            ref={slotNum === 1 ? firstInputRef : null}
                          />
                        )
                      }
                    })}
                  </div>
                )
              })}
            </pre>
          </div>
          {displayChoices && displayChoices.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#4C4465', marginBottom: '6px' }}>
                {type === 'code_input' ? '알맞은 코드를 선택하여 입력하세요.' : '다음 코드 조각을 순서에 맞게 입력하세요.'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {displayChoices.map((choice, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#F3F4F6',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontFamily: "'D2Coding', monospace",
                      fontSize: '14px',
                      color: '#1F2937',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {choice}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Sidebar listing of input fields (옆에 배치) */}
        <div className="mbi-right">
          <div className="mbi-sidebar-title">답안 작성</div>
          <form onSubmit={handleSubmit} className="mbi-inputs-form">
            <div className="mbi-inputs-grid">
              {slotIndices.map((slotNum) => (
                <div key={slotNum} className="mbi-sidebar-item">
                  <span className="mbi-sidebar-label">blank {slotNum}</span>
                  <input
                    type="text"
                    className="mbi-sidebar-input"
                    placeholder={`blank ${slotNum} input...`}
                    value={values[slotNum - 1] || ''}
                    onChange={(e) => onChange(slotNum - 1, e.target.value)}
                    disabled={disabled || revealed}
                  />
                </div>
              ))}
            </div>

            {gradingError && (
              <div className="quiz-code-grading-error" style={{ color: '#DC2626', margin: '8px 0', fontSize: '13px' }}>
                {gradingError}
              </div>
            )}

            <button
              type="submit"
              className="quiz-submit-btn"
              disabled={values.some(v => !v?.trim()) || disabled || revealed || submitting}
            >
              {submitting ? '🤖 채점 중...' : '확인하기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
