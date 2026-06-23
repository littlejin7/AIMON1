// ═══════════════════════════════════════════════════════════════
//  components/CodePanel.jsx — 코드 문제 패널 + 드롭존 + 힌트
// ═══════════════════════════════════════════════════════════════

import React from 'react';

export default function CodePanel({ question, slotWord, onDragOver, onDrop }) {
  return (
    <div className="bd-code-panel">
      <div className="bd-panel-body">
        <div className="bd-line-nums">
          <span>1</span><span>2</span><span>3</span>
        </div>
        <div className="bd-code-lines">
          <div className="bd-code-line bd-code-line--dim">
            <span className="bd-kw">import</span> sys
          </div>
          <div className="bd-code-line bd-code-line--active">
            <span className="bd-code-text">{question.before}</span>
            <span
              className={`bd-slot ${slotWord ? 'bd-slot--filled' : ''}`}
              onDragOver={onDragOver}
              onDrop={onDrop}
              title="여기에 드롭하세요"
            >
              {slotWord ?? <span className="bd-slot-placeholder">▓▓▓▓</span>}
            </span>
            <span className="bd-code-text">{question.after}</span>
          </div>
          <div className="bd-code-line bd-code-line--dim">
            &nbsp;&nbsp;&nbsp;&nbsp;<span className="bd-kw">print</span>(i)
          </div>
        </div>
      </div>
      <div className="bd-hint">
        <span className="bd-hint-icon">💡</span> {question.hint}
      </div>
    </div>
  );
}
