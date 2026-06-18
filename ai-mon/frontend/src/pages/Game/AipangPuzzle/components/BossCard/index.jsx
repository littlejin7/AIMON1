import React from 'react';
import './BossCard.css';

/**
 * 개별 보스 카드 컴포넌트
 * @param {string}  id        - DOM id (예: 'boss-unit-card')
 * @param {string}  imgSrc    - 보스 이미지 경로
 * @param {string}  name      - 보스 이름
 * @param {number|null} hpCur - 현재 HP (null이면 '??' 표시)
 * @param {number}  hpMax     - 최대 HP
 * @param {boolean} active    - 활성(현재 전투 중) 여부
 * @param {boolean} locked    - 잠김 여부
 * @param {boolean} defeated  - 패배 애니메이션 여부
 * @param {boolean} shaking   - 흔들기 애니메이션 여부
 * @param {boolean} isFinal   - 파이널 보스 여부 (HP 바 색상)
 */
export default function BossCard({
  id,
  imgSrc,
  name,
  hpCur,
  hpMax,
  active,
  locked,
  defeated,
  shaking,
  isFinal = false,
}) {
  // hpCur === null → 잠금 상태, 바를 100% (locked CSS로 회색 처리됨)
  const hpPercent = hpCur === null ? 100 : hpMax > 0 ? (hpCur / hpMax) * 100 : 100;

  const classNames = [
    'boss-card',
    active   ? 'active'   : '',
    locked   ? 'locked'   : '',
    defeated ? 'defeated' : '',
    shaking  ? 'shake'    : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames} id={id}>
      <img className="boss-img" src={imgSrc} alt={name} />
      <div className="boss-name">{name}</div>
      <div className="boss-hp-text">
        <span>{hpCur === null ? '??' : hpCur.toLocaleString()}</span>
      </div>
      <div className="boss-hp-bar">
        <div
          className={`boss-hp-fill${isFinal ? ' final' : ''}`}
          style={{ width: `${hpPercent}%` }}
        />
      </div>
    </div>
  );
}
