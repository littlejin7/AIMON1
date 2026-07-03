// ═══════════════════════════════════════════════════════════════
//  sprites.jsx — 스프라이트 컴포넌트들
// ═══════════════════════════════════════════════════════════════

import React from 'react';

import sp1 from './assets/SP1.png';
import sp2 from './assets/SP2.png';
import sp3 from './assets/SP3.png';
import sp4 from './assets/SP4.png';
import sp5 from './assets/SP5.png';
import sp6 from './assets/SP6.png';
import sp7 from './assets/SP7.png';
import sp8 from './assets/SP8.png';

const RUN_FRAMES = [sp1, sp2, sp3, sp4, sp5, sp6, sp7, sp8];
const RUN_FRAME_MS = 120;

/** 캐릭터들이 폭탄을 들고 이리저리 뛰어다니는 스프라이트 */
export function RunningMonstersSprite({ danger = false }) {
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % RUN_FRAMES.length);
    }, RUN_FRAME_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`bd-runner-stage${danger ? ' bd-runner-stage--danger' : ''}`}>
      <img
        src={RUN_FRAMES[frame]}
        alt="캐릭터들이 폭탄을 들고 뛰는 모습"
        className="bd-runner-img"
        draggable={false}
      />
    </div>
  );
}

/** 8비트 픽셀 하트 (라이프/장식용) */
export function PixelHeart({ filled = true, size = 16 }) {
  // 8x7 픽셀 그리드의 하트 모양
  const map = [
    '01100110',
    '11111111',
    '11111111',
    '11111111',
    '01111110',
    '00111100',
    '00011000',
  ];
  const color = filled ? '#ff5d5d' : 'none';
  const stroke = filled ? '#c23b3b' : '#cfc4a8';
  const cells = [];
  map.forEach((row, y) => {
    [...row].forEach((v, x) => {
      if (v === '1') {
        cells.push(
          <rect key={`${x}-${y}`} x={x * 2} y={y * 2} width="2" height="2" fill={color} stroke={stroke} strokeWidth="0.4" />
        );
      }
    });
  });
  return (
    <svg width={size} height={size * 0.875} viewBox="0 0 16 14" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      {cells}
    </svg>
  );
}

/** 클리어 화면 체크 배지 */
export function ClearCheck({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="22" r="20" fill="#7f77dd" stroke="#534ab7" strokeWidth="2.5"/>
      <polyline points="13,23 19,29 31,15" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
