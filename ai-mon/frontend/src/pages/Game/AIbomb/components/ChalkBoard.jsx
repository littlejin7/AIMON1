// ═══════════════════════════════════════════════════════════════
//  ChalkBoard.jsx — 칠판 코드 토큰 (잘못된 코드를 터치)
// ═══════════════════════════════════════════════════════════════

import React from 'react';

export default function ChalkBoard({ question, solved, onTapToken }) {
  return (
    <div className="bd-code-panel">
      <div className="bd-panel-body">
        <code className="bd-code-tap">
          {question.tokens.map((tok, i) => {
            const display = solved && tok.error ? tok.fix : tok.t;
            const isClickable = tok.type === 'kw';

            if (!isClickable) {
              // kw가 아닌 토큰(문자열·숫자·구두점 등)은 터치 대상이 아니므로 클릭 불가능한 일반 텍스트로만 표시
              return (
                <span
                  key={`${question.id}-${i}`}
                  className={['bd-token', `bd-token--${tok.type}`, 'no-3d', 'bd-token--static'].join(' ')}
                >
                  {display}
                </span>
              );
            }

            return (
              <button
                key={`${question.id}-${i}`}
                type="button"
                disabled={solved}
                className={[
                  'bd-token',
                  `bd-token--${tok.type}`,
                  solved && tok.error ? 'bd-token--target' : '',
                  solved && tok.error ? 'bd-token--fixed' : '',
                ].join(' ')}
                onClick={() => onTapToken(i)}
              >
                {display}
              </button>
            );
          })}
        </code>
      </div>
      {question.hint && (
        <div className="bd-hint">
          <span className="bd-hint-icon">💡</span>{question.hint}
        </div>
      )}
    </div>
  );
}
