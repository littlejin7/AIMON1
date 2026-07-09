import { useEffect } from 'react'
import { LEGAL_DOCUMENTS } from '../../data/legalDocuments'
import './LegalModal.css'

// 이용약관 / 개인정보처리방침 본문을 보여주는 재사용 모달.
// docType: 'tos' | 'privacy' | null (null이면 렌더링하지 않음)
export default function LegalModal({ docType, onClose }) {
  useEffect(() => {
    if (!docType) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [docType])

  if (!docType) return null

  const doc = LEGAL_DOCUMENTS[docType]
  if (!doc) return null

  return (
    <div className="legal-modal-overlay" onClick={onClose}>
      <div className="legal-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="legal-modal-header">
          <h2 className="legal-modal-title">{doc.title}</h2>
          <button
            type="button"
            className="legal-modal-close no-3d"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="legal-modal-body">
          {doc.effectiveDate && (
            <p className="legal-modal-date">시행일자: {doc.effectiveDate}</p>
          )}
          {doc.intro && <p className="legal-modal-intro">{doc.intro}</p>}

          {doc.sections.map((section) => (
            <section key={section.heading} className="legal-section">
              <h3 className="legal-section-heading">{section.heading}</h3>
              <p className="legal-section-body">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="legal-modal-footer">
          <button
            type="button"
            className="legal-modal-confirm"
            onClick={onClose}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
