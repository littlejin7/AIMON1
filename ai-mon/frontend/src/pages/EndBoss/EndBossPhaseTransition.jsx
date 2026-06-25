import BossSmallSVG from './BossSmallSVG'

/**
 * 페이즈 전환 화면 컴포넌트
 * Phase 1/2: 규칙 설명 + HP 미리보기
 * Phase 3: 도전 기회 표시 + 특수 규칙
 */
export default function EndBossPhaseTransition({
  phaseNum,
  myHp,
  MY_HP_INIT,
  endbossState,
  onPhase1Start,
  onPhase2Start,
  onPhase3Start,
}) {
  const isP1  = phaseNum === 1
  const isP2  = phaseNum === 2
  const isP3  = phaseNum === 3
  const color = isP1 ? 'blue' : isP2 ? 'yellow' : 'red'

  const hpPct = Math.round((myHp / MY_HP_INIT) * 100)
  const hpGradient = hpPct > 50
    ? 'linear-gradient(90deg,#22C55E,#86EFAC)'
    : hpPct > 25
      ? 'linear-gradient(90deg,#EAB308,#FDE047)'
      : 'linear-gradient(90deg,#EF4444,#FCA5A5)'

  // Phase 3 특수 화면
  if (isP3) {
    const lives = endbossState.phase3Tries
    return (
      <div className="ep-card phase3">
        <div className="ep-badge-wrap">
          <div className="ep-phase-lbl red">PHASE</div>
          <div className="ep-big-num red">03</div>
          <div className="ep-phase-name red">결정타</div>
          <div className="ep-phase-desc red">
            HP 시스템 종료! 3번의 기회 안에<br />
            정답을 맞혀야 최종 클리어!
          </div>
        </div>

        <BossSmallSVG phaseStyle={3} />

        <div className="ep-lives">
          <div className="ep-lives-title">도전 기회</div>
          <div className="ep-lives-row">
            {[0, 1, 2].map(i => (
              <div key={i} className={`ep-life${i < lives ? ' used' : ''}`}>
                {i < lives ? '🖤' : '❤️'}
              </div>
            ))}
          </div>
          <div className="ep-lives-hint">오답 시 새 문제 · 3회 모두 실패 시 패배</div>
        </div>

        <div className="ep-rules red">
          <div className="ep-rule-title">⚠️ PHASE 3 규칙</div>
          <div className="ep-rule-row red"><span>•</span><span>HP 시스템 없음 — 정답 1회로 즉시 클리어</span></div>
          <div className="ep-rule-row red"><span>•</span><span>오답 시 새 문제 출제 (문제 풀 3개 준비됨)</span></div>
          <div className="ep-rule-row red"><span>•</span><span>3회 모두 오답 → 전체 패배 (Phase 1부터 재도전)</span></div>
        </div>

        <button className="ep-continue-btn red" onClick={onPhase3Start}>
          💥 최후의 일격!
        </button>
      </div>
    )
  }

  // Phase 1 / Phase 2 공통 화면
  const config = isP1 ? {
    num:    '01',
    name:   '분석전',
    desc:   ['전 유닛 범위의 코드 읽기 문제입니다.', '차분히 분석하고 공략하세요!'],
    rules:  [
      <span key="r1">출력 선택 · 객관식 · 빈칸채우기 혼합 출제</span>,
      <span key="r2">정답 시 보스 HP <strong style={{color:'#93C5FD'}}>-200</strong> · 오답 시 내 HP <strong style={{color:'#FF9E9E'}}>-400</strong></span>,
      <span key="r3">힌트 사용 불가</span>,
    ],
    hpLabel: '내 에이몬 HP',
    btnText: '⚡ Phase 1 시작!',
    onStart: onPhase1Start,
    dotColor: '#93C5FD',
  } : {
    num:    '02',
    name:   '역전',
    desc:   ['디버깅과 코드 완성 문제입니다.', '보스가 반격을 시작합니다!'],
    rules:  [
      <span key="r1">오류 찾기 · 코드 작성 위주 출제</span>,
      <span key="r2">정답 시 보스 HP <strong style={{color:'#FDE047'}}>-200</strong> · 오답 시 내 HP <strong style={{color:'#FF9E9E'}}>-400</strong></span>,
      <span key="r3">내 HP가 남아있으면 Phase 3 진입!</span>,
    ],
    hpLabel: '🟡 내 에이몬 HP',
    btnText: '⚡ Phase 2 시작!',
    onStart: onPhase2Start,
    dotColor: '#FDE047',
  }

  return (
    <div className={`ep-card phase${phaseNum}`}>
      <div className="ep-badge-wrap">
        <div className={`ep-phase-lbl ${color}`}>PHASE</div>
        <div className={`ep-big-num ${color}`}>{config.num}</div>
        <div className="ep-phase-name">{config.name}</div>
        <div className={`ep-phase-desc ${color}`}>
          {config.desc[0]}<br />{config.desc[1]}
        </div>
      </div>

      <BossSmallSVG phaseStyle={phaseNum} />

      <div className="ep-rules">
        {config.rules.map((rule, i) => (
          <div key={i} className="ep-rule-row">
            <div className="ep-rule-dot" style={{ background: config.dotColor }} />
            {rule}
          </div>
        ))}
      </div>

      <div className="ep-hp-preview">
        <span style={{ fontSize: '22px' }}>🧑</span>
        <div className="ep-hp-bar-wrap">
          <div className="ep-hp-labels">
            <span>{config.hpLabel}</span>
            <span>{myHp} / {MY_HP_INIT}</span>
          </div>
          <div className="ep-hp-track">
            <div className="ep-hp-fill" style={{ width: `${hpPct}%`, background: hpGradient }} />
          </div>
        </div>
      </div>

      <button className={`ep-continue-btn ${color}`} onClick={config.onStart}>
        {config.btnText}
      </button>
    </div>
  )
}
