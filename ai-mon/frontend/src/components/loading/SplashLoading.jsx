// SplashLoading.jsx
// 앱 첫 진입 스플래시 (행진+합체)
//
// 사용법 (App.jsx):
//   const [ready, setReady] = useState(false)
//   useEffect(() => { setTimeout(() => setReady(true), 2000) }, [])
//   if (!ready) return <SplashLoading />

import './SplashLoading.css'
import characterA from '../../assets/character_a.png'
import characterB from '../../assets/character_b.png'
import characterC from '../../assets/character_c.png'
import characterMerged from '../../assets/character_merged.png'

export default function SplashLoading() {
  return (
    <div className="splash-overlay">
      <div className="splash-track">

        <div className="blob blob-a">
          <img src={characterA} alt="" />
        </div>
        <div className="blob blob-b">
          <img src={characterB} alt="" />
        </div>
        <div className="blob blob-c">
          <img src={characterC} alt="" />
        </div>

        {/* 합체 에이몬 */}
        <div className="blob-merged">
          <img src={characterMerged} alt="" />
        </div>
      </div>

      <div className="splash-progress-track">
        <div className="splash-progress-fill" />
      </div>

      <p className="splash-loading-text">에이몬 준비 중...</p>
    </div>
  )
}
