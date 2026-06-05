import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../hooks/useAuthStore'
import './TopBar.css'

export default function TopBar() {
  const { user, token, logout } = useAuthStore()
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)

  if (!token || !user) return null

  const handleLogout = () => {
    logout()
    setShowDropdown(false)
    navigate('/')
  }

  return (
    <div className="topbar">
      <div className="topbar-logo" onClick={() => navigate('/')}>
        AI MON
      </div>
      <div className="topbar-right">
        <div className="topbar-assets">
          <span className="asset-item" title="왕관 (도전/힌트 비용)">👑 {user.crowns || 0}</span>
        </div>
        <div className="topbar-profile" onClick={() => setShowDropdown(!showDropdown)}>
          <div className="profile-avatar">
            {user.nickname ? user.nickname[0].toUpperCase() : 'U'}
          </div>
          <div className="profile-info">
            <span className="profile-name">{user.nickname || user.username}</span>
            <span className="profile-level">{user.course_level}</span>
          </div>
        </div>

        {showDropdown && (
          <div className="profile-dropdown animate-fade-in">
            <div className="dropdown-header">
              <strong>{user.nickname}</strong>
              <div style={{ color: '#a0a0b0', fontSize: '0.8rem', marginTop: '4px' }}>Lv. {user.level || 1}</div>
            </div>
            <div className="dropdown-divider" />
            <button className="dropdown-item" onClick={() => navigate('/character')}>
              👤 내 프로필
            </button>
            <button className="dropdown-item" onClick={() => navigate('/settings')}>
              ⚙️ 설정
            </button>
            <div className="dropdown-divider" />
            <button className="dropdown-item logout-btn" onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
