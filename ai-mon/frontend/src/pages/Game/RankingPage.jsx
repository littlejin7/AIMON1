import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { gameApi } from '../../api'
import { CHAR_ICONS } from '../Character/characterData'
import './RankingPage.css'

const RANK_MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function RankingPage() {
  const navigate = useNavigate()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    gameApi.rankingByGame(3)
      .then((res) => { if (!cancelled) setData(res.data) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="ranking-page">
      <div className="ranking-page-header">
        <button className="ranking-back-btn" onClick={() => navigate(-1)} aria-label="뒤로">←</button>
        <h1 className="ranking-page-title">이번 주 미니게임 랭킹</h1>
      </div>

      {loading ? (
        <div className="ranking-page-status">불러오는 중...</div>
      ) : error ? (
        <div className="ranking-page-status">랭킹을 불러오지 못했어요.</div>
      ) : !data || data.games.length === 0 ? (
        <div className="ranking-page-status">랭킹 정보가 없어요.</div>
      ) : (
        data.games.map((g) => {
          const iMePlayed = g.me && g.me.score > 0
          return (
            <div key={g.game_id} className="ranking-section card-glass">
              <div className="ranking-section-header">
                <span className="ranking-section-title">{g.title}</span>
              </div>

              {g.top.length === 0 ? (
                <div className="ranking-section-empty">이번 주 기록이 아직 없어요.</div>
              ) : (
                g.top.map((r) => (
                  <div key={r.rank} className="ranking-row">
                    <span className="ranking-medal">{RANK_MEDALS[r.rank] || r.rank}</span>
                    <div className="ranking-avatar">
                      <img src={CHAR_ICONS[r.character] || CHAR_ICONS.slime} alt="" className="ranking-avatar-img" />
                    </div>
                    <span className="ranking-name">{r.nickname}</span>
                    <span className="ranking-score">🎮 {r.score}점</span>
                  </div>
                ))
              )}

              {g.me && (
                <div className="ranking-row ranking-row--me">
                  <span className="ranking-medal ranking-medal--me">{iMePlayed ? g.me.rank : '-'}</span>
                  <div className="ranking-avatar">
                    <img src={CHAR_ICONS[g.me.character] || CHAR_ICONS.slime} alt="" className="ranking-avatar-img" />
                  </div>
                  <span className="ranking-name" style={{ fontWeight: 600 }}>나</span>
                  <span className="ranking-score">
                    {iMePlayed ? `🎮 ${g.me.score}점` : '이번 주 기록 없음'}
                  </span>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
