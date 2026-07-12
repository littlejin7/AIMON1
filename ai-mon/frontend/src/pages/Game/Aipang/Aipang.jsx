import AipangPuzzle from '../AipangPuzzle/index'
import './Aipang.css'

/**
 * 타임킬링 페이지 — AI팡 퍼즐을 전체화면으로 래핑
 * NavBar / TopBar 없이 독립 실행 (App.jsx에서 AppLayout 미적용)
 */
export default function Aipang() {
  return (
    <div className="aipang-wrap">
      {/* AI팡 퍼즐 */}
      <AipangPuzzle />
    </div>
  )
}
