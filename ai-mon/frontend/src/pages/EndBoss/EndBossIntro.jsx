import { useState } from 'react'
import endbossOrgImg from '../../assets/endboss_finalorg.png'

const LEVEL_LABELS = { beginner: '초급', intermediate: '중급', advanced: '고급' }
const LEVEL_ORDER_DESC = ['advanced', 'intermediate', 'beginner']
const STATUS_META = {
  cleared: { icon: '🏆', label: '정복 완료', desc: '인증카드를 보유한 레벨입니다.' },
  recognized: { icon: '✅', label: '진행 인정', desc: '배치보다 낮은 레벨이라 바로 도전할 수 있습니다.' },
  current: { icon: '🎯', label: '현재 목표', desc: '유닛 8 보스를 클리어하면 도전할 수 있습니다.' },
  locked: { icon: '🔒', label: '잠김', desc: '이전 레벨을 먼저 정복해야 합니다.' },
}

const PROJECTS_BY_LEVEL = {
  beginner: [
    { id: 'account',   label: '가계부 시스템',        icon: '💰', bg: '#FEF9EC' },
    { id: 'wordchain', label: '끝말잇기 봇',           icon: '🗣️', bg: '#F5F4FE' },
    { id: 'grade',     label: '성적 관리기',           icon: '📊', bg: '#FFF0F0' },
    { id: 'gpa',       label: '학점 계산기',           icon: '🎓', bg: '#F0F9FF' },
  ],
  intermediate: [
    { id: 'todo',       label: 'TODO 매니저',         icon: '✅', bg: '#F0FDF4' },
    { id: 'contact',    label: '연락처 앱',            icon: '📇', bg: '#FEF9EC' },
    { id: 'log_parser', label: '로그 파서',            icon: '🔍', bg: '#F5F4FE' },
    { id: 'weather',    label: '날씨 API 클라이언트',  icon: '☁️', bg: '#F0F9FF' },
  ],
  advanced: [
    { id: 'ai_agent',       label: 'AI 에이전트',           icon: '🤖', bg: '#F5F4FE' },
    { id: 'async_api',      label: '비동기 API 클라이언트',  icon: '⚡', bg: '#FEFCE8' },
    { id: 'fastapi_server', label: 'FastAPI AI 서버',        icon: '🚀', bg: '#FFF0F0' },
    { id: 'langchain_bot',  label: 'LangChain RAG 봇',       icon: '🔗', bg: '#F0F9FF' },
  ],
}

