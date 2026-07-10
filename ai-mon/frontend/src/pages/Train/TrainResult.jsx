export default function TrainResult({ correctCount, total, onDone }) {
  const safeTotal = Math.max(total || 0, 1)
  const accuracy = Math.round((correctCount / safeTotal) * 100)
  const isPerfect = correctCount === total
  const missedCount = Math.max((total || 0) - correctCount, 0)
  const resultTone = isPerfect ? 'perfect' : 'complete'

  return (
    <div className={`tr-result-page tr-result-page--${resultTone}`}>
      <section className="tr-result-hero" aria-labelledby="train-result-title">
        <div className="tr-result-shine" aria-hidden="true" />

        <div className="tr-result-badge">
          <span className="tr-result-badge-dot" />
          {isPerfect ? 'PERFECT CLEAR' : 'TRAINING COMPLETE'}
        </div>

        <div className="tr-result-medal" aria-hidden="true">
          <span className="tr-result-medal-mark">{isPerfect ? '✓' : '•'}</span>
        </div>

        <div className="tr-result-copy">
          <h1 id="train-result-title" className="tr-result-title">
            {isPerfect ? '완벽 클리어!' : '훈련 완료!'}
          </h1>
          <p className="tr-result-subtitle">
            {isPerfect
              ? '첫 시도 기준으로 모든 문제를 정확히 해결했어요.'
              : `${missedCount}문제만 더 다듬으면 완벽 클리어예요.`}
          </p>
        </div>

        <div
          className="tr-result-score-ring"
          style={{ '--tr-score': `${accuracy}%` }}
          aria-label={`정확도 ${accuracy}%`}
        >
          <div className="tr-result-score-inner">
            <span className="tr-result-score-value">{accuracy}</span>
            <span className="tr-result-score-unit">%</span>
          </div>
        </div>
      </section>

      <section className="tr-result-summary" aria-label="훈련 결과 요약">
        <div className="tr-result-stat">
          <span className="tr-result-stat-label">정답</span>
          <strong>{correctCount}</strong>
        </div>
        <div className="tr-result-stat">
          <span className="tr-result-stat-label">전체</span>
          <strong>{total}</strong>
        </div>
        <div className="tr-result-stat">
          <span className="tr-result-stat-label">오답</span>
          <strong>{missedCount}</strong>
        </div>
      </section>

      <section className="tr-result-note" aria-label="훈련 결과 메시지">
        <span className="tr-result-note-icon">{isPerfect ? '✨' : '↻'}</span>
        <div>
          <strong>{isPerfect ? '오답 없이 마쳤습니다' : '복습 포인트가 남아 있어요'}</strong>
          <p>
            {isPerfect
              ? '지금 흐름 그대로 다음 훈련으로 이어가도 좋습니다.'
              : '틀린 문제는 오답 훈련에서 다시 확인할 수 있습니다.'}
          </p>
        </div>
      </section>

      <button className="tr-result-done-btn" onClick={onDone}>
        훈련 종료
      </button>
    </div>
  )
}
