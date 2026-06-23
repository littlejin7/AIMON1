// ═══════════════════════════════════════════════════════════════
//  sprites.jsx — 인라인 SVG 컴포넌트들
// ═══════════════════════════════════════════════════════════════

import React from 'react';

/** 폭탄 — 깜박이는 퓨즈, 디지털 타이머 디스플레이 */
export function BombSprite({ timeLeft, danger }) {
  return (
    <svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" className="bd-sprite">
      <defs>
        <radialGradient id="bombGrad" cx="38%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="#5a5a6e" />
          <stop offset="40%"  stopColor="#1e1e2e" />
          <stop offset="100%" stopColor="#0a0a14" />
        </radialGradient>
        <linearGradient id="bandGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#555" />
          <stop offset="50%"  stopColor="#999" />
          <stop offset="100%" stopColor="#444" />
        </linearGradient>
        <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="screenGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {danger && (
        <circle cx="100" cy="130" r="75"
          fill="none" stroke="#ff2020" strokeWidth="3" opacity="0.6"
          className="bd-glow-ring"
        />
      )}

      <path
        d="M100 58 C95 45, 110 35, 105 22 C102 14, 115 8, 118 18"
        fill="none" stroke="#8B6914" strokeWidth="3.5" strokeLinecap="round"
      />
      <g className="bd-fuse-spark">
        <ellipse cx="119" cy="16" rx="5" ry="7" fill="#FFD700" opacity="0.95"/>
        <ellipse cx="117" cy="13" rx="3" ry="5" fill="#FFA500" opacity="0.8"/>
        <ellipse cx="121" cy="14" rx="2.5" ry="4" fill="#FF6600" opacity="0.7"/>
        <circle  cx="119" cy="11" r="2" fill="#fff" opacity="0.9"/>
      </g>

      {[[58,100],[142,100],[100,165],[100,95]].map(([x,y],i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5" fill="#333" stroke="#555" strokeWidth="1"/>
          <line x1={x-3} y1={y} x2={x+3} y2={y} stroke="#666" strokeWidth="1.2"/>
          <line x1={x} y1={y-3} x2={x} y2={y+3} stroke="#666" strokeWidth="1.2"/>
        </g>
      ))}

      <ellipse cx="103" cy="200" rx="58" ry="12" fill="#000" opacity="0.35"/>

      <circle
        cx="100" cy="130" r="72"
        fill="url(#bombGrad)"
        filter={danger ? 'url(#glowRed)' : undefined}
        stroke={danger ? '#ff3030' : '#2a2a40'}
        strokeWidth={danger ? '2.5' : '1.5'}
      />

      <ellipse cx="78" cy="105" rx="22" ry="14"
        fill="white" opacity="0.09" transform="rotate(-30 78 105)"
      />
      <ellipse cx="72" cy="100" rx="10" ry="6"
        fill="white" opacity="0.13" transform="rotate(-30 72 100)"
      />

      <path
        d="M 30 130 A 70 70 0 0 1 170 130"
        fill="none" stroke="url(#bandGrad)" strokeWidth="6" opacity="0.5"
      />

      <rect x="65" y="115" width="70" height="30" rx="5"
        fill="#0a1a0a" stroke="#1a3a1a" strokeWidth="1.5"
      />
      <rect x="67" y="117" width="66" height="26" rx="4"
        fill="#001800" opacity="0.8"
      />
      <text
        x="100" y="136"
        textAnchor="middle"
        fontFamily="'Courier New', monospace"
        fontSize="16"
        fontWeight="bold"
        fill={danger ? '#ff3030' : '#00ff44'}
        filter="url(#screenGlow)"
        className={danger ? 'bd-timer-digit-svg' : ''}
      >
        {String(timeLeft).padStart(2, '0')}
      </text>
      <rect x="67" y="117" width="66" height="10" rx="4"
        fill="white" opacity="0.04"
      />

      <polygon points="100,152 93,164 107,164"
        fill={danger ? '#ff3030' : '#cc8800'}
        opacity={danger ? '0.9' : '0.6'}
      />
      <text x="100" y="163" textAnchor="middle"
        fontSize="7" fontWeight="bold" fill="#000"
      >!</text>
    </svg>
  );
}

