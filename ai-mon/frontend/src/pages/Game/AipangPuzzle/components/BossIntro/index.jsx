import React from 'react';
import './BossIntro.css';
import { BOSS_FINAL } from '../../assetPaths';

/**
 * 파이널 보스 등장 인트로 오버레이
 */
export default function BossIntro({ visible, onOk }) {
  if (!visible) return null;

  return (
    <div id="boss-intro">
      <img src={BOSS_FINAL} alt="Final Boss" />
      <div className="boss-intro-name">FINAL BOSS</div>
      <div className="boss-intro-sub">강력한 적이 나타났다!</div>
      <button className="btn" onClick={onOk}>전투 시작!</button>
    </div>
  );
}
