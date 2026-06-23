import React from 'react';
import Cell from '../Cell';
import './Board.css';

const COLS = 5;

/**
 * 퍼즐 게임 보드 컴포넌트
 * @param {number[][]} grid     - 2D 블록 타입 배열
 * @param {{r,c}|null} selected - 현재 선택된 셀 좌표
 * @param {Object} cellAnims    - 셀별 애니메이션 맵 { 'r,c': 'pop'|'drop'|'shake' }
 * @param {Function} onCellClick - 셀 클릭 핸들러
 */
export default function Board({ grid, selected, cellAnims, onCellClick }) {
  return (
    <div id="board-wrap">
      <div
        id="board"
        style={{ gridTemplateColumns: `repeat(${COLS}, 56px)` }}
      >
        {grid.map((row, r) =>
          row.map((type, c) => (
            <Cell
              key={`${r}-${c}`}
              r={r}
              c={c}
              type={type}
              isSelected={selected?.r === r && selected?.c === c}
              anim={cellAnims[`${r},${c}`]}
              onClick={() => onCellClick(r, c)}
            />
          ))
        )}
      </div>
    </div>
  );
}
