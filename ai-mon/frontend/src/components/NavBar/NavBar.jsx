import { NavLink } from 'react-router-dom'
import './NavBar.css'

const NAV_ITEMS = [
  { to: '/',          icon: '🏠', label: '홈' },
  { to: '/character', icon: '🤖', label: '캐릭터' },
  { to: '/settings',  icon: '⚙️', label: '설정' },
]

export default function NavBar() {
  return (
    <nav className="navbar" role="navigation" aria-label="하단 내비게이션">
      <div className="navbar-inner">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            aria-label={label}
          >
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
