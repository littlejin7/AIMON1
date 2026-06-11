// SplashLoading.jsx
// 앱 첫 진입 스플래시 (행진+합체)
//
// 사용법 (App.jsx):
//   const [ready, setReady] = useState(false)
//   useEffect(() => { setTimeout(() => setReady(true), 2000) }, [])
//   if (!ready) return <SplashLoading />

import './SplashLoading.css'

export default function SplashLoading() {
  return (
    <div className="splash-overlay">
      <div className="splash-track">

        {/* 이미지 경로만 교체하세요 */}
        <div className="blob blob-a">
          <img src="/src/assets/character_a.png" alt="" />
        </div>
        <div className="blob blob-b">
          <img src="/src/assets/character_b.png" alt="" />
        </div>
        <div className="blob blob-c">
          <img src="/src/assets/character_c.png" alt="" />
        </div>

        {/* 합체 에이몬 */}
        <div className="blob-merged">
          <img src="/src/assets/character_merged.png" alt="" />
        </div>
      </div>

      <div className="splash-progress-track">
        <div className="splash-progress-fill" />
      </div>

      <p className="splash-loading-text">에이몬 준비 중...</p>
    </div>
  )
}
