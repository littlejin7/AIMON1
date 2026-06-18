import './AIPair.css'
import { TOTAL_PAIRS } from './usePairsGame'

export default function PairsDash({ score, timeStr, matchedCount, onRestart }) {
  const progress = (matchedCount / TOTAL_PAIRS) * 100

  return (
    <>
      <div className="mp-dashboard">
        <div className="mp-dash-item">
          <div className="mp-dash-icon score-ico">🏆</div>
          <div className="mp-dash-info">
            <span className="mp-dash-label">Score</span>
            <span className="mp-dash-val">{score}</span>
          </div>
        </div>

        <div className="mp-dash-sep" />

        <div className="mp-dash-item">
          <div className="mp-dash-icon time-ico">🕐</div>
          <div className="mp-dash-info">
            <span className="mp-dash-label">Time</span>
            <span className="mp-dash-val time-color">{timeStr}</span>
          </div>
        </div>

        <div className="mp-dash-sep" />

        <button className="mp-btn-restart" onClick={onRestart}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
               strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 .49-4.5" />
          </svg>
          재시작
        </button>
      </div>

      <div className="mp-progress-wrap">
        <div className="mp-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </>
  )
}
