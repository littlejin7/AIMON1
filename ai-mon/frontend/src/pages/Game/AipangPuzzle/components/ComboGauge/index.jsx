import React from 'react';
import { FIREBALL } from '../../assetPaths';
import './ComboGauge.css';

/**
 * 콤보 에너지 게이지
 * @param {number} energy - 0~100
 */
export default function ComboGauge({ energy }) {
  const isFull    = energy >= 100;
  const isCharging = energy > 0;

  return (
    <div id="combo-gauge">
      {/* 파이어볼 구체 */}
      <div className={`gauge-orb ${isFull ? 'orb-full' : isCharging ? 'orb-charging' : ''}`}>
        <img
          src={FIREBALL}
          alt="fireball"
          className={`orb-img ${isFull ? 'orb-img-full' : ''}`}
          style={{ opacity: 0.3 + energy / 100 * 0.7 }}
        />
      </div>

      {/* 세로 에너지 바 */}
      <div className="gauge-track">
        <div
          className={`gauge-fill ${isFull ? 'gauge-fill-full' : ''}`}
          style={{ height: `${energy}%` }}
        />
      </div>
    </div>
  );
}
