import { useNavigate } from 'react-router-dom'
import { getEvolutionStage, calcLevel } from './homeUtils'
import slimeIcon      from '../../assets/character_slime.png'
import robotIcon      from '../../assets/character_robot.png'
import bubbleIcon     from '../../assets/character_bubble.png'
import finalGhostIcon from '../../assets/character_final_ghost.png'

const EVO_CHAIN = [
  { key: 'slime',         icon: slimeIcon,      label: '슬라임' },
  { key: 'robot',         icon: robotIcon,      label: '로봇' },
  { key: 'speech_bubble', icon: bubbleIcon,     label: '말풍선' },
  { key: 'final_ghost',   icon: finalGhostIcon, label: '에이몬' },
]

const LEVEL_COLOR_MAP = {
  beginner:     { bg: 'rgba(124, 58, 237, 0.15)', border: '1px solid rgba(124, 58, 237, 0.4)', text: '#a78bfa', label: 'beginner',        icon: slimeIcon },
  intermediate: { bg: 'rgba(6, 182, 212, 0.15)',  border: '1px solid rgba(6, 182, 212, 0.4)',  text: '#22d3ee', label: 'intermediate', icon: robotIcon },
  advanced:     { bg: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', text: '#fcd34d', label: 'advanced',     icon: finalGhostIcon },
}

const TitleIcons = {
  first_step:   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10"/><path d="M12 20V10"/><path d="M12 10a4 4 0 0 1 4-4h2"/><path d="M12 14a4 4 0 0 0-4-4H6"/></svg>,
  streak_7:     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FB923C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
  boss_slayer:  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="9.5 17.5 21 6 21 3 18 3 6.5 14.5"/><line x1="11" y1="19" x2="5" y2="13"/><line x1="8" y1="16" x2="4" y2="20"/><line x1="5" y1="21" x2="3" y2="19"/></svg>,
  ai_explorer:  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M9 13h4"/><path d="M12 10v6"/><circle cx="12" cy="13" r="1" fill="#F472B6"/></svg>,
  unit_master:  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></svg>,
  aimon_master: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l4 12 4-12-3-6"/><path d="M2 9h20"/></svg>,
}
// TITLES - 이모지 제거하고 텍스트만
const TITLES = {
  first_step:   '첫 발걸음',
  streak_7:     '연속학습자',
  boss_slayer:  '보스슬레이어',
  ai_explorer:  'AI 탐구자',
  unit_master:  '유닛 마스터',
  aimon_master: '에이몬 마스터',
}

export default function HomeDashboard({ user, stats, onOpenLevelTest }) {
  const navigate = useNavigate()

  const evoStage = getEvolutionStage(user?.character)
  const totalXp  = user?.xp || 0
  const { lv, xpInLevel, xpForNext } = calcLevel(totalXp)
  const xpPct  = xpForNext > 0 ? Math.round((xpInLevel / xpForNext) * 100) : 100
  const streak = user?.streak || 0

  const courseLevel   = user?.course_level || 'beginner'
  const levelBadge    = LEVEL_COLOR_MAP[courseLevel] || LEVEL_COLOR_MAP.beginner
  const equippedTitle = TITLES[user?.equipped_title]

  return (
    <div className="home-page">
      {/* 대시보드 헤더 */}
      <div className="home-dashboard-header">
        <div className="home-dash-greeting" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <p className="home-dash-sub">안녕하세요,</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 className="home-dash-name" style={{ margin: 0 }}>{user?.nickname || user?.username} 님! 👋</h1>
              {user?.is_level_tested && (
                <span
                  id="user-course-level-badge"
                  style={{ background: levelBadge.bg, border: levelBadge.border, color: levelBadge.text, borderRadius: '999px', padding: '4px 12px', fontSize: '0.78rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                >
                  <img src={levelBadge.icon} alt={levelBadge.label} className="home-level-badge-icon" />
                  <span>내 레벨: {levelBadge.label}</span>
                </span>
              )}
            </div>
          </div>
          {!user?.is_level_tested && (
            <button
              id="btn-level-test-dashboard"
              onClick={onOpenLevelTest}
              style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--clr-primary-lt)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}
            >
              🔍 첫 레벨 진단받기
            </button>
          )}
        </div>

        {/* 에이몬 캐릭터 카드 */}
        <div
          className="home-char-card card-glass animate-fade-in-up"
          style={{ borderColor: evoStage.color + '60' }}
        >
          <div className="home-char-orb animate-float" style={{ boxShadow: `0 0 40px ${evoStage.glow}` }}>
            <img src={evoStage.icon} alt={evoStage.name} className="home-char-orb-img" />
          </div>
          <div className="home-char-meta">
            <span className="home-char-name" style={{ color: evoStage.color }}>{evoStage.name}</span>
            {equippedTitle && (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: '999px', padding: '2px 10px', color: '#a78bfa', width: 'fit-content', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {TitleIcons[user?.equipped_title]}
                {equippedTitle}
              </span>
            )}
            <span className="home-char-range">{evoStage.unitRange}</span>
            <div className="home-char-xp">
              <div className="home-char-xp-label">
                <span>Lv.{lv}</span>
                <span>{xpInLevel.toLocaleString()} / {xpForNext.toLocaleString()} XP</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${xpPct}%`, background: `linear-gradient(90deg, ${evoStage.color}, #c4b5fd)` }} />
              </div>
            </div>
          </div>
          {streak > 0 && (
            <div className="home-streak-badge">🔥 {streak}일 연속</div>
          )}
        </div>

        {/* 다음 진화 안내 */}
        <div className="home-next-evo">
          <span className="home-next-evo-label">진화 단계</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {EVO_CHAIN.map((stage, i) => {
              const currentKey = user?.character || 'slime'
              const highlight = stage.key === currentKey
              return (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', opacity: highlight ? 1 : 0.45 }}>
                    <img
                      src={stage.icon}
                      alt={stage.label}
                      style={{ width: highlight ? '36px' : '28px', height: highlight ? '36px' : '28px', objectFit: 'contain', filter: highlight ? `drop-shadow(0 0 6px ${evoStage.color})` : 'none', transition: 'all 0.3s' }}
                    />
                    <span style={{ fontSize: '0.6rem', color: highlight ? evoStage.color : '#888', fontWeight: highlight ? 700 : 400 }}>{stage.label}</span>
                  </span>
                  {i < EVO_CHAIN.length - 1 && (
                    <span style={{ color: '#555', fontSize: '0.75rem' }}>›</span>
                  )}
                </span>
              )
            })}
          </div>
          {user?.character !== 'final_ghost' && (
            <span className="home-next-evo-val" style={{ marginTop: '4px' }}>
              {(!user?.character || user?.character === 'slime') && 'Lv.10 달성 시 로봇 진화'}
              {user?.character === 'robot'          && 'Lv.20 달성 시 말풍선 진화'}
              {user?.character === 'speech_bubble'  && 'Lv.30 달성 시 파이널 진화'}
            </span>
          )}
        </div>

      {/* 스탯 카드 */}
      {stats && (
        <div className="home-stats stagger container">
          <div className="stat-card animate-fade-in-up">
            <span className="stat-icon">🏆</span>
            <div className="stat-value">{stats.completed_stages}</div>
            <div className="stat-label">완료 스테이지</div>
          </div>
          <div className="stat-card animate-fade-in-up">
            <span className="stat-icon">⭐</span>
            <div className="stat-value">{totalXp.toLocaleString()}</div>
            <div className="stat-label">누적 XP</div>
          </div>
          <div className="stat-card animate-fade-in-up">
            <span className="stat-icon">🔥</span>
            <div className="stat-value">{streak}</div>
            <div className="stat-label">연속 학습</div>
          </div>
        </div>
      )}

      {/* 학습 시작 CTA */}
      <div className="home-cta container">
        <button
          id="btn-start-lesson"
          className="btn btn-primary btn-full btn-lg animate-pulse-glow"
          onClick={() => {
            if (!user?.is_level_tested) onOpenLevelTest()
            else navigate('/lesson')
          }}
        >
          📚 오늘 학습 시작하기
        </button>
      </div>

      {/* 보스 힌트 배너 */}
      <div className="home-boss-hint container">
        <div className="card-glass home-boss-card">
          <span className="home-boss-icon" style={{ fontWeight: 900, fontSize: '1.2rem', letterSpacing: '0.15em', background: 'var(--grad-boss)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            BOSS
          </span>
          <div>
            <p className="home-boss-title">보스 전투</p>
            <p className="home-boss-desc">유닛을 완료하면 보스가 해금됩니다. 클리어 시 인증카드 자동 생성!</p>
          </div>
        </div>
      </div>
    </div>
  )
}
