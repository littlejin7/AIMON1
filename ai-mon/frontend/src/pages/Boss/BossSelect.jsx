import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { bossApi } from '../../api/index'
import { getBossCardState } from './bossSelectUtils'
import './BossSelect.css'

const UNIT_ICONS = {
  1: '🖨️',
  2: '📋',
  3: '🔀',
  4: '🔁',
  5: '⚙️',
  6: '📝',
  7: '🌐',
  8: '🤖'
}

export default function BossSelect() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [bosses, setBosses] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchBossInfo = async () => {
      try {
        const promises = [1, 2, 3, 4, 5, 6, 7, 8].map(unit =>
          bossApi.getInfo(unit).then(res => ({
            unit,
            ...res.data
          }))
        )
        const data = await Promise.all(promises)
        setBosses(data)
      } catch (err) {
        console.error(err)
        setError('보스 스테이지 정보를 불러오는 데 실패했습니다.')
      } finally {
        setLoading(false)
      }
    }
    fetchBossInfo()
  }, [])

  if (loading) {
    return (
      <div className="boss-loading">
        <div className="spinner" />
        <p style={{ marginTop: '1rem', color: 'var(--clr-text-muted)' }}>보스 목록을 불러오고 있습니다...</p>
      </div>
    )
  }

  return (
    <div className="boss-select-page container animate-fade-in-up">
      <div className="boss-select-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/lesson')}>
          ◀ 레슨 홈으로
        </button>
        <h1 className="boss-select-title">⚔️ 유닛 보스 도전</h1>
        <p className="boss-select-subtitle">각 유닛의 강력한 보스몬스터들을 처치하고 특별한 보상을 획득하세요!</p>
      </div>

      {error && <div className="boss-select-error">{error}</div>}

      <div className="boss-select-grid">
        {bosses.map((boss) => {
          const { freeOut, canCrown, isBlocked } = getBossCardState(boss)
          const icon = UNIT_ICONS[boss.unit] || '👾'

          return (
            <button
              key={boss.unit}
              className={`boss-select-card card-glass ${isBlocked ? 'bs-dimmed' : ''}`}
              onClick={() => navigate(`/boss/${boss.unit}`)}
            >
              {freeOut && canCrown && <span className="bs-crown-badge">👑 왕관으로 도전</span>}
              {isBlocked && <span className="bs-exhausted-badge">도전권 소진</span>}

              <div className="bs-card-top">
                <div className="bs-unit-badge">
                  <span>Unit {boss.unit}</span>
                </div>
                <span className="bs-icon">{icon}</span>
              </div>

              <div className="bs-card-body">
                <h3 className="bs-boss-name">{boss.boss_name}</h3>
                <div className="bs-reward-row">
                  <span className="bs-reward-tag">⭐ +{boss.xp_reward} XP</span>
                  <span className="bs-reward-tag">👑 왕관 획득 가능</span>
                </div>
              </div>

              <div className="bs-card-footer">
                <span className={`bs-attempts ${isBlocked ? 'bs-out' : freeOut ? 'bs-crown-text' : 'bs-available'}`}>
                  {isBlocked
                    ? '왕관이 없어 도전 불가'
                    : freeOut
                      ? '무료 도전 완료 · 👑으로 도전 가능'
                      : `오늘 무료 도전 ${boss.free_attempts_per_day}회 남음`}
                </span>
                <span className="bs-arrow">›</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
