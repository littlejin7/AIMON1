import { useState } from 'react'
import endbossIcon from '../../assets/endboss_finalorg.png'

const PROJECTS_BY_LEVEL = {
  beginner: [
    { id: 'account',   label: '가계부 시스템', icon: '💰' },
    { id: 'wordchain', label: '끝말잇기 봇',   icon: '🗣️' },
    { id: 'grade',     label: '성적 관리기',   icon: '📊' },
    { id: 'gpa',       label: '학점 계산기',   icon: '🎓' },
  ],
  intermediate: [
    { id: 'todo',       label: 'TODO 매니저',        icon: '✅' },
    { id: 'contact',    label: '연락처 앱',           icon: '📇' },
    { id: 'log_parser', label: '로그 파서',           icon: '🔍' },
    { id: 'weather',    label: '날씨 API 클라이언트', icon: '☁️' },
  ],
  advanced: [
    { id: 'ai_agent',       label: 'AI 에이전트',          icon: '🤖' },
    { id: 'async_api',      label: '비동기 API 클라이언트', icon: '⚡' },
    { id: 'fastapi_server', label: 'FastAPI AI 서버',       icon: '🚀' },
    { id: 'langchain_bot',  label: 'LangChain RAG 봇',      icon: '🔗' },
  ],
}

export default function EndBossIntro({ bossData, errorMsg, onStart }) {
  const level = bossData?.course_level || 'beginner'
  const ENDBOSS_PROJECTS = PROJECTS_BY_LEVEL[level] ?? PROJECTS_BY_LEVEL.beginner
  const [selectedProject, setSelectedProject] = useState(ENDBOSS_PROJECTS[0].id)

  return (
    <div className="boss-card intro-card card-glass animate-fade-in-up">
      <div className="boss-avatar animate-float">
        <img src={endbossIcon} alt="엔드보스" />
      </div>

      <h1 className="boss-title">{bossData?.boss_name || '엔드보스'} 출현!</h1>
      <p className="boss-desc">
        최종 유닛의 모든 지식을 시험할 보스가 나타났습니다.<br />
        물리치면 특별한 인증카드와 <strong>15000 XP</strong>를 얻을 수 있습니다!
      </p>

      {errorMsg && (
        <div style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>
          {errorMsg}
        </div>
      )}

      <div style={{ margin: '16px 0', textAlign: 'left' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '8px', color: '#e2e8f0' }}>도전할 프로젝트를 선택하세요:</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {ENDBOSS_PROJECTS.map(proj => (
            <button
              key={proj.id}
              onClick={() => setSelectedProject(proj.id)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: selectedProject === proj.id ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.2)',
                background: selectedProject === proj.id ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255,255,255,0.05)',
                color: selectedProject === proj.id ? '#fff' : '#cbd5e1',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                fontWeight: selectedProject === proj.id ? 'bold' : 'normal'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{proj.icon}</span>
              {proj.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ margin: '8px 0 16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.9rem', color: '#a0a0b0', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>도전 비용:</span>
          <span style={{ color: '#34d399' }}>무료 (오늘 {bossData?.free_attempts_per_day || 3}회 남음)</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>도움말:</span>
          <span style={{ color: '#ef4444' }}>엔드보스 (힌트 사용 불가)</span>
        </div>
      </div>

      <button className="btn btn-primary btn-lg btn-full pulse-btn" onClick={() => onStart(selectedProject)}>
        전투 시작 ⚔️
      </button>
    </div>
  )
}
