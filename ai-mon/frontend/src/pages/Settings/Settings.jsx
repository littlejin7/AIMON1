import SettingsProfile     from './SettingsProfile'
import SettingsTheme       from './SettingsTheme'
import SettingsCourseLevel from './SettingsCourseLevel'
import SettingsInfo        from './SettingsInfo'
import './Settings.css'

export default function Settings() {
  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">⚙️ 설정</h1>
      </div>

      <div className="container">
        <SettingsProfile />
        <SettingsTheme />
        <SettingsCourseLevel />
        <SettingsInfo />
      </div>
    </div>
  )
}