/** 폭발 이펙트 */
export function ExplosionSprite() {
  return (
    <svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg" className="bd-sprite bd-sprite--explode">
      <defs>
        <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#ffffff"/>
          <stop offset="20%"  stopColor="#fffde0"/>
          <stop offset="50%"  stopColor="#ffdd00"/>
          <stop offset="80%"  stopColor="#ff6600"/>
          <stop offset="100%" stopColor="#cc1100"/>
        </radialGradient>
        <radialGradient id="outerGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#ff8800" stopOpacity="0.9"/>
          <stop offset="70%" stopColor="#cc2200" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#330000" stopOpacity="0"/>
        </radialGradient>
        <filter id="blurBig">
          <feGaussianBlur stdDeviation="4"/>
        </filter>
      </defs>

      <circle cx="140" cy="140" r="128" fill="url(#outerGrad)" filter="url(#blurBig)"/>

      {[0,30,60,90,120,150,180,210,240,270,300,330].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const len = i % 2 === 0 ? 110 : 80;
        const w   = i % 2 === 0 ? 18 : 12;
        return (
          <ellipse
            key={angle}
            cx={140 + (len/2) * Math.cos(rad)}
            cy={140 + (len/2) * Math.sin(rad)}
            rx={len / 2}
            ry={w / 2}
            fill={i % 2 === 0 ? '#ff6600' : '#ff9900'}
            opacity={i % 2 === 0 ? 0.85 : 0.7}
            transform={`rotate(${angle}, ${140 + (len/2)*Math.cos(rad)}, ${140 + (len/2)*Math.sin(rad)})`}
          />
        );
      })}

      <circle cx="140" cy="140" r="72" fill="#ff6600" opacity="0.85"/>
      <circle cx="140" cy="140" r="55" fill="#ff9900" opacity="0.9"/>
      <circle cx="140" cy="140" r="38" fill="url(#coreGrad)"/>
      <circle cx="140" cy="140" r="18" fill="white" opacity="0.95"/>

      {[[60,60],[220,70],[50,210],[230,200],[140,30],[30,130],[250,140]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={3+i%3} fill="#ffdd00" opacity="0.8"/>
      ))}
      {[[100,50],[155,45],[80,65],[165,60]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={10+i*3} fill="#333" opacity={0.15+i*0.03}/>
      ))}
    </svg>
  );
}

/** 해제 성공 */
export function DefusedSprite() {
  return (
    <svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" className="bd-sprite bd-sprite--defused">
      <defs>
        <radialGradient id="bombGrad2" cx="38%" cy="30%" r="65%">
          <stop offset="0%"  stopColor="#3a5a4e"/>
          <stop offset="40%" stopColor="#1a2e28"/>
          <stop offset="100%" stopColor="#080e0c"/>
        </radialGradient>
        <radialGradient id="shieldGrad" cx="50%" cy="35%" r="65%">
          <stop offset="0%"  stopColor="#44ff88"/>
          <stop offset="60%" stopColor="#00cc44"/>
          <stop offset="100%" stopColor="#006622"/>
        </radialGradient>
        <filter id="greenGlow">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <ellipse cx="103" cy="200" rx="58" ry="12" fill="#000" opacity="0.25"/>

      <circle cx="100" cy="130" r="72"
        fill="url(#bombGrad2)"
        stroke="#00cc44" strokeWidth="2.5"
        filter="url(#greenGlow)"
      />
      <ellipse cx="78" cy="105" rx="22" ry="14"
        fill="white" opacity="0.07" transform="rotate(-30 78 105)"
      />

      <path d="M100 58 C95 45, 108 38, 103 28"
        fill="none" stroke="#8B6914" strokeWidth="3" strokeLinecap="round"
        strokeDasharray="4,3"
      />

      <path d="M100 90 L124 99 L124 124 Q124 142 100 152 Q76 142 76 124 L76 99 Z"
        fill="url(#shieldGrad)" opacity="0.92" filter="url(#greenGlow)"
      />
      <path d="M100 94 L120 102 L120 124 Q120 139 100 148 Q80 139 80 124 L80 102 Z"
        fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"
      />
      <polyline
        points="87,121 96,131 115,112"
        fill="none" stroke="white" strokeWidth="5"
        strokeLinecap="round" strokeLinejoin="round"
      />

      {[[55,85],[148,88],[60,158],[145,155],[100,75],[55,120],[148,122]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={2.5 + (i%3)}
          fill="#44ff88" opacity={0.6 + (i%3)*0.1}
          className="bd-particle"
          style={{ animationDelay: `${i*0.15}s` }}
        />
      ))}
    </svg>
  );
}

/** 스테이지 완료 뱃지 */
export function StageClearBadge({ stage }) {
  return (
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" width="90" height="90">
      <defs>
        <radialGradient id="badgeGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffd700"/>
          <stop offset="100%" stopColor="#b8860b"/>
        </radialGradient>
      </defs>
      <polygon points="60,10 74,45 112,45 82,67 93,102 60,80 27,102 38,67 8,45 46,45"
        fill="url(#badgeGrad)" stroke="#fff8" strokeWidth="1.5"
      />
      <text x="60" y="65" textAnchor="middle"
        fontSize="22" fontWeight="bold" fill="#3a2000"
        fontFamily="monospace"
      >{stage}</text>
    </svg>
  );
}
