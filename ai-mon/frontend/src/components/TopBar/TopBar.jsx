import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../hooks/useAuthStore'
import './TopBar.css'
import slimeIcon from '../../assets/character_slime.png'
import robotIcon from '../../assets/character_robot.png'
import speechBubbleIcon from '../../assets/character_bubble.png'
import finalGhostIcon from '../../assets/character_final_ghost.png'
import crownIcon from '../../assets/crown.png'
const CHARACTER_ICONS = {
  slime: slimeIcon,
  robot: robotIcon,
  speech_bubble: speechBubbleIcon,
  final_ghost: finalGhostIcon,
}

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
          <span className="asset-item" title="왕관 (도전/힌트 비용)">
          <img src={crownIcon} alt="왕관" style={{ width: '50px', height: '50px', objectFit: 'contain', verticalAlign: 'middle' }} />
          {' '}{user.crowns || 0}
        </span>
        </div>
        <div className="topbar-profile" onClick={() => setShowDropdown(!showDropdown)}>
          <div className="profile-avatar">
          {CHARACTER_ICONS[user.character]
            ? <img src={CHARACTER_ICONS[user.character]} alt="캐릭터" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : user.nickname ? user.nickname[0].toUpperCase() : 'U'
          }
        </div>
          <div className="profile-info">
            <span className="profile-name">{user.nickname}</span>
            {/* 변경: 텍스트 → 컬러 배지로 */}
            <span className={`profile-level-badge difficulty-${user.course_level}`}>
              {user.course_level === 'advanced' ? '고급'
                : user.course_level === 'intermediate' ? '중급'
                : '초급'}
            </span>
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
