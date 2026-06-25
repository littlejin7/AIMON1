import { TRAIN_MODES } from './trainConstants'

export default function TrainHome({
  currentUnit,
  setCurrentUnit,
  wrongCount,
  wrongAnswers,
  unitAccuracy,
  loading,
  onStart,
}) {
  return (
    <div className="tr-page">
      <div className="tr-scroll">

        {/* 오늘의 추천 훈련 */}
        <div className="tr-today-card" onClick={() => onStart(currentUnit)}>
          <div className="tr-today-text">
            <div className="tr-today-label">오늘의 추천 훈련</div>
            <div className="tr-today-title">오답 복습 · {wrongCount > 0 ? `${wrongCount}문제` : '준비 중'}</div>
            <div className="tr-today-meta">
              Unit {currentUnit} · 틀린 문제 모음
            </div>
          </div>
          <button className="tr-today-btn" disabled={loading}>
            {loading ? '...' : '시작'}
          </button>
        </div>

        {/* 훈련 모드 그리드 */}
        <div className="tr-section-title">훈련 모드</div>
        <div className="tr-grid">
          {TRAIN_MODES.map(m => (
            <div
              key={m.id}
              className={`tr-mode-card ${m.locked ? 'tr-mode-locked' : ''}`}
              onClick={() => !m.locked && onStart(currentUnit)}
            >
              <div className="tr-mode-icon" style={{ background: m.iconBg }}>
                {m.icon}
              </div>
              <div className="tr-mode-name">{m.name}</div>
              <div className="tr-mode-desc">{m.desc}</div>
              <div className="tr-mode-count">
                {m.locked ? m.lockHint : m.id === 'wrong' ? `${wrongCount}문제 대기 중` : m.reward || ''}
              </div>
            </div>
          ))}
        </div>

        {/* 오답 노트 */}
        {wrongAnswers.length > 0 && (
          <>
            <div className="tr-section-title">오답 노트</div>
            <div className="tr-wrong-card">
              <div className="tr-wrong-header">
                <span className="tr-wrong-title">최근 틀린 문제</span>
                <span className="tr-wrong-more" onClick={() => onStart(currentUnit)}>전체 보기 →</span>
              </div>
              {wrongAnswers.map((q, i) => (
                <div key={i} className="tr-wrong-row">
                  <span className="tr-wrong-tag">오답</span>
                  <span className="tr-wrong-q">{q.question || q.content || '문제 로딩 중'}</span>
                  <span className="tr-wrong-unit">U{q.unit || '?'}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 유닛별 정답률 */}
        {unitAccuracy.length > 0 && (
          <>
            <div className="tr-section-title">유닛별 정답률</div>
            <div className="tr-accuracy-card">
              {unitAccuracy.map((u, i) => (
                <div key={u.unit_id} className={`tr-accuracy-row ${i > 0 ? 'tr-bordered' : ''}`}>
                  <span className="tr-accuracy-label">Unit {u.unit_id} · {u.title}</span>
                  <div className="tr-accuracy-bar">
                    <div className="tr-accuracy-fill" style={{ width: `${u.pct}%` }} />
                  </div>
                  <span className="tr-accuracy-pct">{u.pct}%</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 유닛 선택 */}
        <div className="tr-section-title">유닛 선택</div>
        <div className="tr-unit-grid">
          {[1,2,3,4,5,6,7,8].map(u => (
            <button
              key={u}
              className={`tr-unit-btn ${currentUnit === u ? 'active' : ''}`}
              onClick={() => setCurrentUnit(u)}
            >
              Unit {u}
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}
