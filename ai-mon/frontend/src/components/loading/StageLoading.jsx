// StageLoading.jsx
// 퀴즈/스테이지 전환 로딩 (스플래시)
//
// 사용법 (Stage.jsx):
//   if (loading) return <StageLoading message="문제 불러오는 중..." />
//
// Props:
//   message  string  로딩 텍스트 (기본값: "잠깐만요!")

import characterMain from '../../assets/character_main.png'
import './StageLoading.css'

export default function StageLoading({ message = '잠깐만요!' }) {
  return (
    <div className="stage-loading-wrap">
      <span className="stage-loading-badge">LOADING</span>

      <div className="stage-loading-char">
        <img src={characterMain} alt="에이몬" />
      </div>

      <span className="stage-loading-title">에이몬</span>
      <p className="stage-loading-msg">{message}</p>
      <div className="stage-loading-spinner" aria-label="로딩 중" />
    </div>
  )
}
