// 서버 채점 결과 모달. B-2 차등 보상 정책(신규완료 300 / 복습1~2회차 200 / 반복복습 100 /
// 부분성공 100 / 실패 0 / 하루 3판 초과 0)을 그대로 문구로 반영한다.
// 정답 문자열은 서버가 내려주지 않으므로 여기서 정답을 노출하지 않는다.

// 완료(score===100) 여부와 무관하게 always 적용되는 큰 타이틀.
function resolveTitle(result) {
  if (result.score >= 100) {
    return result.is_first_completion ? '새 세트 완료!' : '복습 완료!'
  }
  return '아쉬워요!'
}

function resolveEmoji(result) {
  if (result.score >= 100) return result.is_first_completion ? '🎉' : '✨'
  if (result.score >= 80) return '💪'
  return '😅'
}

// 보상 안내 줄(타이틀 아래). already_claimed(하루 3판 초과)는 점수/완료 여부와 무관하게
// 최우선으로 "보상 소진" 문구로 대체한다 — 완료 자체는 계속 저장되지만 이번 판은 무보상.
function resolveRewardLines(result) {
  if (result.already_claimed) {
    return [{ text: '오늘 에이칸 보상은 모두 받았어요. 그래도 복습은 계속할 수 있어요.', tone: 'claimed' }]
  }
  const coin = result.reward?.coin_delta ?? 0
  if (result.score >= 100) {
    return coin > 0 ? [{ text: `+${coin} 코인 획득`, tone: 'reward' }] : []
  }
  if (result.score >= 80) {
    return [
      { text: '80점 이상 보상 +100', tone: 'reward' },
      { text: '100점이면 세트 완료 처리돼요.', tone: 'muted' },
    ]
  }
  return [{ text: '80점 이상부터 보상을 받을 수 있어요.', tone: 'muted' }]
}

export default function WinModal({ result, won, onClose, onRetry }) {
  const submitFailed = !!result?.submit_failed

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

  if (!result) {
    return (
      <div className="aicross-win-overlay">
        <div className="aicross-win-modal">
          <div className="aicross-win-emoji">⏳</div>
          <div className="aicross-win-title">채점 중…</div>
        </div>
      </div>
    )
  }

  const {
    score = 0,
    correct,
    total,
    is_first_completion: isFirstCompletion,
    set_clear_count: setClearCount,
    today_reward_count: todayRewardCount,
    today_reward_limit: todayRewardLimit,
    already_claimed: alreadyClaimed,
  } = result

  const title = resolveTitle(result)
  const emoji = resolveEmoji(result)
  const rewardLines = resolveRewardLines(result)
  const hasScoreDetail = Number.isInteger(correct) && Number.isInteger(total)

  return (
    <div className="aicross-win-overlay">
      <div className="aicross-win-modal">
        <div className="aicross-win-emoji">{emoji}</div>
        <div className="aicross-win-title">{title}</div>
        <div className="aicross-win-sub">
          {hasScoreDetail ? `${total}개 중 ${correct}개 정답 (${score}점)` : `${score}점`}
        </div>

        {rewardLines.map((line, i) => (
          <div
            key={i}
            className={[
              'aicross-win-reward',
              line.tone === 'claimed' ? 'aicross-win-reward--claimed' : '',
              line.tone === 'muted' ? 'aicross-win-reward--muted' : '',
            ].filter(Boolean).join(' ')}
          >
            {line.text}
          </div>
        ))}

        <div className="aicross-win-meta">
          {score >= 100 && (
            <span>{isFirstCompletion ? '신규 세트 완료' : `누적 클리어 ${setClearCount}회차`}</span>
          )}
          {Number.isInteger(todayRewardCount) && Number.isInteger(todayRewardLimit) && (
            <span>오늘 보상 {todayRewardCount} / {todayRewardLimit}{alreadyClaimed ? ' (소진)' : ''}</span>
          )}
        </div>

        <div className="aicross-win-actions">
          {won ? (
            <button className="acbtn acbtn--next" onClick={onClose}>다음 주제로</button>
          ) : (
            <>
              {onRetry && <button className="acbtn acbtn--next" onClick={onRetry}>다시 도전</button>}
              <button className="acbtn acbtn--next" onClick={onClose}>✕</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
