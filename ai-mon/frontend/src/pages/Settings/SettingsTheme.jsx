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

  const currentXp      = user?.xp || 0
  const purchasedThemes = user?.purchased_themes || ['dark']

  const handleSelect = (t) => {
    if (!purchasedThemes.includes(t.id)) return
    setTheme(t.id)
  }

  const handleBuyClick = (t) => {
    if (currentXp < t.xpCost) {
      setFeedback({ type: 'error', msg: `XP가 부족해요. (보유: ${currentXp} XP)` })
      setTimeout(() => set
