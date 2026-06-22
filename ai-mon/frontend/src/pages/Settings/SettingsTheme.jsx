import { useState } from 'react'
import { useAuthStore } from '../../hooks/useAuthStore'

const THEMES = [
  { id: 'dark',     label: '🌑 다크',     color: '#7dd3fc', xpCost: 0    },
  { id: 'ocean',    label: '🌊 오션',     color: '#0ea5e9', xpCost: 500  },
  { id: 'fire',     label: '🔥 파이어',   color: '#f87171', xpCost: 500  },
  { id: 'cyber',    label: '💚 사이버',   color: '#34d399', xpCost: 500  },
  { id: 'cherry',   label: '🌸 체리',     color: '#f472b6', xpCost: 800  },
  { id: 'midnight', label: '🌙 미드나잇', color: '#818cf8', xpCost: 800  },
  { id: 'sunset',   label: '🍊 선셋',     color: '#fb923c', xpCost: 800  },
  { id: 'gold',     label: '💛 골드',     color: '#fbbf24', xpCost: 1000 },
  { id: 'arctic',   label: '🤍 아크틱',   color: '#94a3b8', xpCost: 1000 },
  { id: 'galaxy',   label: '🩵 갤럭시',   color: '#a78bfa', xpCost: 1500 },
  { id: 'sakura',   label: '🌸 사쿠라',   color: '#ec4899', xpCost: 2000 },
]

export default function SettingsTheme() {
  const theme         = useAuthStore((s) => s.theme)
  const setTheme      = useAuthStore((s) => s.setTheme)
  const purchaseTheme = useAuthStore((s) => s.purchaseTheme)
  const user          = useAuthStore((s) => s.user)

  const [loading, setLoading]   = useState(null)   // 구매 중인 themeId
  const [feedback, setFeedback] = useState(null)   // { type: 'success'|'error', msg }
  const [confirm, setConfirm]   = useState(null)   // 구매 확인 중인 theme 객체

  const currentXp       = user?.xp || 0
  const purchasedThemes = user?.purchased_themes || ['dark']

  const handleSelect = (t) => {
    if (!purchasedThemes.includes(t.id)) return
    setTheme(t.id)
  }

  const handleBuyClick = (t) => {
    if (currentXp < t.xpCost) {
      setFeedback({ type: 'error', msg: `XP가 부족해요. (보유: ${currentXp} XP)` })
      setTimeout(() => setFeedback(null), 3000)
      return
    }
    setConfirm(t)
  }

  const handleConfirmBuy = async () => {
    if (!confirm) return
    setLoading(confirm.id)
    setConfirm(null)
    try {
      await purchaseTheme(confirm.id)
      setFeedback({ type: 'success', msg: `${confirm.label} 테마를 구매했어요!` })
    } catch {
      setFeedback({ type: 'error', msg: '구매 중 오류가 발생했어요.' })
    } finally {
      setLoading(null)
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  return (
    <div className="space-y-4">
      {/* 보유 XP */}
      <div className="text-sm text-gray-400">보유 XP: ⚡ {currentXp} XP</div>

      {/* 피드백 토스트 */}
      {feedback && (
        <div
          className={`text-sm px-3 py-2 rounded ${
            feedback.type === 'success'
              ? 'bg-green-800 text-green-200'
              : 'bg-red-800 text-red-200'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* 구매 확인 모달 */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-xl p-6 space-y-4 w-72">
            <p className="text-white font-semibold">{confirm.label} 테마 구매</p>
            <p className="text-gray-400 text-sm">⚡ {confirm.xpCost} XP 사용</p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmBuy}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm"
              >
                구매
              </button>
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white rounded-lg py-2 text-sm"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 테마 목록 */}
      <div className="grid grid-cols-2 gap-3">
        {THEMES.map((t) => {
          const owned     = purchasedThemes.includes(t.id)
          const active    = theme === t.id
          const canAfford = currentXp >= t.xpCost
          const isLoading = loading === t.id

          return (
            <div
              key={t.id}
              onClick={() => owned && handleSelect(t)}
              className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all
                ${active  ? 'border-blue-400 bg-blue-900/30' : 'border-gray-700 bg-gray-800'}
                ${owned && !active ? 'cursor-pointer hover:border-gray-500' : ''}
                ${!owned ? 'opacity-70' : ''}`}
            >
              <span
                className="w-5 h-5 rounded-full flex-shrink-0"
                style={{ background: t.color }}
              />
              <span className="text-sm text-white flex-1">{t.label}</span>

              {owned ? (
                active && <span className="text-xs text-blue-400">✓</span>
              ) : (
                <button
                  disabled={isLoading}
                  onClick={(e) => { e.stopPropagation(); handleBuyClick(t) }}
                  className={`text-xs px-2 py-1 rounded-lg ${
                    canAfford
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? '...' : canAfford ? `⚡ ${t.xpCost}` : '🔒'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
