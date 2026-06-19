import { useNavigate } from 'react-router-dom' 
import SettingsProfile     from './SettingsProfile'
import SettingsTheme       from './SettingsTheme'
import SettingsCourseLevel from './SettingsCourseLevel'
import SettingsSound       from './SettingsSound'
import SettingsInfo        from './SettingsInfo'
import './Settings.css'

export default function Settings() {
  const navigate = useNavigate()  // 추가

  return (
    <div className="settings-page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>  {/* 추가 */}
          <h1 className="page-title">⚙️ 설정</h1>
          <button  // 추가
            className="btn btn-ghost btn-sm"  // 추가
            onClick={() => navigate('/')}  // 추가
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}  // 추가
          >  {/* 추가 */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">  {/* 추가 */}
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>  {/* 추가 */}
              <polyline points="9 22 9 12 15 12 15 22"/>  {/* 추가 */}
            </svg>  {/* 추가 */}
            홈으로  {/* 추가 */}
          </button>  {/* 추가 */}
        </div>  {/* 추가 */}
      </div>
      <div className="container">
        <SettingsProfile />
        <SettingsTheme />
        <SettingsSound />  {/* 추가 */}
        <SettingsCourseLevel />
        <SettingsInfo />
      </div>
    </div>
  )
}
