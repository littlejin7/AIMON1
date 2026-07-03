import React from 'react';
import './CtrlBar.css';

/**
 * 하단 컨트롤 버튼 바 (BGM 토글 + 새로고침)
 */
export default function CtrlBar({ bgmVolume, onBgmVolume, onToggleMute, onRefresh }) {
  return (
    <div id="ctrl-bar">
      <div id="volume-wrap">
        <span
          id="btn-mute"
          role="button"
          tabIndex={0}
          aria-label={bgmVolume === 0 ? '음소거 해제' : '음소거'}
          onClick={onToggleMute}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggleMute(); }}
          style={{ cursor: 'pointer' }}
        >
          {bgmVolume === 0 ? '🔇' : '🎵'}
        </span>
        <input
          type="range" min="0" max="1" step="0.05"
          value={bgmVolume}
          onChange={(e) => onBgmVolume(parseFloat(e.target.value))}
        />
      </div>
      <div
        className="ctrl-btn"
        id="btn-refresh"
        onClick={onRefresh}
        role="button"
        aria-label="스테이지 재시작"
      >
        ↺
      </div>
    </div>
  );
}
