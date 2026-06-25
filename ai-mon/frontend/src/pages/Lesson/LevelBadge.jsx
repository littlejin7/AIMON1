const COURSE_LEVELS = [
  { id: 'beginner',     label: 'beginner',     badge: '🌱', desc: '개념 이해 위주, 선택형',          color: '#10b981' },
  { id: 'intermediate', label: 'intermediate', badge: '⚡', desc: '코드 읽기 + 단순 작성 혼합',      color: '#f59e0b' },
  { id: 'advanced',     label: 'advanced',     badge: '🔥', desc: '코드 작성 + 응용 위주',           color: '#ef4444' },
]

export default function LevelBadge({ courseLevel }) {
  const lv = COURSE_LEVELS.find((l) => l.id === courseLevel) || COURSE_LEVELS[0]

  return (
    <div className="lh-level-section">
      <p className="lh-level-label">현재 나의 학습 레벨</p>
      <div className="lh-level-tabs">
        <div
          className="lh-level-tab active"
          style={{ borderColor: lv.color, color: lv.color, cursor: 'default' }}
        >
          <span className="lh-level-badge">{lv.badge}</span>
          <span className="lh-level-name">{lv.label}</span>
        </div>
      </div>
      <p className="lh-level-desc">{lv.desc}</p>
    </div>
  )
}
