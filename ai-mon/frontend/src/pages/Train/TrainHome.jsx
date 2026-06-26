import { TRAIN_MODES } from './trainConstants'
import UnitSelector from './UnitSelector'

const LEVELS = [
  { id: 'beginner',     label: '초급' },
  { id: 'intermediate', label: '중급' },
  { id: 'advanced',     label: '고급' },
]

export default function TrainHome({
  currentUnit,
  setCurrentUnit,
  trainingLevel,
  setTrainingLevel,
  maxUnit,
  userCourseLevel,
  hasCompletedStages,
  hasClearedMiniboss,
  wrongCount,
  wrongAnswers,
  unitAccuracy,
  loading,
  onStart,
  onStartRandom,
  onStartBossRush,
}) {
  return (
    <div className="tr-page">
      <div className="tr-scroll">

        {/* 레벨 칩 — Settings.jsx 동일 규칙: 초급은 항상 열림, 나머지는 현재 course_level만 */}
        <div className="tr-level-row">
          {LEVELS.map(lv => {
            const isCurrent = userCourseLevel === lv.id
            const isChipLocked = lv.id !== 'beginner' && !isCurrent
            return (
              <button
                key={lv.id}
                className={`tr-level-chip ${trainingLevel === lv.id ? 'active' : ''} ${isChipLocked ? 'locked' : ''}`}
                onClick={() => !isChipLocked && setTrainingLevel(lv.id)}
              >
                {lv.label}
              </button>
            )
          })}
        </div>

        {/* 오늘의 추천 훈련 */}
        <div className="tr-today-card" onClick={() => onStart({ onlyWrong: true })}>
          <div className="tr-today-text">
            <div className="tr-today-label">오늘의 추천 훈련</div>
            <div className="tr-today-title">오답 복습 · {wrongCount > 0 ? `${wrongCount}문제` : '준비 중'}</div>
            <div className="tr-today-meta">
              {currentUnit !== null ? `Unit ${currentUnit}` : '전체 유닛'} · 틀린 문제 모음
            </div>
          </div>
          <button className="tr-today-btn" disabled={loading}>
            {loading ? '...' : '시작'}
          </button>
        </div>

        {/* 훈련 모드 그리드 */}
        <div className="tr-section-title">훈련 모드</div>
        <div className="tr-grid">
          {TRAIN_MODES.map(m => {
            const isDisabled = m.locked
              || (m.id === 'boss'   && !hasClearedMiniboss)
              || (m.id === 'random' && !hasCompletedStages)
            const countLabel = m.id === 'boss'   && !hasClearedMiniboss  ? '미니보스 클리어 필요'
                             : m.id === 'random' && !hasCompletedStages  ? '스테이지 클리어 필요'
                             : m.locked ? m.lockHint
                             : m.id === 'wrong'  ? `${wrongCount}문제 대기 중`
                             : m.reward || ''
            return (
              <div
                key={m.id}
                className={`tr-mode-card ${isDisabled ? 'tr-mode-locked' : ''}`}
                onClick={() => {
                  if (isDisabled) return
                  if (m.id === 'random')    { onStartRandom();   return }
                  if (m.id === 'boss')      { onStartBossRush(); return }
                  onStart({ onlyWrong: m.id === 'wrong' })
                }}
              >
                <div className="tr-mode-icon" style={{ background: m.iconBg }}>
                  {m.icon}
                </div>
                <div className="tr-mode-name">{m.name}</div>
                <div className="tr-mode-desc">{m.desc}</div>
                <div className="tr-mode-count">{countLabel}</div>
              </div>
            )
          })}
        </div>

        {/* 유닛 선택 */}
        <div className="tr-section-title">유닛 선택</div>
        <UnitSelector
          value={currentUnit}
          onChange={(u) => { setCurrentUnit(u); onStart({ onlyWrong: true, unit: u }) }}
          maxUnit={maxUnit}
        />

        {/* 오답 노트 */}
        {wrongAnswers.length > 0 && (
          <>
            <div className="tr-section-title">오답 노트</div>
            <div className="tr-wrong-card">
              <div className="tr-wrong-header">
                <span className="tr-wrong-title">최근 틀린 문제</span>
                <span className="tr-wrong-more" onClick={() => onStart({ onlyWrong: true })}>전체 보기 →</span>
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

      </div>
    </div>
  )
}
