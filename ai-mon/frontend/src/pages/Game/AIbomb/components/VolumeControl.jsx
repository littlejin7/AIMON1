// ═══════════════════════════════════════════════════════════════
//  components/VolumeControl.jsx — 볼륨 슬라이더 + 음소거 토글
// ═══════════════════════════════════════════════════════════════

import React from 'react';

export default function VolumeControl({ volume, onVolumeChange, onMuteToggle }) {
  return (
    <div className="bd-volume-wrap">
      <button
        className="bd-vol-icon"
        aria-label={volume === 0 ? '음소거 해제' : '음소거'}
        onClick={onMuteToggle}
      >
        {volume === 0 ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 5L6 9H2v6h4l5 4V5z"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        ) : volume < 50 ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 5L6 9H2v6h4l5 4V5z"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 5L6 9H2v6h4l5 4V5z"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        )}
      </button>
      <input
        type="range"
        className="bd-vol-slider"
        min="0" max="100" step="1"
        value={volume}
        onChange={onVolumeChange}
        aria-label="볼륨 조절"
        style={{ '--vol-pct': `${volume}%` }}
      />
      <span className="bd-vol-num">{volume}</span>
    </div>
  );
}