export default function EndBossIntro({ bossData, errorMsg, onStart, selectedLevel, onLevelChange }) {
  const level = selectedLevel || bossData?.course_level || 'beginner'
  const unlockedLevels = bossData?.unlocked_levels ?? ['beginner']
  const isUnlocked = bossData?.is_unlocked ?? false
  const levelInfos = (bossData?.levels?.length
    ? bossData.levels
    : unlockedLevels.map(lv => ({
        level: lv,
        status: lv === level ? 'current' : 'recognized',
        enterable: lv === level ? isUnlocked : true,
      }))
  ).slice().sort((a, b) => LEVEL_ORDER_DESC.indexOf(a.level) - LEVEL_ORDER_DESC.indexOf(b.level))
  const selectedLevelInfo = levelInfos.find(item => item.level === level)
  const canStart = selectedLevelInfo?.enterable === true
  const allCleared = levelInfos.length > 0 && levelInfos.every(item => item.status === 'cleared')
  const ENDBOSS_PROJECTS = PROJECTS_BY_LEVEL[level] ?? PROJECTS_BY_LEVEL.beginner
  const retryCost = bossData?.retry_cost ?? 3
  const crowns = bossData?.crowns ?? 0
  const [selectedProject, setSelectedProject] = useState(ENDBOSS_PROJECTS[0].id)

  // 레벨이 바뀌면 그 레벨의 첫 프로젝트로 선택 리셋.
  // (렌더 중 이전 값과 비교해 조정 — useEffect 의 set-state-in-effect 경고를 피한다.)
  const [prevLevel, setPrevLevel] = useState(level)
  if (level !== prevLevel) {
    setPrevLevel(level)
    setSelectedProject(ENDBOSS_PROJECTS[0].id)
  }

  return (
    <div className="eb-intro-card">

      {/* ── 보스 스테이지 ── */}
      <div className="eb-boss-stage">
        {/* 스파클 파티클 */}
        <div className="eb-sparkles">
          <div className="eb-sp" style={{ background: '#FAC775', top: '8px',  left: '60px',  animationDelay: '0s'   }} />
          <div className="eb-sp" style={{ background: '#C5C0FF', top: '20px', left: '30px',  animationDelay: '.4s'  }} />
          <div className="eb-sp" style={{ background: '#FAC775', top: '5px',  left: '130px', animationDelay: '.7s'  }} />
          <div className="eb-sp" style={{ background: '#FF9E9E', top: '24px', left: '160px', animationDelay: '1s'   }} />
          <div className="eb-sp" style={{ background: '#C5C0FF', top: '10px', left: '100px', animationDelay: '1.4s' }} />
          <div className="eb-sp" style={{ background: '#FAC775', top: '28px', left: '80px',  animationDelay: '1.8s' }} />
        </div>

        {/* 보스 이미지 */}
        <img
          className="eb-boss-float"
          src={endbossOrgImg}
          alt="엔드보스"
          style={{ width: '148px', height: '148px', objectFit: 'contain', marginTop: '8px',
                   filter: 'drop-shadow(0 4px 16px rgba(83,74,183,0.35))' }}
        />

        {/* 말풍선 */}
        <div className="eb-anger-bubble">
          <span>😤</span>
          <span>네가 감히 최종 도전자?!</span>
        </div>
      </div>

      {/* ── 본문 패널 ── */}
      <div className="eb-body-panel">

        {/* 타이틀 */}
        <div className="eb-title-row">
          <div className="eb-eyebrow">🔥 FINAL BOSS</div>
          <div className="eb-main-title">엔드보스 출현!</div>
          <div className="eb-main-desc">
            최종 유닛의 모든 지식을 시험할 보스가 나타났습니다.<br />
            물리치면 특별한 인증카드와 <strong>15,000 코인</strong>을 얻을 수 있습니다!
          </div>
        </div>

        <div className="eb-divider" />

        {/* 레벨 사다리 */}
        <div>
          <div className="eb-proj-label">도전 가능한 사다리:</div>
          <div className="eb-level-ladder">
            {levelInfos.map(({ level: lv, status, enterable }) => {
              const meta = STATUS_META[status] ?? STATUS_META.locked
              const currentLocked = status === 'current' && !enterable
              return (
                <button
                  key={lv}
                  type="button"
                  className={`eb-level-card ${status}${level === lv ? ' selected' : ''}`}
                  disabled={!enterable}
                  onClick={() => onLevelChange?.(lv)}
                >
                  <span className="eb-level-icon">{meta.icon}</span>
                  <span className="eb-level-copy">
                    <span className="eb-proj-name">{LEVEL_LABELS[lv] ?? lv}</span>
                    <span className="eb-proj-tag">{currentLocked ? '유닛 8 보스를 먼저 클리어하세요.' : meta.desc}</span>
                  </span>
                  <span className="eb-level-status">{meta.label}</span>
                </button>
              )
            })}
          </div>
          {allCleared ? (
            <div className="eb-clear-note">모든 엔드보스를 정복했습니다. 인증카드를 확인해 주세요.</div>
          ) : !canStart && (
            <div className="eb-error">
              도전 가능한 레벨을 선택해야 전투를 시작할 수 있습니다.
            </div>
          )}
        </div>

        <div className="eb-divider" />

        {/* 프로젝트 선택 */}
        <div>
          <div className="eb-proj-label">도전할 프로젝트를 선택하세요:</div>
          <div className="eb-proj-grid">
            {ENDBOSS_PROJECTS.map(proj => (
              <div
                key={proj.id}
                className={`eb-proj-card${selectedProject === proj.id ? ' selected' : ''}`}
                onClick={() => setSelectedProject(proj.id)}
              >
                <div className="eb-proj-icon" style={{ background: proj.bg }}>{proj.icon}</div>
                <div>
                  <div className="eb-proj-name">{proj.label}</div>
                  <div className="eb-proj-tag">Unit 1~8 종합</div>
                </div>
                <div className="eb-proj-check">
                  <svg width="10" height="8" viewBox="0 0 10 8">
                    <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="eb-divider" />

        {/* 도전 조건 */}
        <div className="eb-cond-row">
          <div className="eb-cond-item">
            <span>도전 비용</span>
            <span className={`eb-cond-val ${crowns >= retryCost ? 'free' : 'nohint'}`}>👑 왕관 {retryCost}개</span>
          </div>
          <div className="eb-cond-item">
            <span>도움말</span>
            <span className="eb-cond-val nohint">엔드보스 (힌트 사용 불가)</span>
          </div>
          <div className="eb-cond-item">
            <span>전투 구조</span>
            <span className="eb-cond-val purple">3페이즈 · 총 12문제</span>
          </div>
        </div>

        {errorMsg && <div className="eb-error">{errorMsg}</div>}

        {/* 시작 버튼 */}
        <button
          className="eb-start-btn"
          disabled={!canStart}
          onClick={() => canStart && onStart(selectedProject)}
        >
          전투 시작 ⚔️
        </button>
      </div>
    </div>
  )
}
