// ═══════════════════════════════════════════════════════════════
//  components/ChipsArea.jsx — 드래그/클릭 가능한 선택지 칩들
// ═══════════════════════════════════════════════════════════════

import React from 'react';

export default function ChipsArea({ chips, onDragStart, onChipClick }) {
  return (
    <div className="bd-chips-area">
      <div className="bd-chips-label">드래그하거나 클릭하세요</div>
      <div className="bd-chips">
        {chips.map(chip => (
          <div
            key={chip.id}
            className={`bd-chip ${chip.used ? 'bd-chip--used' : ''}`}
            draggable={!chip.used}
            onDragStart={e => onDragStart(e, chip)}
            onClick={() => onChipClick(chip.id)}
            role="button"
            aria-label={chip.word}
          >
            <svg className="bd-chip-icon" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" rx="2"
                stroke="currentColor" strokeWidth="1.2" opacity="0.4"
              />
              <circle cx="7" cy="7" r="2.5" fill="currentColor" opacity="0.3"/>
            </svg>
            <code>{chip.word}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
