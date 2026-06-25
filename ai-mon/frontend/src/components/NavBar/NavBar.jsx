import { useLocation, NavLink } from 'react-router-dom'
import './NavBar.css'

const NAV_ITEMS = [
  {
    to: '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    label: '홈',
    exact: true,
  },
  {
    to: '/lesson',
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
        <path d="M6 12h4"/><path d="M8 10v4"/>
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
    label: '내 에이몬',
  },
]

export default function NavBar() {
  const location = useLocation()

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.to
    if (item.to === '/lesson') {
      return location.pathname.startsWith('/lesson') ||
        location.pathname.startsWith('/stage') ||
        location.pathname.startsWith('/boss')
    }
    if (item.to === '/game') return location.pathname.startsWith('/game')
    return location.pathname.startsWith(item.to)
  }

  return (
    <nav className="navbar" role="navigation" aria-label="하단 내비게이션">
      <div className="navbar-inner">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={`nav-item${isActive(item) ? ' active' : ''}`}
            aria-label={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
