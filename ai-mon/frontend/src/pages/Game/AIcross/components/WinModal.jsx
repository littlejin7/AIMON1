export default function WinModal({ reward, onClose }) {
  return (
    <div className="aicross-win-overlay">
      <div className="aicross-win-modal">
        <div className="aicross-win-emoji">🎉</div>
        <div className="aicross-win-title">완성!</div>
        <div className="aicross-win-sub">모든 단어를 맞혔어요!</div>
        {reward ? (
          reward.already_claimed
            ? <div className="aicross-win-xp aicross-win-xp--claimed">오늘 보상은 이미 받았어요 (최대 3판)</div>
            : <div className="aicross-win-xp">⚡ +{reward.xp_awarded} XP 획득!</div>
        ) : (
          <div className="aicross-win-xp aicross-win-xp--loading">보상 계산 중…</div>
        )}
        <button className="acbtn acbtn--next" onClick={onClose}>✕</button>
      </div>
    </div>
  )
}
