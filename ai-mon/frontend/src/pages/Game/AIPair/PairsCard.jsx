import './AIPair.css'

const BADGE_CLASS = { concept: 'badge-concept', code: 'badge-code', def: 'badge-def', analogy: 'badge-analogy' }
const BADGE_LABEL = { concept: '개념', code: '코드', def: '정의', analogy: '비유' }

export default function PairsCard({ data, charSrc, flipped, matched, wrong, onClick }) {
  const isCode = data.type === 'code'

  let cardClass = 'mp-card'
  if (flipped || matched) cardClass += ' flipped'
  if (matched)            cardClass += ' matched'
  if (wrong)              cardClass += ' wrong'

  return (
    <div className={cardClass} onClick={onClick}>
      <div className="mp-card-inner">

        {/* 뒷면 */}
        <div className="mp-card-face mp-card-back">
          <span className="mp-spark mp-spark-tl">✦</span>
          <span className="mp-spark mp-spark-tr">✦</span>
          <span className="mp-spark mp-spark-bl">✦</span>
          <span className="mp-spark mp-spark-br">✦</span>
          <img className="mp-card-back-img" src={charSrc} alt="" />
        </div>

        {/* 앞면 */}
        <div className="mp-card-face mp-card-front">
          <span className={`mp-card-badge ${BADGE_CLASS[data.type]}`}>
            {BADGE_LABEL[data.type]}
          </span>
          <div className="mp-card-content">
            <span className={`mp-card-text${isCode ? ' is-code' : ''}`}>
              {data.text}
            </span>
          </div>
          <img className="mp-card-mini" src={charSrc} alt="" />
        </div>

      </div>
    </div>
  )
}
