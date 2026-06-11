import { useNavigate } from 'react-router-dom'

export default function StageBriefing({
  briefings,
  briefingIndex,
  setBriefingIndex,
  setShowBriefing,
  lessonId,
  stageNum,
}) {
  const navigate = useNavigate()
  const slide = briefings[briefingIndex]
  const isLast = briefingIndex === briefings.length - 1

  return (
    <div className="stage-page">
      <div className="stage-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/lesson/${lessonId}`)}>✕</button>
        <div className="stage-progress-section">
          <div className="stage-progress-label">
            <span>UNIT {lessonId} · Stage {stageNum} · 슬라이드 {slide.order}</span>
            <span>슬라이드 {briefingIndex + 1} / {briefings.length}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${((briefingIndex + 1) / briefings.length) * 100}%` }}
            />
          </div>
        </div>
        <div style={{ width: 32 }} />
      </div>

      <div className="stage-content container">
        <div
          className="briefing-card card-glass animate-fade-in-up"
          key={slide.order}
          style={{ padding: '2rem', textAlign: 'left' }}
        >
          {/* 개념 설명 텍스트 */}
          <p style={{
            color: 'var(--clr-text)', lineHeight: 1.85, marginBottom: '1.5rem',
            whiteSpace: 'pre-line', fontSize: '1rem'
          }}>
            {slide.text}
          </p>

          {/* 터미널 블록 */}
          {slide.terminal && (
            <div style={{ marginBottom: '1.5rem', borderRadius: '10px', overflow: 'hidden', border: '1px solid #313244' }}>
              <div style={{
                background: '#181825', padding: '8px 14px',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
                <span style={{ color: '#585b70', fontSize: '0.72rem', marginLeft: 8 }}>Python</span>
              </div>
              <div style={{
                background: '#1e1e2e', padding: '1rem 1.2rem',
                fontFamily: 'monospace', fontSize: '0.9rem', color: '#cdd6f4',
                whiteSpace: 'pre', overflowX: 'auto'
              }}>
                {slide.terminal.code.map((line, i) => (
                  <div key={i} style={{ color: line.startsWith('#') ? '#6c7086' : '#cdd6f4' }}>
                    <span style={{ color: '#585b70', userSelect: 'none', marginRight: 12 }}>&gt;&gt;&gt;</span>
                    {line}
                  </div>
                ))}
              </div>
              {slide.terminal.output?.length > 0 && (
                <div style={{
                  background: '#181825', padding: '0.75rem 1.2rem',
                  borderTop: '1px solid #313244',
                  fontFamily: 'monospace', fontSize: '0.9rem'
                }}>
                  {slide.terminal.output.map((line, i) => (
                    <div key={i} style={{ color: '#a6e3a1' }}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 팁 블록 */}
          {slide.tip && (
            <div style={{
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: '10px', padding: '1rem 1.2rem', marginBottom: '2rem'
            }}>
              <strong style={{ color: '#34d399', display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>💡 에이몬의 팁</strong>
              <p style={{ margin: 0, color: 'var(--clr-text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                {slide.tip}
              </p>
            </div>
          )}

          <button
            className="btn btn-primary btn-lg btn-full"
            onClick={() => {
              if (isLast) setShowBriefing(false)
              else setBriefingIndex(b => b + 1)
            }}
          >
            {isLast ? '🚀 퀴즈 시작하기' : '다음 슬라이드 ➔'}
          </button>
        </div>
      </div>
    </div>
  )
}
