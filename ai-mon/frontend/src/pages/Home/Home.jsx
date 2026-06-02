import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { progressApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import './Home.css'

// 기획안 기준 에이몬 진화 단계
const EVOLUTION_STAGES = [
  {
    id: 'slime',
    emoji: '🟣',
    name: '에이몬 슬라임',
    unitRange: 'Unit 1 ~ 3',
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.5)',
    desc: '동글동글한 보라 슬라임 · 왕관 · </> 배지',
  },
  {
    id: 'robot',
    emoji: '🤖',
    name: '에이몬 로봇',
    unitRange: 'Unit 4 ~ 6',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.5)',
    desc: '헤드폰 달린 보라 로봇 · 왕관 · 입체감 UP',
  },
  {
    id: 'speech_bubble',
    emoji: '💬',
    name: '에이몬 말풍선',
    unitRange: 'Unit 7 ~ 8',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.5)',
    desc: '말풍선 몸체 · 흰 얼굴 패널 · {} </> 배지',
  },
  {
    id: 'final_ghost',
    emoji: '👻',
    name: '파이널 에이몬',
    unitRange: '전 유닛 클리어',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.5)',
    desc: '연보라 반투명 고스트 · AI 배지 · 프리미엄',
  },
]

// 완료 유닛 수 → 현재 진화 단계
function getEvolutionStage(completedUnits) {
  if (completedUnits >= 8) return EVOLUTION_STAGES[3]
  if (completedUnits >= 6) return EVOLUTION_STAGES[2]
  if (completedUnits >= 3) return EVOLUTION_STAGES[1]
  return EVOLUTION_STAGES[0]
}

// XP 레벨 테이블
function calcLevel(xp) {
  const thresholds = [
    ...Array(5).fill(1000),    // Lv 1→5
    ...Array(10).fill(2500),   // Lv 6→15
    ...Array(10).fill(5000),   // Lv 16→25
    ...Array(10).fill(10000),  // Lv 26→35
    ...Array(5).fill(20000),   // Lv 36→40
  ]
  let lv = 1, remaining = xp
  for (const threshold of thresholds) {
    if (remaining < threshold) return { lv, xpInLevel: remaining, xpForNext: threshold }
    remaining -= threshold
    lv++
    if (lv >= 40) return { lv: 40, xpInLevel: 0, xpForNext: 0 }
  }
  return { lv, xpInLevel: remaining, xpForNext: thresholds[lv - 1] }
}

