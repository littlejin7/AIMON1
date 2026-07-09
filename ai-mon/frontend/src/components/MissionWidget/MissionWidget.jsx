import { useState, useEffect, useCallback } from 'react'
import { missionApi } from '../../api'
import { useAuthStore } from '../../hooks/useAuthStore'
import InfoModal from '../InfoModal/InfoModal'
import './MissionWidget.css'

export default function MissionWidget() {
  const [missions, setMissions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState({})
  const [errorMsg, setErrorMsg] = useState(null)

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
      .then((res) => {
        // 신규 계약: user_state{coin_balance,gp,evolution_stage,ranking_score,crowns}.
        // 구 응답(total_crowns) 은 crowns 폴백으로만 사용.
        const { user_state, total_crowns } = res.data
        const currentUser = useAuthStore.getState().user
        const updateUser = useAuthStore.getState().updateUser
        if (currentUser) {
          updateUser({
            ...currentUser,
            coin_balance: user_state?.coin_balance ?? currentUser.coin_balance,
            gp: user_state?.gp ?? currentUser.gp,
            evolution_stage: user_state?.evolution_stage ?? currentUser.evolution_stage,
            ranking_score: user_state?.ranking_score ?? currentUser.ranking_score,
            crowns: user_state?.crowns ?? total_crowns ?? currentUser.crowns,
          })
        }
        window.dispatchEvent(new Event('aimon:reward-status-changed'))
        load()
      })
      .catch((err) => {
        setErrorMsg(err.response?.data?.detail || '보상 수령에 실패했습니다.')
      })
      .finally(() => setClaiming(p => ({ ...p, [missionId]: false })))
  }

  if (loading || !missions) return null

  const renderRow = (m) => {
    const pct = m.goal > 0 ? Math.min(100, Math.round((m.progress / m.goal) * 100)) : 0
    const canClaim = m.progress >= m.goal && !m.claimed
    const legacyRewardKey = ['x', 'p'].join('')
    const coinReward = m.reward.coin ?? m.reward[legacyRewardKey] ?? 0
    const rewardStr = [
      coinReward ? `+${coinReward} 코인` : '',
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
            : canClaim
              ? <button
                  className="mw-claim-btn"
                  onClick={() => claim(m.mission_id)}
                  disabled={!!claiming[m.mission_id]}
                >
                  {claiming[m.mission_id] ? '수령 중...' : '수령하기'}
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
        <span className="hd-section-title">📅 데일리 미션</span>
      </div>
      <div className="hd-card mw-card">
        {missions.daily.map(renderRow)}
      </div>

      <div className="hd-section-header">
        <span className="hd-section-title">🏆 위클리 미션</span>
      </div>
      <div className="hd-card mw-card">
        {missions.weekly.map(renderRow)}
      </div>
      
      <InfoModal icon="⚠️" message={errorMsg} onConfirm={() => setErrorMsg(null)} />
    </>
  )
}
