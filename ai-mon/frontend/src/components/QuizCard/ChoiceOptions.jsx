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

  return (
    <div className="quiz-options stagger">
      {choicesList.map((opt) => (
        <button
          key={opt}
          id={`option-${opt.replace(/\s+/g, '-')}`}
          className={[
            'quiz-option',
            selected === opt ? 'selected' : '',
            isCorrect(opt) ? 'correct' : '',
            isWrong(opt)   ? 'wrong'   : '',
          ].join(' ')}
          onClick={() => onSelect(opt)}
          disabled={disabled || revealed}
        >
          <span className="option-bullet" />
          {opt}
        </button>
      ))}
      {!revealed && (
        <button
          className="btn btn-primary btn-full"
          style={{ marginTop: '12px' }}
          disabled={!selected || disabled}
          onClick={onSubmit}
        >
          확인하기 ✓
        </button>
      )}
    </div>
  )
}