export default function Home() {
  const user     = useAuthStore((s) => s.user)
  const token    = useAuthStore((s) => s.token)
  const navigate = useNavigate()

  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(!!token)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    progressApi.getStats()
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  /* ── 비로그인 랜딩 ── */
  if (!token) {
    return (
      <div className="home-page">
        {/* 히어로 섹션 */}
        <div className="home-hero">
          <div className="home-hero-char animate-float">🟣</div>
          <div className="home-hero-badge animate-fade-in">AI MON</div>
          <h1 className="home-hero-title animate-fade-in-up">
            에이몬과 함께<br />
            <span className="home-hero-accent">파이썬을 정복</span>하세요
          </h1>
          <p className="home-hero-sub animate-fade-in-up">
            Python 기초부터 AI 에이전트까지<br />
            게임하듯 재미있는 코딩 학습
          </p>
          <div className="home-hero-actions animate-fade-in-up">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate('/stage/1/1')}
              id="btn-free-trial"
            >
              🚀 1-1 무료 체험 시작
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => navigate('/auth')}
              id="btn-login-home"
            >
              로그인 / 회원가입
            </button>
          </div>
        </div>

        {/* 진화 프리뷰 */}
        <div className="home-evo-preview container">
          <h2 className="home-section-title">🌟 에이몬 진화 여정</h2>
          <div className="home-evo-track">
            {EVOLUTION_STAGES.map((stage, i) => (
              <div key={stage.id} className="home-evo-step">
                <div
                  className="home-evo-orb"
                  style={{ boxShadow: `0 0 20px ${stage.glow}`, borderColor: stage.color }}
                >
                  <span>{stage.emoji}</span>
                </div>
                <div className="home-evo-info">
                  <span className="home-evo-name" style={{ color: stage.color }}>{stage.name}</span>
                  <span className="home-evo-range">{stage.unitRange}</span>
                </div>
                {i < EVOLUTION_STAGES.length - 1 && (
                  <div className="home-evo-arrow">→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 특징 카드 */}
        <div className="home-features container">
          <h2 className="home-section-title">✨ 에이몬만의 특별함</h2>
          <div className="home-feature-grid">
            {[
              { icon: '🧠', title: 'Claude AI 오답 설명', desc: '틀린 문제를 AI가 비유와 예시로 친절하게 설명해줘요' },
              { icon: '⚔️', title: '보스 클리어 시스템', desc: '유닛 완료 후 보스를 쓰러뜨리면 인증카드가 자동 생성!' },
              { icon: '📈', title: 'XP · 레벨업', desc: '퀴즈를 풀수록 XP가 쌓이고, 에이몬이 함께 성장해요' },
            ].map((f) => (
              <div key={f.title} className="home-feature-card card-glass">
                <span className="home-feature-icon">{f.icon}</span>
                <h3 className="home-feature-title">{f.title}</h3>
                <p className="home-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ── 로딩 ── */
  if (loading) {
    return (
      <div className="home-loading">
        <div className="spinner" />
        <p>에이몬 로딩 중...</p>
      </div>
    )
  }

  /* ── 로그인 대시보드 ── */
  const completedStages = stats?.completed_stages || 0
  const completedUnits  = Math.floor(completedStages / 7)   // 대략 7 스테이지/유닛
  const evoStage        = getEvolutionStage(completedUnits)
  const totalXp         = completedStages * 500
  const { lv, xpInLevel, xpForNext } = calcLevel(totalXp)
  const xpPct = xpForNext > 0 ? Math.round((xpInLevel / xpForNext) * 100) : 100
  const streak = user?.streak || 0

  return (
    <div className="home-page">
      {/* 인사 + 캐릭터 카드 */}
      <div className="home-dashboard-header">
        <div className="home-dash-greeting">
          <p className="home-dash-sub">안녕하세요,</p>
          <h1 className="home-dash-name">{user?.nickname || user?.username} 님! 👋</h1>
        </div>

        {/* 현재 에이몬 진화 카드 */}
        <div
          className="home-char-card card-glass animate-fade-in-up"
          style={{ borderColor: evoStage.color + '60' }}
        >
          <div className="home-char-orb animate-float" style={{ boxShadow: `0 0 40px ${evoStage.glow}` }}>
            <span className="home-char-emoji">{evoStage.emoji}</span>
          </div>
          <div className="home-char-meta">
            <span className="home-char-name" style={{ color: evoStage.color }}>{evoStage.name}</span>
            <span className="home-char-range">{evoStage.unitRange}</span>
            {/* XP 바 */}
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
          {/* 스트릭 배지 */}
          {streak > 0 && (
            <div className="home-streak-badge">
              🔥 {streak}일 연속
            </div>
          )}
        </div>

        {/* 다음 진화 힌트 */}
        {completedUnits < 8 && (
          <div className="home-next-evo">
            <span className="home-next-evo-label">다음 진화까지</span>
            <span className="home-next-evo-val">
              {completedUnits < 3 && `Unit 3 완료 → 🤖 로봇 진화`}
              {completedUnits >= 3 && completedUnits < 6 && `Unit 6 완료 → 💬 말풍선 진화`}
              {completedUnits >= 6 && `Unit 8 완료 → 👻 파이널 진화`}
            </span>
          </div>
        )}
      </div>

      {/* 통계 카드 */}
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
            <div className="stat-label">스트릭</div>
          </div>
        </div>
      )}

      {/* 오늘 학습 시작 CTA */}
      <div className="home-cta container">
        <button
          id="btn-start-lesson"
          className="btn btn-primary btn-full btn-lg animate-pulse-glow"
          onClick={() => navigate('/lesson')}
        >
          📚 오늘 학습 시작하기
        </button>
      </div>

      {/* 보스 도전 안내 */}
      <div className="home-boss-hint container">
        <div className="card-glass home-boss-card">
          <span className="home-boss-icon">🐉</span>
          <div>
            <p className="home-boss-title">보스 전투</p>
            <p className="home-boss-desc">유닛을 완료하면 보스가 해금됩니다. 클리어 시 인증카드 자동 생성!</p>
          </div>
        </div>
      </div>
    </div>
  )
}
