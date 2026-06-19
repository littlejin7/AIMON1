import React from 'react';
import './Popup.css';
import { AP_IMGS, BOSS_UNIT, BOSS_FINAL } from '../../assetPaths';

/**
 * 타이틀 화면 팝업
 */
export function PopupTitle({ visible, onStart }) {
  if (!visible) return null;
  return (
    <div className="popup" id="popup-title">
      <div className="popup-card">
        <div className="popup-title-text">AI팡!</div>
        <div className="popup-boss-row">
          <img src={BOSS_UNIT}  alt="Unit Boss"  />
          <img src={BOSS_FINAL} alt="Final Boss" />
        </div>
        <div className="popup-sub">블록을 매치해서 보스를 공격하세요!</div>
        <div className="char-row">
          {[1, 2, 3, 4].map(i => (
            <img key={i} src={AP_IMGS[i]} alt={`char-${i}`} />
          ))}
        </div>
        <button className="btn" onClick={onStart}>게임 시작!</button>
      </div>
    </div>
  );
}

/**
 * 스테이지 클리어 팝업
 */
export function PopupClear({ visible, onNext }) {
  if (!visible) return null;
  return (
    <div className="popup" id="popup-clear">
      <div className="popup-card">
        <div className="popup-title-text">클리어!</div>
        <div className="popup-boss-row">
          <img src={BOSS_UNIT} alt="Unit Boss" />
        </div>
        <div className="popup-sub">보스를 물리쳤다!</div>
        <button className="btn" onClick={onNext}>다음 스테이지 →</button>
      </div>
    </div>
  );
}

/**
 * 게임 오버 팝업
 */
export function PopupOver({ visible, onRetry, onHome }) {
  if (!visible) return null;
  return (
    <div className="popup" id="popup-over">
      <div className="popup-card">
        <div className="popup-title-text" style={{ color: '#ff88aa' }}>GAME OVER</div>
        <div className="popup-sub">이동 횟수가 부족해요!</div>
        <div className="char-row">
          {[1, 2, 3, 4].map(i => (
            <img key={i} src={AP_IMGS[i]} alt={`char-${i}`} />
          ))}
        </div>
        <div className="popup-btn-row">
          <button className="btn btn-red" onClick={onRetry}>다시 도전!</button>
          <button className="btn btn-gray" onClick={onHome}>홈으로</button>
        </div>
      </div>
    </div>
  );
}

/**
 * 최종 클리어 팝업
 */
export function PopupFinal({ visible, onRestart, onHome }) {
  if (!visible) return null;
  return (
    <div className="popup" id="popup-final">
      <div className="popup-card">
        <div className="popup-title-text" style={{ fontSize: '1.4rem' }}>최종 클리어!</div>
        <div className="popup-boss-row">
          <img src={BOSS_UNIT}  alt="Unit Boss"  />
          <img src={BOSS_FINAL} alt="Final Boss" />
        </div>
        <div className="popup-sub">모든 보스를 물리쳤다!</div>
        <div className="popup-btn-row">
          <button className="btn" onClick={onRestart}>처음부터</button>
          <button className="btn btn-gray" onClick={onHome}>홈으로</button>
        </div>
      </div>
    </div>
  );
}
