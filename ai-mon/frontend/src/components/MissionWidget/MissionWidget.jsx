import { useState, useEffect, useCallback } from 'react'
import { missionApi } from '../../api'
import './MissionWidget.css'

export default function MissionWidget() {
  const [missions, setMissions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState({})

  const load = useCallback(() => {
    missionApi.getMissions()
      .then(res => setMissions(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const claim = (missionId) => {
    if (claiming[missionId]) return
    setClaiming(p => ({ ...p, [missionId]: true }))
    missionApi.claimMission(missionId)
      .then(() => load())
      .catch(() => {})
      .finally(() => setClaiming(p => ({ ...p, [missionId]: false })))
  }

  if (loading || !missions) return null

  const renderRow = (m) => {
    const pct = m.goal > 0 ? Math.min(100, Math.round((m.progress / m.goal) * 100)) : 0
    const canClaim = m.progress >= m.goal && !m.claimed && !m.auto_claim
    const rewardStr = [
      m.reward.xp    ? `+${m.reward.xp} XP` : '',
      m.reward.crowns ? `👑 ${m.reward.crowns}` : '',
    ].filter(Boolean).join(' · ')

    return (
      <div key={m.mission_id} className="mw-row">
        <div className="mw-top">
          <span className="mw-title">{m.title}</span>
          <span className="mw-prog-txt">{m.progress} / {m.goal}</span>
        </div>
        <div className="mw-bar-wrap">
          <div className="mw-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="mw-bottom">
          <span className="mw-reward">{rewardStr}</span>
          {m.claimed
            ? <span className="mw-done-badge">✓ 수령완료</span>
            : m.auto_claim
              ? <span className="mw-auto-badge">자동지급</span>
              : canClaim
                ? <button
                    className="mw-claim-btn"
                    onClick={() => claim(m.mission_id)}
                    disabled={!!claiming[m.mission_id]}
                  >
                    {claiming[m.mission_id] ? '...' : '수령'}
                  </button>
                : null
          }
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="hd-section-header">
        <span className="hd-section-title">데일리 미션</span>
      </div>
      <div className="hd-card mw-card">
        {missions.daily.map(renderRow)}
      </div>

      <div className="hd-section-header">
        <span className="hd-section-title">위클리 미션</span>
      </div>
      <div className="hd-card mw-card">
        {missions.weekly.map(renderRow)}
      </div>
    </>
  )
}
