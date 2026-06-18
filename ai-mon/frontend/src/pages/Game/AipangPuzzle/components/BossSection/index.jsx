import React from 'react';
import BossCard from '../BossCard';
import './BossSection.css';
import { BOSS_UNIT, BOSS_FINAL } from '../../assetPaths';

/**
 * 상단 보스 섹션 (두 보스 카드 + 이동/스테이지 정보)
 */
export default function BossSection({
  unitBossName,
  unitHp,
  unitHpMax,
  finalHp,
  finalHpMax,
  bossUI,
  moves,
  stageDisplay,
}) {
  return (
    <div id="boss-section">
      <div className="boss-cards-row">
        {/* 유닛 보스 카드 */}
        <BossCard
          id="boss-unit-card"
          imgSrc={BOSS_UNIT}
          name={unitBossName}
          hpCur={unitHp}
          hpMax={unitHpMax}
          active={bossUI.unitActive}
          locked={bossUI.unitLocked ?? false}
          defeated={bossUI.unitDefeated}
          shaking={bossUI.unitShaking}
          isFinal={false}
        />

        {/* 파이널 보스 카드 */}
        <BossCard
          id="boss-final-card"
          imgSrc={BOSS_FINAL}
          name="FINAL BOSS"
          hpCur={bossUI.finalLocked ? null : finalHp}
          hpMax={finalHpMax}
          active={bossUI.finalActive}
          locked={bossUI.finalLocked}
          defeated={false}
          shaking={bossUI.finalShaking}
          isFinal={true}
        />
      </div>

      {/* 이동 횟수 / 스테이지 표시 */}
      <div className="boss-info-strip">
        <div className="info-chip">
          <span className="info-label">MOVES</span>
          <span className="info-value">{moves}</span>
        </div>
        <div className="info-chip">
          <span className="info-label">STAGE</span>
          <span className="info-value">{stageDisplay}</span>
        </div>
      </div>
    </div>
  );
}
