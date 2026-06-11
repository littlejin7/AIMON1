export default function UnitCard({ lesson, meta, prog, pct, done, unlocked, isUnit1, token, onClick }) {
  return (
    <button
      id={`unit-${lesson.unit_id}`}
      className={[
        'lh-unit-card',
        'animate-fade-in-up',
        !unlocked ? 'lh-locked' : '',
        done      ? 'lh-done'   : '',
      ].join(' ')}
      style={done ? { borderColor: meta.color + '50' } : {}}
      onClick={onClick}
      disabled={!unlocked}
      aria-label={`유닛 ${lesson.unit_id} — ${lesson.title}`}
    >
      {/* 번호 원형 배지 */}
      <div
        className="lh-unit-badge"
        style={{
          background:   unlocked ? meta.color + '30' : undefined,
          borderColor:  unlocked ? meta.color        : undefined,
        }}
      >
        {unlocked
          ? <span style={{ color: meta.color, fontWeight: 800 }}>{lesson.unit_id}</span>
          : <span>🔒</span>
        }
      </div>

      {/* 콘텐츠 */}
      <div className="lh-unit-body">
        <div className="lh-unit-row">
          <span className="lh-unit-icon">{unlocked ? meta.icon : '🔒'}</span>
          <div className="lh-unit-text">
            <span className="lh-unit-title">{lesson.title}</span>
            <div className="lh-unit-keywords">
              {meta.keywords.map((k) => (
                <span key={k} className="lh-keyword">{k}</span>
              ))}
            </div>
          </div>
        </div>

        {unlocked && (
          <div className="lh-unit-progress">
            <div className="progress-bar" style={{ flex: 1 }}>
              <div
                className="progress-bar-fill"
                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${meta.color}, #c4b5fd)` }}
              />
            </div>
            <span className="lh-unit-pct">
              {done ? '✅ 완료' : `${prog.completed}/${lesson.stages}`}
            </span>
          </div>
        )}

        {!unlocked && (
          <p className="lh-unit-lock-hint">이전 유닛을 완료하면 해금됩니다</p>
        )}

        {/* 비로그인 Unit1 무료 체험 배지 */}
        {!token && isUnit1 && (
          <span className="lh-free-badge">🚀 무료 체험 가능</span>
        )}
      </div>

      {/* 보스 완료 배지 */}
      {done && <div className="lh-boss-done"><span>👑</span></div>}

      {unlocked && !done && <span className="lh-arrow">›</span>}
    </button>
  )
}
