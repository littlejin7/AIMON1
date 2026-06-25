import React from 'react';
import './Cell.css';
import { AP_IMGS } from '../../assetPaths';

/**
 * 퍼즐 보드의 개별 셀 컴포넌트
 * @param {number}  r          - 행 인덱스
 * @param {number}  c          - 열 인덱스
 * @param {number}  type       - 블록 타입 (1~6, 0이면 빈 셀)
 * @param {boolean} isSelected - 선택 여부
 * @param {string}  anim       - 현재 애니메이션 클래스 ('pop'|'drop'|'shake'|undefined)
 * @param {Function} onClick   - 클릭 핸들러
 */
export default function Cell({ r, c, type, isSelected, anim, onClick }) {
  const classNames = [
    'cell',
    isSelected ? 'selected' : '',
    anim || '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      data-r={r}
      data-c={c}
      onClick={onClick}
    >
      {type ? (
        <img
          src={AP_IMGS[type]}
          alt={`block-${type}`}
        />
      ) : null}
    </div>
  );
}
