import BossModel3D from '../Boss/BossModel3D'
import PlayerModel3D from '../Boss/PlayerModel3D'
import endbossBg from '../../assets/endbossbg.png'
import { useState, useEffect, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import ErrorFindLines from '../../components/QuizCard/ErrorFindLines'
import '../../components/QuizCard/QuizCard.css'

// question 필드에서 텍스트 / 코드블록 분리
function parseQuestionText(raw) {
  const match = raw.match(/^([\s\S]*?)```(?:\w+)?\n([\s\S]*?)```([\s\S]*)$/)
  if (!match) return { text: raw.trim(), code: null, after: '' }
  return { text: match[1].trim(), code: match[2].trimEnd(), after: match[3].trim() }
}

const TYPE_BADGE = {
  output_select:   { label: '💻 출력 선택',   bg: '#E0F2FE', color: '#0369A1' },
  multiple_choice: { label: '📋 객관식',       bg: '#EEEDFE', color: '#534AB7' },
  error_find:      { label: '🐛 오류 찾기',    bg: '#FFF5F5', color: '#DC2626' },
  fill_in_blank:   { label: '✏️ 빈칸 채우기', bg: '#F0FFF4', color: '#166534' },
  code_input:      { label: '⌨️ 코드 작성',   bg: '#F0EFFE', color: '#6D28D9' },
}

export default function EndBossBattle({
  bossData,
  currentQuestion,
  bossHp,
  myHp,
  phase,
  phase3Tries,
  selectedOption,
  setSelectedOption,
  answerInput,
  setAnswerInput,
  aiResult,
  loading,
  bossShake,
  myShake,
  bossHit,
  attackAnim,
  dmgPopup,
  user,
  onSubmit,
  onNextQuestion,
  onEscape,
  questionNum,
  questionTotal,
}) {
  const BOSS_HP_MAX = 1800
  const MY_HP_MAX   = 1200

  const bossPct = Math.max(0, (bossHp / BOSS_HP_MAX) * 100)
  const myHpPct = Math.max(0, (myHp  / MY_HP_MAX)   * 100)


  const parsed = parseQuestionText(currentQuestion.question)
  const badge  = TYPE_BADGE[currentQuestion.type] ?? TYPE_BADGE.multiple_choice

  const isCodeType = currentQuestion.type === 'code_input' || currentQuestion.type === 'fill_in_blank'
  const hasChoice  = !isCodeType && currentQuestion.choices?.length > 0

  // error_find: 줄 클릭 UI
  const choicesList = currentQuestion.choices || []
  const codeLines   = parsed.code ? parsed.code.split('\n') : []
  const isLineSelectErrorFind =
    currentQuestion.type === 'error_find' &&
    codeLines.length > 0 &&
    /^\d+줄:/.test(codeLines[0])
  const selectedChoiceFull = selectedOption
    ? choicesList.find(c => c.startsWith(selectedOption + '.')) ?? null
    : null

  // 보스 HP 색상
  const bossHpGrad = bossPct > 50
    ? 'linear-gradient(90deg,#FF6B6B,#FF4444)'
    : bossPct > 25
      ? 'linear-gradient(90deg,#FF9E2C,#FF6B6B)'
      : 'linear-gradient(90deg,#FF4444,#CC0000)'

  return (
    <div className="eb-b-wrap">

      {/* ── 전투 배경 ── */}
      <div className="eb-b-bg" style={{ backgroundImage: `url(${endbossBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="eb-b-ground-top" />
        <div className="eb-b-ground-bot" />
        <div className="eb-b-hp-sub">Phase {phase} 진행 중</div>

        {/* 플레이어 HP 박스 — 상단 왼쪽 */}
        <div className={`eb-b-player-hpbox${myShake ? ' shake' : ''}`} style={{ top: '8px', bottom: 'auto', left: '8px' }}>
          {phase === 3 ? (
            <div className="eb-b-hearts">
              {[0, 1, 2].map(i => (
                <span key={i} className="eb-b-heart">
                  {i < phase3Tries ? '🖤' : '❤️'}
                </span>
              ))}
            </div>
          ) : (
            <>
              <div className="eb-b-hp-bar-wrap">
                <span className="eb-b-hp-label">HP</span>
                <div className="eb-b-hp-track">
                  <div className="eb-b-hp-fill player" style={{ width: `${myHpPct}%` }} />
                </div>
              </div>
              <div className="eb-b-hp-nums">{myHp} / {MY_HP_MAX}</div>
            </>
          )}
        </div>

        {/* 보스 HP 박스 — 상단 오른쪽 */}
        <div className="eb-b-boss-hpbox" style={{ top: '8px', right: '8px' }}>
          <div className="eb-b-hp-bar-wrap">
            <span className="eb-b-hp-label">HP</span>
            <div className="eb-b-hp-track">
              <div className="eb-b-hp-fill" style={{ width: `${bossPct}%`, background: bossHpGrad }} />
            </div>
          </div>
          <div className="eb-b-hp-nums">{bossHp} / {BOSS_HP_MAX}</div>
        </div>

        {/* 플레이어 3D — 하단 왼쪽 */}
        <div className={`eb-b-player-canvas${myShake ? ' hit-red' : ''}`} style={{ bottom: '-40px', top: 'auto', left: '0px', width: '170px', height: '170px' }}>
          <Canvas camera={{ position: [0, 0, 3], fov: 40 }} style={{ background: 'transparent' }} gl={{ alpha: true }}>
            <ambientLight intensity={2.5} />
            <directionalLight position={[2, 4, 2]} intensity={2.0} />
            <Suspense fallback={null}>
              <PlayerModel3D myShake={myShake} attackAnim={attackAnim} character={user?.character} position={[0, -0.5, 0]} rotation={[0, Math.PI * 0.15, 0]} />
            </Suspense>
          </Canvas>
        </div>

        {/* 보스 3D — 하단 오른쪽 */}
        <div className={`eb-b-boss-canvas${bossHit ? ' hit-red' : ''}`} style={{ bottom: '15px', top: 'auto', right: '0px', width: '200px', height: '200px' }}>
          <Canvas camera={{ position: [0, 0, 3], fov: 50 }} style={{ background: 'transparent' }} gl={{ alpha: true }}>
            <ambientLight intensity={3.5} />
            <directionalLight position={[6, 4, 6]} intensity={1.5} />
            <Suspense fallback={null}>
              <BossModel3D bossHit={bossHit} bossShake={bossShake} modelPath="/models/boss_endboss.glb" scale={1} position={[4, -0.1, 0]} />
            </Suspense>
          </Canvas>
        </div>
        
        {/* 데미지 팝업 */}
        {dmgPopup && <div className="eb-b-dmg-popup">-{dmgPopup}</div>}
      </div>

      
        {/* ── 퀴즈 패널 ── */}
      <div className={`eb-b-quiz-wrap quiz-attack-wrap${attackAnim ? ' attack-fly' : ''}`}>

        {/* 유형 뱃지 + 문제 번호 */}
        <div className="eb-b-topbar">
          <span
            className="eb-b-badge"
            style={{ background: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
          {questionNum && questionTotal && (
            <span className="eb-b-qnum">문제 {questionNum}/{questionTotal}</span>
          )}
          <button
            className="eb-b-escape-btn"
            onClick={onEscape}
          >
            🏃 도망가기
          </button>
        </div>

        {/* 문제 카드 */}
        <div className="eb-b-qcard">
          {parsed.text && <div className="eb-b-qtext">{parsed.text}</div>}
          {/* error_find: 줄 클릭 UI (코드블록 포함) */}
          {isLineSelectErrorFind ? (
            <ErrorFindLines
              codeLines={codeLines}
              choicesList={choicesList}
              selected={selectedChoiceFull}
              revealed={!!aiResult}
              answer={aiResult?.correct_answer ?? currentQuestion.answer}
              onSelect={(opt) => setSelectedOption(opt.substring(0, 1))}
              onSubmit={onSubmit}
            />
          ) : (
            <>
              {parsed.code && (
                <div className="eb-b-terminal">
                  <pre className="eb-b-code">{parsed.code}</pre>
                </div>
              )}
              {parsed.after && (
                <div className="eb-b-qtext" style={{ marginTop: '6px' }}>{parsed.after}</div>
              )}

              {/* 객관식 / 출력선택 */}
              {hasChoice && (
                <div className="eb-b-radio-opts">
                  {currentQuestion.choices.map((opt, idx) => {
                    const key = opt.substring(0, 1)
                    return (
                      <div
                        key={idx}
                        className={`eb-b-ropt${selectedOption === key ? ' sel' : ''}`}
                        onClick={() => setSelectedOption(key)}
                      >
                        <div className="eb-b-rcircle">{key}</div>
                        <span className="eb-b-rtext">{opt.substring(3)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* 빈칸 채우기 */}
          {currentQuestion.type === 'fill_in_blank' && (
            <div className="eb-b-fib-row">
              <span className="eb-b-fib-lbl">답</span>
              <input
                className="eb-b-fib-in"
                type="text"
                value={answerInput}
                onChange={e => setAnswerInput(e.target.value)}
                placeholder="정답 입력..."
                onKeyDown={e => { if (e.key === 'Enter' && answerInput.trim()) onSubmit() }}
              />
            </div>
          )}

          {/* 코드 작성 */}
          {currentQuestion.type === 'code_input' && (
            <div className="eb-b-editor">
              <div className="eb-b-edlbl"># 코드를 작성하세요</div>
              <textarea
                className="eb-b-edta"
                rows={5}
                value={answerInput}
                onChange={e => setAnswerInput(e.target.value)}
                placeholder="여기에 코드 작성..."
              />
            </div>
          )}
        </div>

        {/* 공격 버튼 (error_find 줄 클릭 UI는 자체 버튼 사용) */}
        {!isLineSelectErrorFind && (
          <button
            className="eb-b-atk-btn"
            onClick={onSubmit}
            disabled={(!selectedOption && !answerInput.trim()) || loading}
          >
            {loading ? '채점 중...' : '🚀 공격하기'}
          </button>
        )}
      </div>

      {/* ── 결과 오버레이 ── */}
      {aiResult && (
        <div className="eb-b-result-overlay">
          <div className="eb-b-result-card">
            <div className="eb-b-res-icon">
              {aiResult.is_correct ? '✅' : '❌'}
            </div>
            <div className="eb-b-res-title">
              {aiResult.is_correct ? '정답! 공격 성공!' : '오답... 반격당했다!'}
            </div>
            {aiResult.feedback && (
              <div className="eb-b-res-desc">{aiResult.feedback}</div>
            )}
            <div className="eb-b-res-hp-row">
              <span>{aiResult.is_correct ? '⚡ 보스 HP 잔량' : '💢 내 HP 잔량'}</span>
              <span
                className="eb-b-res-hp-val"
                style={{ color: aiResult.is_correct ? '#534AB7' : '#DC2626' }}
              >
                {aiResult.is_correct ? `${bossHp} HP` : `${myHp} HP`}
              </span>
            </div>

            {aiResult.is_clear && (
              <div className="eb-b-res-clear">🏆 클리어! 잠시 후 이동합니다...</div>
            )}
            {aiResult.is_fail && (
              <button
                className="eb-b-next-btn"
                style={{ background: '#DC2626' }}
                onClick={onNextQuestion}
              >
                결과 보기 →
              </button>
            )}
            {!aiResult.is_clear && !aiResult.is_fail && (
              <button className="eb-b-next-btn" onClick={onNextQuestion}>
                다음 문제 →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
