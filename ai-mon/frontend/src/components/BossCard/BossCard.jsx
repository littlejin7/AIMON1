import './BossCard.css'

export default function BossCard({ bossName = '드래곤 보스', hp = 100, maxHp = 100, phase = 1 }) {
  const hpPercent = Math.max(0, (hp / maxHp) * 100)
  const hpColor = hpPercent > 60 ? '#ef4444' : hpPercent > 30 ? '#f59e0b' : '#6b7280'

  return (
    <div className="boss-card animate-fade-in-up">
      <div className="boss-aura" />
      <div className="boss-header">
        <span className="badge badge-danger">⚔️ 보스 전투</span>
        <span className="badge badge-warning">Phase {phase}</span>
      </div>

      <div className="boss-avatar animate-float">
        <span className="boss-emoji"></span>
        <div className="boss-glow" />
      </div>

      <div className="boss-name">{bossName}</div>

      <div className="boss-hp-section">
        <div className="boss-hp-label">
          <span>HP</span>
          <span style={{ color: hpColor }}>{hp} / {maxHp}</span>
        </div>
        <div className="boss-hp-bar">
          <div
            className="boss-hp-fill"
            style={{ width: `${hpPercent}%`, background: `linear-gradient(90deg, ${hpColor}, #ff6b6b)` }}
          />
        </div>
      </div>

      <p className="boss-taunt">
        {hpPercent > 60
          ? '"과연 나를 이길 수 있을까...? 🔥"'
          : hpPercent > 30
          ? '"제법이군... 하지만 아직 멀었다! 💥"'
          : '"이...이럴 수가! 거의 다 왔다! 😱"'}
      </p>
    </div>
  )
}
