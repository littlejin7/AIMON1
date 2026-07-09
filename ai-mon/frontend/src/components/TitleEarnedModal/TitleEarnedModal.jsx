import { useEffect } from 'react'
import './TitleEarnedModal.css'

const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const TITLE_DETAILS = {
  first_step:   { desc: '첫 스테이지 클리어' },
  streak_7:     { desc: '7일 연속 학습 달성' },
  boss_slayer:  { desc: '첫 보스 클리어' },
  ai_explorer:  { desc: 'AI 피드백 10회 확인' },
  unit_master:  { desc: '유닛 1개 100% 완료' },
  aimon_master: { desc: 'Lv.30 달성' },
  rookie_coder:  { desc: '초급 엔드보스 클리어' },
  ace_coder:     { desc: '중급 엔드보스 클리어' },
  ai_master:     { desc: '고급 엔드보스 클리어' },
}

export default function TitleEarnedModal({ titles = [], onClose }) {
  const hasTitles = titles && titles.length > 0

  useEffect(() => {
    if (!hasTitles) return
    // 팝업 열렸을 때 뒷배경 스크롤 막기
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [hasTitles])

  if (!hasTitles) return null

  return (
    <div className="title-modal-overlay animate-fade-in">
      <div className="title-modal-card card-glass animate-pop-in">
        <h2 className="title-modal-header" style={{ marginTop: '12px' }}>새로운 칭호 획득!</h2>
        <p className="title-modal-subheader">조건을 만족하여 새로운 칭호를 획득했습니다.</p>

        <div className="title-modal-list">
          {titles.map((title) => {
            const detail = TITLE_DETAILS[title.id] || { desc: '업적 달성' }
            return (
              <div key={title.id} className="title-modal-item">
                <div className="title-modal-icon-wrapper">
                  <ShieldIcon />
                </div>
                <div className="title-modal-info">
                  <div className="title-modal-name">{title.name}</div>
                  <div className="title-modal-desc">{detail.desc}</div>
                </div>
              </div>
            )
          })}
        </div>

        <p className="title-modal-hint">획득한 칭호는 프로필 페이지에서 변경할 수 있습니다.</p>

        <button className="btn btn-primary title-modal-btn" onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  )
}
