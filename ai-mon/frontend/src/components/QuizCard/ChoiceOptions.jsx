const LABELS = ['A', 'B', 'C', 'D', 'E']

function stripLabel(opt) {
  // "A. answer text" → "answer text"
  return opt.replace(/^[A-E]\.\s*/, '')
}

export default function ChoiceOptions({
  choicesList,
  selected,
  revealed,
  disabled,
  answer,
  onSelect,
  onSubmit,
}) {
  const isLetterAnswer = answer?.length === 1 && /^[A-Z]$/.test(answer)

  const isCorrect = (opt) => {
    if (!revealed) return false
    return isLetterAnswer ? opt.startsWith(answer + '.') : opt === answer
  }

  const isWrong = (opt) => {
    if (!revealed) return false
    if (isLetterAnswer) return opt === selected && !opt.startsWith(answer + '.')
    return opt === selected && opt !== answer
  }

  const normalizedChoices = choicesList.map(opt => opt.replace(/\\n/g, '\n'))
  
  return (
    <div className="quiz-options stagger">
      {normalizedChoices.map((opt, i) => (
        <button
          key={opt}
          id={`option-${opt.replace(/\s+/g, '-')}`}
          className={[
            'quiz-option',
            selected === opt  ? 'selected' : '',
            isCorrect(opt)    ? 'correct'  : '',
            isWrong(opt)      ? 'wrong'    : '',
          ].join(' ')}
          onClick={() => onSelect(opt)}
          disabled={disabled || revealed}
        >
          <span className="opt-label">{LABELS[i] ?? i + 1}</span>
          <span>
            {stripLabel(opt).split(/\\n|\n/).map((line, li, arr) => (
              <span key={li}>{line}{li < arr.length - 1 && <br />}</span>
            ))}
          </span>
        </button>
      ))}
      {!revealed && (
        <button
          className="quiz-submit-btn"
          disabled={!selected || disabled}
          onClick={onSubmit}
        >
          확인하기
        </button>
      )}
    </div>
  )
}
