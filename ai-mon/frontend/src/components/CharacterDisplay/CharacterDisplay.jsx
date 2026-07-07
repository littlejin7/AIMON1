import './CharacterDisplay.css'

const CHARACTER_MAP = {
  slime:         { icon: '/src/assets/character_slime.png', name: '에이원', color: '#7c3aed', title: '초보자' },
  robot:         { icon: '/src/assets/character_robot.png', name: '에이량', color: '#06b6d4', title: '탐험가' },
  speech_bubble: { icon: '/src/assets/character_bubble.png', name: '에이훈', color: '#10b981', title: '마스터' },
  final_ghost:   { icon: '/src/assets/character_final_ghost.png', name: '에이왕', color: '#f59e0b', title: '전설' },
}
export default function CharacterDisplay({ characterId = 'slime', level = 1, gp = 0, maxGp = 100, compact = false }) {
  const char = CHARACTER_MAP[characterId] || CHARACTER_MAP.slime
  const gpPercent = Math.min(100, (gp / maxGp) * 100)

  if (compact) {
    return (
      <div className="char-compact">
        <img src={char.icon} alt={char.name} className="char-emoji-sm" />
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
          <img src={char.icon} alt={char.name} className="char-avatar-img" />
        </div>
        <div className="char-level-badge" style={{ background: char.color }}>
          Lv.{level}
        </div>
      </div>

      <div className="char-info">
        <div className="char-name">{char.name}</div>
        <div className="char-title" style={{ color: char.color }}>{char.title}</div>

        <div className="char-gp-section">
          <div className="char-gp-label">
            <span>GP</span>
            <span>{gp} / {maxGp}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${gpPercent}%`, background: `linear-gradient(90deg, ${char.color}, #c4b5fd)` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
