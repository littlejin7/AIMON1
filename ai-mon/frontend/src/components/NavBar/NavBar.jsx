import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { progressApi, quizApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import './NavBar.css'

const NAV_ITEMS = [
  {
    to: '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
    label: '레슨',
  },
  {
    to: '/train',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-.17-2.17"/>
      </svg>
    ),
    label: '훈련',
  },
  {
    to: '/game',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" ry="2"/>
        <path d="M6 12h4"/>
        <path d="M8 10v4"/>
        <line x1="15" y1="13" x2="15.01" y2="13"/>
        <line x1="18" y1="11" x2="18.01" y2="11"/>
      </svg>
    ),
    label: '미니게임',
  },
  {
    to: '/character',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    label: '내 캐릭터',
  },
]

export default function NavBar() {
  const location = useLocation()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const cacheKey = `is_train_unlocked_${user?.id}`

  const [isTrainUnlocked, setIsTrainUnlocked] = useState(() => {
    return localStorage.getItem(cacheKey) === 'true'
  })

  useEffect(() => {
    if (!token || !user) {
      setIsTrainUnlocked(true)
      return
    }

    // If already unlocked in cache, no need to query again
    if (localStorage.getItem(cacheKey) === 'true') {
      setIsTrainUnlocked(true)
      return
    }

    const checkTrainUnlocked = async () => {
      try {
        const progressRes = await progressApi.getProgress()
        const progress = progressRes.data || []
        const isUnit1BossCleared = progress.some(p => p.unit === 1 && p.stage === "1-boss" && p.is_completed)
        setIsTrainUnlocked(isUnit1BossCleared)
        localStorage.setItem(cacheKey, isUnit1BossCleared ? 'true' : 'false')
      } catch (err) {
        console.error('Failed to check training lock status in NavBar:', err)
      }
    }

    checkTrainUnlocked()
  }, [token, location.pathname, user?.id]) // Refresh on path changes to pick up progress changes

  // 스테이지/보스 화면 등 서브 경로에서 어느 탭이 활성인지 계산
  const isLessonActive =
    location.pathname.startsWith('/lesson') ||
    location.pathname.startsWith('/stage') ||
    location.pathname.startsWith('/boss') ||
    location.pathname === '/'

  return (
    <nav className="navbar" role="navigation" aria-label="하단 내비게이션">
      <div className="navbar-inner">
        {NAV_ITEMS.map(({ to, icon, label }) => {
          const isTrain = to === '/train'
          const locked = isTrain && !isTrainUnlocked

          // 레슨 탭은 여러 경로를 커버하므로 수동 active 처리
          const active =
            to === '/'
              ? isLessonActive
              : location.pathname.startsWith(to)

          return (
            <NavLink
              key={to}
              to={to}
              className={`nav-item${active ? ' active' : ''}${locked ? ' locked' : ''}`}
              aria-label={locked ? `${label} (잠김)` : label}
            >
              <span className="nav-icon">
                {locked ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                ) : icon}
              </span>
              <span className="nav-label">
                {locked ? '훈련 🔒' : label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
