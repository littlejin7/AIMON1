import './CharacterDisplay.css'

const CHARACTER_MAP = {
  default: { emoji: '🤖', name: '에이몬 기본형', color: '#7c3aed', title: '입문자' },
  fire:    { emoji: '🔥', name: '파이어봇',      color: '#ef4444', title: '코딩 전사' },
  cyber:   { emoji: '⚡', name: '사이버봇',      color: '#06b6d4', title: '디버거' },
  crystal: { emoji: '💎', name: '크리스탈봇',    color: '#f59e0b', title: '마스터' },
}

export default function CharacterDisplay({ characterId = 'default', level = 1, xp = 0, maxXp = 100, compact = false }) {
  const char = CHARACTER_MAP[characterId] || CHARACTER_MAP.default
  const xpPercent = Math.min(100, (xp / maxXp) * 100)

  if (compact) {
    return (
      <div className="char-compact">
        <span className="char-emoji-sm">{char.emoji}</span>
        <div>
          <div className="char-name-sm">{char.name}</div>
          <div className="char-level-sm">Lv.{level}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="char-display animate-fade-in-up">
      <div className="char-avatar-wrap animate-float">
        <div className="char-avatar" style={{ borderColor: char.color, boxShadow: `0 0 32px ${char.color}66` }}>
          <span className="char-emoji">{char.emoji}</span>
        </div>
        <div className="char-level-badge" style={{ background: char.color }}>
          Lv.{level}
        </div>
      </div>

      <div className="char-info">
        <div className="char-name">{char.name}</div>
        <div className="char-title" style={{ color: char.color }}>{char.title}</div>

        <div className="char-xp-section">
          <div className="char-xp-label">
            <span>EXP</span>
            <span>{xp} / {maxXp}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${xpPercent}%`, background: `linear-gradient(90deg, ${char.color}, #c4b5fd)` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
