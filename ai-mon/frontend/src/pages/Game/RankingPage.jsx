import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { gameApi } from '../../api'
import { CHAR_ICONS } from '../Character/characterData'
import './RankingPage.css'

const RANK_MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

// API 응답에 이미 들어있을 수 있는 "지난주 우승자" 데이터를 여러 키 형태에서 안전하게 추출.
// 더미를 만들지 않는다 — 유효한 nickname 이 없으면 null 을 반환해 배너를 렌더링하지 않는다.
function pickLastWeekWinner(data) {
  if (!data) return null
  const raw =
    data.last_week_winner ||
    data.lastWeekWinner ||
    data.last_week ||
    data.lastWeek ||
    null
  if (!raw) return null
  const w = raw.winner || raw            // { winner: {...} } 래퍼도 허용
  if (!w || !w.nickname) return null
  return {
    nickname: w.nickname,
    score: w.score,
    game_title: w.game_title || w.title || raw.game_title || raw.title || null,
    character: w.character || null,
  }
}

function LastWeekWinnerBanner({ data }) {
  const w = pickLastWeekWinner(data)
  if (!w) return null                    // 데이터 없으면 아무것도 렌더링하지 않음

  const meta = [
    w.game_title,
    w.score != null ? `${w.score}점` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="last-week-banner card-glass">
      <div className="last-week-banner-title">🏆 지난주 우승자</div>
      <div className="last-week-banner-body">
        {w.character && (
          <div className="last-week-banner-avatar">
            <img src={CHAR_ICONS[w.character] || CHAR_ICONS.slime} alt="" className="ranking-avatar-img" />
          </div>
        )}
        <div className="last-week-banner-info">
          <span className="last-week-banner-name">{w.nickname}</span>
          {meta && <span className="last-week-banner-meta">{meta}</span>}
        </div>
      </div>
      <div className="last-week-banner-cta">이번 주 왕좌에 도전해보세요!</div>
    </div>
  )
}

export default function RankingPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('weekly')
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    const request = activeTab === 'overall'
      ? gameApi.rankingOverall(10)
      : gameApi.rankingByGame(3)
    request
      .then((res) => { if (!cancelled) setData(res.data) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeTab])

  const renderOverallRanking = () => {
    const hasTop = data?.top?.length > 0
    const mePlayed = data?.me && data.me.score > 0

    return (
      <div className="ranking-section card-glass">
        <div className="ranking-section-header">
          <span className="ranking-section-title">누적 랭킹 점수</span>
        </div>

        {!hasTop ? (
          <div className="ranking-section-empty">누적 랭킹 점수가 아직 없어요.</div>
        ) : (
          data.top.map((r) => (
            <div key={`${r.rank}-${r.nickname}`} className="ranking-row">
              <span className="ranking-medal">{RANK_MEDALS[r.rank] || r.rank}</span>
              <div className="ranking-avatar">
                <img src={CHAR_ICONS[r.character] || CHAR_ICONS.slime} alt="" className="ranking-avatar-img" />
              </div>
              <span className="ranking-name">{r.nickname}</span>
              <span className="ranking-score">🏆 {r.score}점</span>
            </div>
          ))
        )}

        {data?.me && (
          <div className="ranking-row ranking-row--me">
            <span className="ranking-medal ranking-medal--me">{mePlayed ? data.me.rank : '-'}</span>
            <div className="ranking-avatar">
              <img src={CHAR_ICONS[data.me.character] || CHAR_ICONS.slime} alt="" className="ranking-avatar-img" />
            </div>
            <span className="ranking-name" style={{ fontWeight: 600 }}>나</span>
            <span className="ranking-score">
              {mePlayed ? `🏆 ${data.me.score}점` : '누적 기록 없음'}
            </span>
          </div>
        )}
      </div>
    )
  }

  const renderWeeklyRanking = () => (
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
  )

  return (
    <div className="ranking-page">
      <div className="ranking-page-header">
        <button className="ranking-back-btn" onClick={() => navigate(-1)} aria-label="뒤로">←</button>
        <h1 className="ranking-page-title">랭킹</h1>
      </div>

      <div className="ranking-tabs" role="tablist" aria-label="랭킹 종류">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'weekly'}
          className={`ranking-tab ${activeTab === 'weekly' ? 'ranking-tab--active' : ''}`}
          onClick={() => setActiveTab('weekly')}
        >
          주간
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overall'}
          className={`ranking-tab ${activeTab === 'overall' ? 'ranking-tab--active' : ''}`}
          onClick={() => setActiveTab('overall')}
        >
          누적
        </button>
      </div>

      {activeTab === 'weekly' && <LastWeekWinnerBanner data={data} />}

      {loading ? (
        <div className="ranking-page-status">불러오는 중...</div>
      ) : error ? (
        <div className="ranking-page-status">랭킹을 불러오지 못했어요.</div>
      ) : activeTab === 'weekly' && (!data || data.games.length === 0) ? (
        <div className="ranking-page-status">랭킹 정보가 없어요.</div>
      ) : (
        activeTab === 'overall' ? renderOverallRanking() : renderWeeklyRanking()
      )}
    </div>
  )
}
