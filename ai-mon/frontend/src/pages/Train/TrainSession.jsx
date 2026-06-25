import QuizCard from '../../components/QuizCard/QuizCard'

export default function TrainSession({
  questions,
  current,
  answers,
  onStop,
  onPrev,
  onNext,
  onAnswer,
  onFeedbackUpdate,
  finishTraining,
}) {
  const q = questions[current]
  return (
    <div className="train-page">
      <div className="train-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={onStop}>✕ 중단하기</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-ghost btn-sm" onClick={onPrev} disabled={current === 0}>◀ 이전</button>
          <div className="train-progress">{current + 1} / {questions.length}</div>
          <button className="btn btn-ghost btn-sm" onClick={onNext}>
            {current === questions.length - 1 ? '완료 ▶' : '다음 ▶'}
          </button>
        </div>
      </div>
      <div className="container">
        <QuizCard
          key={current}
          question={q}
          onAnswer={onAnswer}
          onNext={onNext}
          initialSelected={answers[current]?.selected}
          initialInput={answers[current]?.input}
          initialRevealed={answers[current]?.revealed}
          initialAiFeedback={answers[current]?.aiFeedback}
          initialIsCorrectResult={answers[current]?.isCorrectResult}
          onFeedbackUpdate={(text) => onFeedbackUpdate(current, text)}
        />
      </div>
    </div>
  )
}
