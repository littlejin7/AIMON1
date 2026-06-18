import React from 'react';
import './CtrlBar.css';

/**
 * 하단 컨트롤 버튼 바 (BGM 토글 + 새로고침)
 */
export default function CtrlBar({ bgmMuted, onBgmToggle, onRefresh }) {
  return (
    <div id="ctrl-bar">
      <div
        className={`ctrl-btn${bgmMuted ? ' muted' : ''}`}
        id="btn-bgm"
        onClick={onBgmToggle}
        role="button"
        aria-label={bgmMuted ? '음악 켜기' : '음악 끄기'}
      >
        {bgmMuted ? '🔇' : '🎵'}
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
