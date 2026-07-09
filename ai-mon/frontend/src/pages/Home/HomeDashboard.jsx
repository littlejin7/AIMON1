import { useNavigate } from 'react-router-dom'
import { getEvolutionStage } from './homeUtils'
import { TITLES, TITLE_ICON_BG } from '../Character/characterData'
import slimeIcon from '../../assets/character_slime.png'
import robotIcon from '../../assets/character_robot.png'
import speechBubbleIcon from '../../assets/character_bubble.png'
import finalGhostIcon from '../../assets/character_final_ghost.png'
import MissionWidget from '../../components/MissionWidget/MissionWidget'

const CHARACTER_ICONS = {
  slime: slimeIcon,
  robot: robotIcon,
  speech_bubble: speechBubbleIcon,
  final_ghost: finalGhostIcon,
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']


const TITLE_NAMES = {
  first_step:   '🌱 첫 발걸음',
  streak_7:     '🔥 연속학습자',
  boss_slayer:  '⚔️ 보스슬레이어',
  ai_explorer:  '🧠 AI 탐구자',
  unit_master:  '👑 유닛 마스터',
  aimon_master: '💎 에이몬 마스터',
  rookie_coder: '코드 ROOKIE',
  ace_coder:    'ACE 코더',
  ai_master:    'AI 마스터',
}

const LEVEL_LABELS = {
  beginner:     '🟢 초급',
  intermediate: '🔵 중급',
  advanced:     '🟣 고급',
}



function getWeekDots(streak, lastLogin) {
  // 모든 날짜 계산을 KST(UTC+9) 기준으로 수행한다.
  const kstNow   = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const todayStr = kstNow.toISOString().slice(0, 10) // "YYYY-MM-DD"
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const todayDays  = Math.floor(Date.UTC(ty, tm - 1, td) / 86400000) // epoch days

  // 0=Mon … 6=Sun
  const jsDow    = kstNow.getUTCDay() // 0=Sun…6=Sat
  const todayIdx = jsDow === 0 ? 6 : jsDow - 1
  const mondayDays = todayDays - todayIdx

  // lastLogin → epoch days (서버가 "YYYY-MM-DD" KST 문자열로 저장)
  let lastLoginDays = null
  if (lastLogin && streak > 0) {
    const [ly, lm, ld] = lastLogin.split('-').map(Number)
    lastLoginDays = Math.floor(Date.UTC(ly, lm - 1, ld) / 86400000)
  }

  return DAY_LABELS.map((label, i) => {
    const dayDays = mondayDays + i
    if (dayDays > todayDays) return { label, state: 'empty' } // 미래

    const isToday = dayDays === todayDays
    if (isToday) {
      // 오늘 접속했으면(last_login == today) done, 아직 미접속이면 today 링
      return { label, state: lastLogin === todayStr ? 'done' : 'today' }
    }

    // 과거: streak 윈도우(lastLogin 기준 연속 streak일)에 속하면 done
    if (lastLoginDays === null) return { label, state: 'empty' }
    const diff = lastLoginDays - dayDays // 양수 = 이 날이 lastLogin보다 앞
    return { label, state: diff >= 0 && diff < streak ? 'done' : 'empty' }
  })
}

export default function HomeDashboard({ user, stats, onOpenLevelTest }) {
  const navigate = useNavigate()

  const lv = user?.lv || 1
  const coinBalance = user?.coin_balance || 0
  const evolutionStage = user?.evolution_stage || 0
  const gp = user?.gp || 0
  const streak = user?.streak || 0
  const weekDots = getWeekDots(streak, user?.last_login || '')
  const charImg = CHARACTER_ICONS[user?.character]
  const courseLevel = user?.course_level || 'beginner'

  const handleLearn = () => {
    if (!user?.is_level_tested) onOpenLevelTest()
    else navigate('/lesson')
  }

  return (
    <div className="hd-page">

      {/* ── 스트릭 카드 ── */}
      <div className="hd-card hd-streak-card">
        <div className="hd-streak-top">
          <span className="hd-streak-flame">🔥</span>
          <div>
            <div className="hd-streak-count">연속 학습 {streak}일</div>
            <div className="hd-streak-label">내일도 접속하면 코인을 받아요</div>
          </div>
        </div>
        <div className="hd-week-dots">
          {weekDots.map(({ label, state }, i) => (
            <div key={i} className="hd-day-dot">
              <div className={`hd-day-circle hd-day-${state}`}>
                {state === 'done' ? '✓' : label}
              </div>
              <span className="hd-day-label">{state === 'today' ? '오늘' : label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 히어로 카드 ── */}
      <div className="hd-card hd-hero-card">
        <div className="hd-hero-top-meta">
          <span className="hd-status-badge hd-stage-badge">
            {stats?.current_unit ? `Unit ${stats.current_unit} · Stage ${stats.current_stage || 1}` : 'Unit 1 · Stage 1'}
          </span>
          <span className="hd-currency-badge hd-coin-badge">🪙 코인 {coinBalance.toLocaleString()}</span>
        </div>
        {(() => {
          const equippedTitle = user?.equipped_title
            || (user?.id ? localStorage.getItem(`equipped_title_${user.id}`) : null)
          const equippedTitleMeta = TITLES.find((title) => title.id === equippedTitle)
          const TitleIcon = equippedTitleMeta?.Icon
          const titleTheme = TITLE_ICON_BG[equippedTitle] || TITLE_ICON_BG.first_step
          return (
            <div className="hd-char-meta">
              <div className="hd-char-name-row">
                {user?.nickname && (
                  <span className="hd-char-nickname">{user.nickname}</span>
                )}
                <span className="hd-status-badge hd-lv-inline-badge">Lv. {lv}</span>
              </div>
              {equippedTitleMeta && (
                <span className="hd-char-title-badge">
                  {TitleIcon && (
                    <span className="hd-char-title-icon" style={{ background: titleTheme.bg }}>
                      <TitleIcon />
                    </span>
                  )}
                  <span>{equippedTitleMeta.name}</span>
                </span>
              )}
            </div>
          )
        })()}
        <div className="hd-char-area">
          {charImg
            ? <img src={charImg} alt="내 에이몬" className="hd-char-img" />
            : (
              <svg className="hd-char-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="50" cy="80" rx="28" ry="8" fill="var(--clr-primary-dim, #EEEDFE)"/>
                <ellipse cx="50" cy="58" rx="30" ry="32" fill="var(--clr-primary, #7F77DD)"/>
                <ellipse cx="50" cy="52" rx="26" ry="24" fill="var(--clr-primary-dk, #534AB7)"/>
                <circle cx="38" cy="48" r="8" fill="white"/>
                <circle cx="62" cy="48" r="8" fill="white"/>
                <circle cx="39" cy="49" r="4" fill="#26215C"/>
                <circle cx="63" cy="49" r="4" fill="#26215C"/>
                <circle cx="40" cy="47" r="1.5" fill="white"/>
                <circle cx="64" cy="47" r="1.5" fill="white"/>
                <path d="M42 62 Q50 68 58 62" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
                <ellipse cx="26" cy="60" rx="8" ry="12" fill="var(--clr-primary, #7F77DD)" transform="rotate(-15 26 60)"/>
                <ellipse cx="74" cy="60" rx="8" ry="12" fill="var(--clr-primary, #7F77DD)" transform="rotate(15 74 60)"/>
                <ellipse cx="38" cy="80" rx="7" ry="5" fill="var(--clr-primary-dk, #534AB7)"/>
                <ellipse cx="62" cy="80" rx="7" ry="5" fill="var(--clr-primary-dk, #534AB7)"/>
              </svg>
            )
          }
          <span className="hd-char-level-badge">{LEVEL_LABELS[courseLevel]}</span>
          <div className="hd-currency-wrap">
            {evolutionStage >= 3 && (
              <div className="hd-currency-row">
                <span className="hd-currency-badge hd-gp-badge">💠 GP {gp.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="hd-hero-info">
          {stats?.current_lesson_name && (
            <div className="hd-hero-stage">
              현재 스테이지 <strong>{stats.current_lesson_name}</strong>
            </div>
          )}
          <div className="hd-next-boss">
            <span>⚔️</span>
            <span>스테이지를 더 클리어하면 <strong>유닛 보스 등장!</strong></span>
          </div>
        </div>

        <button className="hd-cta-btn" onClick={handleLearn}>
          ⚡ 지금 학습하기
        </button>
      </div>

      {/* ── 미션 위젯 (데일리 + 위클리 — GET /missions API 연동) ── */}
      <MissionWidget />

    </div>
  )
}
