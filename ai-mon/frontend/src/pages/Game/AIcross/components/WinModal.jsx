// 서버 채점 결과 모달. score===100 이면 완성(win), 그 외엔 결과/재도전 안내.
// 정답 문자열은 서버가 내려주지 않으므로 여기서 정답을 노출하지 않는다.
export default function WinModal({ result, won, onClose, onRetry }) {
  const submitFailed = !!result?.submit_failed
  const score = result?.score ?? 0
  const correct = result?.correct
  const total = result?.total
  // 신규 계약: reward.coin_delta/gp_delta. 구 응답(xp_awarded) 은 폴백.
  const coinAwarded = result?.reward?.coin_delta ?? result?.xp_awarded ?? 0
  const gpAwarded = result?.reward?.gp_delta ?? 0

  if (submitFailed) {
    return (
      <div className="aicross-win-overlay">
        <div className="aicross-win-modal">
          <div className="aicross-win-emoji">⚠️</div>
          <div className="aicross-win-title">제출 실패</div>
          <div className="aicross-win-sub">잠시 후 다시 시도해주세요.</div>
          <div className="aicross-win-actions">
            {onRetry && <button className="acbtn acbtn--next" onClick={onRetry}>다시 도전</button>}
            <button className="acbtn acbtn--next" onClick={onClose}>✕</button>
          </div>
        </div>
      </div>
    )
  }

  if (won) {
    return (
      <div className="aicross-win-overlay">
        <div className="aicross-win-modal">
          <div className="aicross-win-emoji">🎉</div>
          <div className="aicross-win-title">완성!</div>
          <div className="aicross-win-sub">모든 단어를 맞혔어요!</div>
          {result ? (
            result.already_claimed
              ? <div className="aicross-win-reward aicross-win-reward--claimed">오늘 보상은 이미 받았어요 (최대 3판)</div>
              : (
                <>
                  <div className="aicross-win-reward">⚡ +{coinAwarded} 코인 획득!</div>
                  {gpAwarded > 0 && <div className="aicross-win-reward">💠 +{gpAwarded} GP 획득!</div>}
                </>
              )
          ) : (
            <div className="aicross-win-reward aicross-win-reward--loading">보상 계산 중…</div>
          )}
          <button className="acbtn acbtn--next" onClick={onClose}>✕</button>
        </div>
      </div>
    )
  }

  // 미완성: 서버 점수/정답 개수만 안내하고 재도전 유도 (cell별 정오 표시는 하지 않음)
  return (
    <div className="aicross-win-overlay">
      <div className="aicross-win-modal">
        <div className="aicross-win-emoji">💪</div>
        <div className="aicross-win-title">아쉬워요!</div>
        <div className="aicross-win-sub">
          {Number.isInteger(correct) && Number.isInteger(total)
            ? `${total}개 중 ${correct}개 정답 (${score}점)`
            : `${score}점`}
        </div>
        {result && !result.already_claimed && coinAwarded > 0 && (
          <>
            <div className="aicross-win-reward">⚡ +{coinAwarded} 코인 획득!</div>
            {gpAwarded > 0 && <div className="aicross-win-reward">💠 +{gpAwarded} GP 획득!</div>}
          </>
        )}
        {result?.already_claimed && (
          <div className="aicross-win-reward aicross-win-reward--claimed">오늘 보상은 이미 받았어요 (최대 3판)</div>
        )}
        <div className="aicross-win-actions">
          {onRetry && <button className="acbtn acbtn--next" onClick={onRetry}>다시 도전</button>}
          <button className="acbtn acbtn--next" onClick={onClose}>✕</button>
        </div>
      </div>
    </div>
  )
}
