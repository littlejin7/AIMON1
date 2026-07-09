import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../hooks/useAuthStore'
import { gameApi, userApi } from '../../api'
import { CHAR_ICONS } from '../Character/characterData'
import { GAMES, CHALLENGE_GAMES, CHAL_META, loadCounts } from './gameConstants'
export { incrementGamePlay } from './gameConstants'
import './Game.css'

const RANK_MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function Game() {
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const updateUser = useAuthStore(s => s.updateUser)
  const [counts, setCounts]         = useState({})
  const [lockedGame, setLockedGame] = useState(null)
  const [challengeListOpen, setChallengeListOpen] = useState(true)
  const [challengeBonus, setChallengeBonus] = useState(null)
  const [challengeClaiming, setChallengeClaiming] = useState(false)
  const [challengeClaimError, setChallengeClaimError] = useState('')
  const [ranking, setRanking]             = useState(null)
  const [rankingLoading, setRankingLoading] = useState(false)
  const [rankingError, setRankingError]     = useState(false)

  useEffect(() => {
    setCounts(loadCounts())
  }, [])

  useEffect(() => {
    if (!token) {
      setRanking(null)
      setChallengeBonus(null)
      return
    }
    let cancelled = false
    setRankingLoading(true)
    setRankingError(false)
    gameApi.ranking(3)
      .then((res) => { if (!cancelled) setRanking(res.data) })
      .catch(() => { if (!cancelled) setRankingError(true) })
      .finally(() => { if (!cancelled) setRankingLoading(false) })
    gameApi.challengeStatus()
      .then((res) => { if (!cancelled) setChallengeBonus(res.data) })
      .catch(() => { if (!cancelled) setChallengeBonus(null) })
    return () => { cancelled = true }
  }, [token])

  const handleClick = (g) => {
    if (!g.available || !g.route) return
    if (!token) { setLockedGame(g); return }
    navigate(g.route)
  }

  const totalTarget = CHALLENGE_GAMES.reduce((s, g) => s + g.dailyTarget, 0)
  const totalDone   = CHALLENGE_GAMES.reduce((s, g) => s + Math.min(counts[g.id] || 0, g.dailyTarget), 0)
  const allDone     = totalDone >= totalTarget
  const bonusClaimed = challengeBonus?.claimed === true
  const showChallengeClaim = allDone && token && !bonusClaimed

  const handleClaimChallengeBonus = async () => {
    if (!showChallengeClaim || challengeClaiming) return
    setChallengeClaiming(true)
    setChallengeClaimError('')
    try {
      const res = await gameApi.claimChallengeBonus()
      setChallengeBonus(res.data)
      const userRes = await userApi.getMe()
      updateUser(userRes.data)
      window.dispatchEvent(new Event('aimon:reward-status-changed'))
    } catch (err) {
      setChallengeClaimError(err.response?.data?.detail || '보너스를 수령하지 못했어요.')
    } finally {
      setChallengeClaiming(false)
    }
  }
  
  const ringRadius        = 21
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringOffset        = ringCircumference - (totalDone / totalTarget) * ringCircumference

  if (lockedGame) {
    return (
      <div className="game-page app-locked-screen">
        <div className="game-card card-glass animate-fade-in-up app-locked-card">
          <button
            onClick={() => setLockedGame(null)}
            className="app-locked-close no-3d"
            aria-label="닫기"
          >✕</button>
          <div className="game-icon app-locked-icon">🔒</div>
          <h2 className="app-locked-title">
            {lockedGame.title} 잠김
          </h2>
          <p className="app-locked-desc">
            로그인하시면 <strong>{lockedGame.title}</strong> 미니게임을 플레이하고<br />
            다양한 코딩 학습 모험과 <strong>코인, 왕관</strong> 보상을 받을 수 있습니다!
          </p>
          <button className="btn btn-primary btn-lg btn-full" onClick={() => navigate('/auth')}>
            로그인하러 가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="game-page">

      {/* ── 헤더 ── */}
      <div className="game-header">
        <p className="game-header-label">TRAINING</p>
        <h1 className="game-title">미니게임</h1>
      </div>

      {/* ── 오늘의 챌린지 카드 ── */}
      <div className="game-challenge-hero card-glass">
        <div className="game-challenge-top">
          <span className="game-challenge-trophy">🏆</span>
          <div className="game-challenge-text">
            <p className="game-challenge-title">오늘의 챌린지</p>
            <p className="game-challenge-sub">모두 달성하면 보너스 지급!</p>
          </div>
          {allDone
            ? <span className="game-challenge-done-badge">완료 ✓</span>
            : <span className="game-bonus-tag">👑 +5 <span className="game-bonus-label">보너스</span></span>
          }
        </div>

        <div className="game-overall-row">
          <div className="game-ring-wrap">
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5"/>
              <circle
                cx="26" cy="26" r={ringRadius}
                fill="none" stroke="var(--clr-primary)" strokeWidth="5"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                strokeLinecap="round"
                transform="rotate(-90 26 26)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="game-ring-label">
              <span className="game-ring-num">{totalDone}</span>
              <span className="game-ring-total">/ {totalTarget}판</span>
            </div>
          </div>
          <div className="game-overall-right">
            <div className="game-overall-label">
              <span>전체 달성률</span>
              <span className="game-overall-val">{totalDone} / {totalTarget}판</span>
            </div>
            <div className="game-overall-bar-bg">
              <div className="game-overall-bar-fill" style={{ width: `${totalTarget ? (totalDone / totalTarget) * 100 : 0}%` }}/>
            </div>
            <p className="game-overall-msg">
              {allDone
                ? bonusClaimed
                  ? '🎉 오늘 보너스 수령 완료!'
                  : '🎉 오늘 챌린지 완료!'
                : `👑 +5 보너스까지 ${totalTarget - totalDone}판 남았어요`}
            </p>
          </div>
        </div>

        {showChallengeClaim && (
          <button
            type="button"
            className="game-challenge-claim-btn"
            onClick={handleClaimChallengeBonus}
            disabled={challengeClaiming}
          >
            {challengeClaiming ? '수령 중...' : '👑 왕관 5개 수령하기'}
          </button>
        )}
        {challengeClaimError && <div className="game-challenge-claim-error">{challengeClaimError}</div>}

        <button
          type="button"
          className="game-challenge-toggle no-3d"
          onClick={() => setChallengeListOpen(open => !open)}
          aria-expanded={challengeListOpen}
        >
          <span className="game-challenge-toggle-label">챌린지 목록</span>
          <span className={`game-challenge-arrow${challengeListOpen ? ' open' : ''}`}>{'>'}</span>
        </button>

        {challengeListOpen && (
          <div className="game-challenge-list">
            {CHALLENGE_GAMES.map((g) => {
              const done = Math.min(counts[g.id] || 0, g.dailyTarget)
              const meta = CHAL_META[g.id] || {}
              return (
                <div key={g.id} className="game-challenge-item">
                  <div className="game-chal-icon">
                    {meta.img
                      ? <img src={meta.img} alt={g.title} style={{ width: 22, height: 22, objectFit: 'contain' }} />
                      : <span style={{ fontSize: 15 }}>{g.emoji}</span>
                    }
                  </div>
                  <div className="game-chal-info">
                    <div className="game-chal-name-row">
                      <span className="game-chal-name">{g.title}</span>
                      <div className="game-challenge-dots" aria-label={`${done} / ${g.dailyTarget} 완료`}>
                        {Array.from({ length: g.dailyTarget }, (_, i) => (
                          <span
                            key={i}
                            className={`game-challenge-check${i < done ? ' filled' : ''}`}
                            style={i < done ? { color: meta.color, borderColor: meta.color } : undefined}
                          >
                            ✓
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 이번 주 랭킹 ── */}
      <div className="game-ranking-card card-glass">
        <div className="game-ranking-header">
          <span className="game-ranking-title">이번 주 미니게임 랭킹</span>
          {token && (
            <span className="game-ranking-more" onClick={() => navigate('/game/ranking')}>전체 보기 →</span>
          )}
        </div>

        {!token ? (
          <div className="game-ranking-locked">
            <div className="game-ranking-locked-blur">
              {[1, 2, 3].map((rank) => (
                <div key={rank} className="game-rank-row">
                  <span className="game-rank-medal">{RANK_MEDALS[rank]}</span>
                  <div className="game-rank-avatar" />
                  <span className="game-rank-name">???</span>
                  <span className="game-rank-score">🎮 ??점</span>
                </div>
              ))}
            </div>
            <div className="game-ranking-lock-overlay">
              <span className="game-ranking-lock-icon">🔒</span>
              <p className="game-ranking-lock-text">로그인하고 순위 확인</p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/auth')}>
                로그인하러 가기
              </button>
            </div>
          </div>
        ) : rankingLoading ? (
          <div className="game-ranking-status">불러오는 중...</div>
        ) : rankingError ? (
          <div className="game-ranking-status">랭킹을 불러오지 못했어요.</div>
        ) : !ranking || ranking.top.length === 0 ? (
          <div className="game-ranking-status">이번 주 기록이 아직 없어요.</div>
        ) : (
          <>
            {ranking.top.map((r) => (
              <div key={r.rank} className="game-rank-row">
                <span className="game-rank-medal">{RANK_MEDALS[r.rank] || r.rank}</span>
                <div className="game-rank-avatar">
                  <img src={CHAR_ICONS[r.character] || CHAR_ICONS.slime} alt="" className="game-rank-avatar-img" />
                </div>
                <span className="game-rank-name">{r.nickname}</span>
                <span className="game-rank-score">🎮 {r.score}점</span>
              </div>
            ))}
            {ranking.me && (
              <div className="game-rank-row game-rank-row--me">
                <span className="game-rank-medal game-rank-medal--me">{ranking.me.rank}</span>
                <div className="game-rank-avatar">
                  <img src={CHAR_ICONS[ranking.me.character] || CHAR_ICONS.slime} alt="" className="game-rank-avatar-img" />
                </div>
                <span className="game-rank-name" style={{ fontWeight: 600 }}>나</span>
                <span className="game-rank-score">🎮 {ranking.me.score}점</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 게임 목록 ── */}
      <p className="game-section-label">게임 목록</p>
      <div className="game-list">
        {GAMES.map((g) => {
          const done = g.dailyTarget
            ? Math.min(counts[g.id] || 0, g.dailyTarget) >= g.dailyTarget
            : false
          return (
            <div
              key={g.id}
              className={`game-row card-glass${g.available ? ' game-row--active' : ' game-row--locked'}`}
              onClick={() => handleClick(g)}
              role={g.available ? 'button' : undefined}
            >
              <div className="game-row-icon">
                {g.icon
                  ? <img src={g.icon} alt={g.title} />
                  : <span className="game-row-emoji">{g.emoji}</span>
                }
              </div>
              <div className="game-row-info">
                <p className="game-row-title">{g.title}</p>
                <p className="game-row-desc">{g.desc}</p>
                <span className="game-row-reward">{g.rewardIcon} {g.reward}</span>
              </div>
              <button className="game-play-btn" aria-label={`${g.title} 플레이`} tabIndex={-1}>
                {!g.available
                  ? <span style={{ fontSize: '0.8rem' }}>🔒</span>
                  : done
                  ? <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>✓</span>
                  : <span style={{ fontSize: '0.75rem', marginLeft: 2 }}>▶</span>
                }
              </button>
            </div>
          )
        })}
        </div>
      
    </div>
  )
}
