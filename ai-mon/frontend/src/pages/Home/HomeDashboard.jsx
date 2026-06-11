import { useNavigate } from 'react-router-dom'
import { getEvolutionStage, calcLevel } from './homeUtils'
import slimeIcon      from '../../assets/character_slime.png'
import robotIcon      from '../../assets/character_robot.png'
import finalGhostIcon from '../../assets/character_final_ghost.png'

const LEVEL_COLOR_MAP = {
  beginner:     { bg: 'rgba(124, 58, 237, 0.15)', border: '1px solid rgba(124, 58, 237, 0.4)', text: '#a78bfa', label: '비기너',        icon: slimeIcon },
  intermediate: { bg: 'rgba(6, 182, 212, 0.15)',  border: '1px solid rgba(6, 182, 212, 0.4)',  text: '#22d3ee', label: '인터미디에이트', icon: robotIcon },
  advanced:     { bg: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', text: '#fcd34d', label: '어드밴스드',     icon: finalGhostIcon },
}

const TITLES = {
  first_step:   '🌱 첫 발걸음',
  streak_7:     '🔥 연속학습자',
  boss_slayer:  '⚔️ 보스슬레이어',
  ai_explorer:  '🧠 AI 탐구자',
  unit_master:  '👑 유닛 마스터',
  aimon_master: '💎 에이몬 마스터',
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
  const equippedTitle = TITLES[localStorage.getItem('equipped_title')]

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
              <span style={{ fontSize: '0.75rem', fontWeight: 700, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: '999px', padding: '2px 10px', color: '#a78bfa', width: 'fit-content' }}>
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
        {user?.character !== 'final_ghost' && (
          <div className="home-next-evo">
            <span className="home-next-evo-label">다음 진화까지</span>
            <span className="home-next-evo-val">
              {(!user?.character || user?.character === 'slime') && 'Lv.10 달성 → 🤖 로봇 진화'}
              {user?.character === 'robot'        && 'Lv.20 달성 → 💬 말풍선 진화'}
              {user?.character === 'speech_bubble' && 'Lv.30 달성 → 👻 파이널 진화'}
            </span>
          </div>
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
