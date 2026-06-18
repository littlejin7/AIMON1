// ═══════════════════════════════════════════════════════════════
//  components/TimerBar.jsx — 타이머 숫자 + 프로그레스 바
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import { INITIAL_TIME } from '../questions';

export default function TimerBar({ timeLeft }) {
  const timerState = timeLeft > 12 ? 'safe' : timeLeft > 7 ? 'warn' : 'danger';
  const progress   = (timeLeft / INITIAL_TIME) * 100;

  return (
    <div className="bd-timer-wrap">
      <div className={`bd-timer-display bd-timer--${timerState}`}>
        <span className="bd-time-num">{timeLeft}</span>
        <span className="bd-time-sec">초</span>
      </div>
      <div className="bd-timer-track">
        <div
          className={`bd-timer-fill bd-timer-fill--${timerState}`}
          style={{ width: `${progress}%` }}
        />
        {[25, 50, 75].map(p => (
          <div key={p} className="bd-timer-mark" style={{ left: `${p}%` }} />
        ))}
      </div>
    </div>
  );
}
