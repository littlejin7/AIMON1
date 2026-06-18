import { useNavigate } from 'react-router-dom'
import AipangPuzzle from '../AipangPuzzle/index'
import './Aipang.css'

/**
 * 타임킬링 페이지 — AI팡 퍼즐을 전체화면으로 래핑
 * NavBar / TopBar 없이 독립 실행 (App.jsx에서 AppLayout 미적용)
 */
export default function Aipang() {
  const navigate = useNavigate()

  return (
    <div className="aipang-wrap">
      {/* 뒤로가기 버튼 */}
      <button
        className="aipang-back"
        onClick={() => navigate('/game')}
        aria-label="미니게임 목록으로"
      >
        ← 목록
      </button>

      {/* AI팡 퍼즐 */}
      <AipangPuzzle />
    </div>
  )
}
