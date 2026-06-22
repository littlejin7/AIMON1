import { useNavigate } from 'react-router-dom'
import { getEvolutionStage, calcLevel } from './homeUtils'

const TitleIcons = {
  first_step:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10"/><path d="M12 20V10"/><path d="M12 10a4 4 0 0 1 4-4h2"/><path d="M12 14a4 4 0 0 0-4-4H6"/></svg>,
  streak_7:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FB923C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
  boss_slayer:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="9.5 17.5 21 6 21 3 18 3 6.5 14.5"/><line x1="11" y1="19" x2="5" y2="13"/><line x1="8" y1="16" x2="4" y2="20"/><line x1="5" y1="21" x2="3" y2="19"/></svg>,
  ai_explorer:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M9 13h4"/><path d="M12 10v6"/><circle cx="12" cy="13" r="1" fill="#F472B6"/></svg>,
  unit_master:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></svg>,
  aimon_master: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l4 12 4-12-3-6"/><path d="M2 9h20"/></svg>,
  rookie_coder: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></svg>,
  ace_coder:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></svg>,
  ai_master:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l4 12 4-12-3-6"/><path d="M2 9h20"/></svg>,
}

const TITLE_NAMES = {
  first_step:   '첫 발걸음',
  streak_7:     '연속학습자',
  boss_slayer:  '보스슬레이어',
  ai_explorer:  'AI 탐구자',
  unit_master:  '유닛 마스터',
  aimon_master: '에이몬 마스터',
  rookie_coder: '코드 ROOKIE',
  ace_coder:    'ACE 코더',
  ai_master:    'AI 마스터',
}

export default function HomeDashboard({ user, stats, onOpenLevelTest }) {
  const navigate = useNavigate()

  const evoStage = getEvolutionStage(user?.character)
  const totalXp  = user?.xp || 0
  const { lv, xpInLevel, xpForNext } = calcLevel(totalXp)
  const xpPct    = xpForNext > 0 ? Math.round((xpInLevel / xpForNext) * 100) : 100
  const streak   = user?.streak || 0

  const titleKey  = user?.equipped_title
  const titleName = TITLE_NAMES[titleKey]
  const TitleIcon = TitleIcons[titleKey]

  return (
    <div className="home-page">

      {/* ── 히어로 영역 ── */}
      <div className="home-hero-area" style={{ '--evo-glow': evoStage.glow, '--evo-color': evoStage.color }}>

        <div className="home-halo home-halo-1" />
        <div className="home-halo home-halo-2" />

        {/* 캐릭터 */}
        <img
          src={evoStage.icon}
          alt={evoStage.name}
          className="home-hero-char animate-bob"
        />

        {/* 레벨 오버레이 (우상단) */}
        <div className="home-level-overlay">
          <div className="home-level-num">LV. {lv}</div>
          <div className="home-level-xp">{xpInLevel.toLocaleString()} / {xpForNext.toLocaleString()} XP</div>
          <div className="home-xp-bar-bg">
            <div className="home-xp-bar-fill" style={{ width: `${xpPct}%`, background: `linear-gradient(90deg, ${evoStage.color}, #7dd3fc)` }} />
          </div>
        </div>

        {/* 스트릭 배지 (좌상단) */}
        {streak > 0 && (
          <div className="home-streak-overlay">🔥 {streak}일 연속</div>
        )}

        {/* 칭호 오버레이 (하단 중앙) */}
        {titleName && (
          <div className="home-title-overlay">
            {TitleIcon}
            {titleName}
          </div>
        )}
      </div>

      {/* ── 스탯 카드 ── */}
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

      {/* ── 학습 시작 CTA ── */}
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

      {!user?.is_level_tested && (
        <div className="container" style={{ marginBottom: '12px' }}>
          <button
            id="btn-level-test-dashboard"
            onClick={onOpenLevelTest}
            style={{ width: '100%', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '10px', padding: '10px 16px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--clr-primary-lt)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            🔍 첫 레벨 진단받기
          </button>
        </div>
      )}

      {/* ── 보스 힌트 배너 ── */}
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
