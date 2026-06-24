import { useNavigate } from 'react-router-dom'
import { getEvolutionStage, calcLevel } from './homeUtils'
import slimeIcon from '../../assets/character_slime.png'
import robotIcon from '../../assets/character_robot.png'
import speechBubbleIcon from '../../assets/character_bubble.png'
import finalGhostIcon from '../../assets/character_final_ghost.png'

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



function getWeekDots(streak) {
  // 오늘 요일 (0=일,1=월,...6=토) → 목업 기준 월~일 배열
  const todayJs = new Date().getDay()
  const todayIdx = todayJs === 0 ? 6 : todayJs - 1 // 0=월 ~ 6=일
  return DAY_LABELS.map((label, i) => {
    if (i < todayIdx) return { label, state: i < streak ? 'done' : 'empty' }
    if (i === todayIdx) return { label, state: 'today' }
    return { label, state: 'empty' }
  })
}

// 데일리/위클리 미션은 추후 API 연동 예정 — 현재는 stats 기반 하드코드
function buildDailyMissions(user, stats) {
  const hasAttended = (user?.streak || 0) > 0
  const quizDone = (stats?.completed_stages || 0) >= 10
  return [
    { id: 'attend', icon: '📅', name: '오늘 출석 체크',      reward: '+500 XP · 힌트코인 1개',  done: hasAttended },
    { id: 'quiz10', icon: '🧠', name: '퀴즈 10문제 풀기',    reward: '+2,000 XP',               done: quizDone },
    { id: 'stage1', icon: '🛡️', name: '스테이지 1개 완료',  reward: '+2,500 XP · 힌트코인 2개', done: false },
  ]
}

function buildWeeklyMissions(user, stats) {
  const streak = user?.streak || 0
  const xp = user?.xp || 0
  return [
    { id: 'w1', name: '5일 연속 출석',           xp: '+5,000 XP',  done: streak >= 5 },
    { id: 'w2', name: '누적 XP 10,000 달성',      xp: '+3,000 XP',  done: xp >= 10000 },
    { id: 'w3', name: '유닛 보스 1마리 클리어',   xp: '+10,000 XP', done: false },
    { id: 'w4', name: '힌트 없이 미니보스 클리어', xp: '+3,000 XP', done: false },
    { id: 'w5', name: '퀴즈 총 50문제 풀기',      xp: '+2,000 XP',  done: false },
  ]
}

export default function HomeDashboard({ user, stats, onOpenLevelTest }) {
  const navigate = useNavigate()

  const totalXp = user?.xp || 0
  const { lv, xpInLevel, xpForNext } = calcLevel(totalXp)
  const xpPct = xpForNext > 0 ? Math.round((xpInLevel / xpForNext) * 100) : 100
  const streak = user?.streak || 0
  const weekDots = getWeekDots(streak)
  const charImg = CHARACTER_ICONS[user?.character]
  const dailyMissions = buildDailyMissions(user, stats)
  const weeklyMissions = buildWeeklyMissions(user, stats)
  const weeklyDone = weeklyMissions.filter(m => m.done).length

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
            <div className="hd-streak-label">내일도 접속하면 +1,000 XP</div>
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
        <div className="hd-hero-badge">
          {stats?.current_unit ? `Unit ${stats.current_unit} · Stage ${stats.current_stage || 1}` : 'Unit 1 · Stage 1'}
        </div>
        <div className="hd-lv-badge">Lv. {lv}</div>
        
        {(() => {
          const equippedTitle = user?.equipped_title
            || (user?.id ? localStorage.getItem(`equipped_title_${user.id}`) : null)
          const courseLevel = user?.course_level || 'beginner'
          return (
            <div className="hd-char-meta">
              {equippedTitle && TITLE_NAMES[equippedTitle] && (
                <span className="hd-char-title-badge">🎖 {TITLE_NAMES[equippedTitle]}</span>
              )}
              <span className="hd-char-level-badge">{LEVEL_LABELS[courseLevel]}</span>
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
          <div className="hd-xp-wrap">
            <div className="hd-xp-row">
              <span>XP {xpInLevel.toLocaleString()}</span>
              <span>다음 레벨까지 {(xpForNext - xpInLevel).toLocaleString()} XP</span>
            </div>
            <div className="hd-xp-bar">
              <div className="hd-xp-fill" style={{ width: `${xpPct}%` }} />
            </div>
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

      {/* ── 데일리 미션 ── */}
      <div className="hd-section-header">
        <span className="hd-section-title">데일리 미션</span>
        <span className="hd-section-more">전체 보기 →</span>
      </div>
      <div className="hd-card hd-mission-card">
        {dailyMissions.map((m) => (
          <div key={m.id} className="hd-mission-row">
            <div className={`hd-mission-icon ${m.done ? 'done' : 'todo'}`}>
              <span>{m.icon}</span>
            </div>
            <div className="hd-mission-text">
              <div className="hd-mission-name">{m.name}</div>
              <div className="hd-mission-reward">{m.reward}</div>
            </div>
            <div className={`hd-mission-check ${m.done ? 'done' : 'todo'}`}>
              {m.done && <span>✓</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── 위클리 미션 ── */}
      <div className="hd-section-header">
        <span className="hd-section-title">위클리 미션</span>
        <span className="hd-section-more">전체 보기 →</span>
      </div>
      <div className="hd-card hd-weekly-card">
        <div className="hd-weekly-header">
          <span className="hd-weekly-label">이번 주 진행</span>
          <span className="hd-weekly-val">{weeklyDone} / {weeklyMissions.length} 완료</span>
        </div>
        <div className="hd-weekly-bar">
          <div className="hd-weekly-fill" style={{ width: `${(weeklyDone / weeklyMissions.length) * 100}%` }} />
        </div>
        {weeklyMissions.map((m) => (
          <div key={m.id} className="hd-weekly-row">
            <div className={`hd-weekly-dot ${m.done ? 'done' : 'todo'}`} />
            <span className={`hd-weekly-name ${m.done ? 'done' : 'todo'}`}>{m.name}</span>
            <span className="hd-weekly-xp">{m.xp}</span>
          </div>
        ))}
      </div>

    </div>
  )
}
