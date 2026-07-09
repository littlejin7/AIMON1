import BossModel3D from '../Boss/BossModel3D'
import PlayerModel3D from '../Boss/PlayerModel3D'
import endbossBg from '../../assets/endbossbg.png'
import { useState, useEffect, Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { getChoicesForCodeInput } from '../Boss/bossBattleUtils'
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
  code_multi_input: { label: '⌨️ 코드 작성',   bg: '#F0EFFE', color: '#6D28D9' },
}

const LEVEL_LABELS = {
  beginner: '초급',
  intermediate: '중급',
  advanced: '고급',
}

const LABELS = ['A', 'B', 'C', 'D', 'E']

function stripChoiceLabel(opt) {
  return String(opt || '').replace(/^[A-E]\.\s*/, '')
}

function displayCorrectAnswer(answer, choices = []) {
  const answerText = String(answer || '')
  if (/^[A-E]$/.test(answerText)) {
    const matched = choices.find((opt) => String(opt).startsWith(`${answerText}.`))
    return matched ? stripChoiceLabel(matched) : answerText
  }
  return answerText
}

function shuffleChoices(choices) {
  const shuffled = [...choices]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export default function EndBossBattle({
  bossData,
  currentQuestion,
  bossHp,
  myHp,
  phase,
  selectedLevel,
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
  showPhaseIntro: shouldShowPhaseIntro = false,
  onPhaseIntroShown,
  questionNum,
  questionTotal,
}) {
  const BOSS_HP_MAX = 1800
  const MY_HP_MAX   = 1200

  const bossPct = Math.max(0, (bossHp / BOSS_HP_MAX) * 100)
  const myHpPct = Math.max(0, (myHp  / MY_HP_MAX)   * 100)
  const [showPhaseIntro, setShowPhaseIntro] = useState(() => shouldShowPhaseIntro)

  useEffect(() => {
    if (!shouldShowPhaseIntro) {
      setShowPhaseIntro(false)
      return undefined
    }

    setShowPhaseIntro(true)
    onPhaseIntroShown?.(phase)
    const timer = window.setTimeout(() => setShowPhaseIntro(false), 1300)
    return () => window.clearTimeout(timer)
  }, [phase, shouldShowPhaseIntro, onPhaseIntroShown])
  
  const parsed = parseQuestionText(currentQuestion.question)
  const badge  = TYPE_BADGE[currentQuestion.type] ?? TYPE_BADGE.multiple_choice

  const isCodeMultiInput = currentQuestion.type === 'code_multi_input'
  const isCodeType = currentQuestion.type === 'code_input'
  const isFibType  = currentQuestion.type === 'fill_in_blank'
  const hasChoice  = !isCodeType && !isFibType && !isCodeMultiInput && currentQuestion.choices?.length > 0

  const isSingleAnswer = useMemo(() => {
    if (!currentQuestion) return true
    if (Array.isArray(currentQuestion.answer)) return currentQuestion.answer.length === 1
    return true
  }, [currentQuestion?.answer])

  const parsedQuestion = useMemo(() => parseQuestionText(currentQuestion.question), [currentQuestion.question])

  // 단일 라인 입력 state (code_multi_input: slot 줄 전체를 1개 input으로 입력)
  const [singleLineValue, setSingleLineValue] = useState('')

  useEffect(() => {
    setSingleLineValue('')
  }, [currentQuestion?.question_id])

  useEffect(() => {
    if (isCodeMultiInput) {
      const template = currentQuestion.code_template || ''
      const lines = template.split('\n')
      const slotLineIdx = lines.findIndex(line => /\{slot\d+\}/.test(line))
      if (slotLineIdx >= 0) {
        const indentMatch = lines[slotLineIdx].match(/^(\s*)/)
        const indent = indentMatch ? indentMatch[1] : ''
        const newLines = [...lines]
        newLines[slotLineIdx] = indent + singleLineValue
        setAnswerInput(newLines.join('\n'))
      } else {
        setAnswerInput(singleLineValue)
      }
    }
  }, [singleLineValue, currentQuestion?.code_template, currentQuestion?.question_id, isCodeMultiInput, setAnswerInput])

  const parseLineForSlots = (line) => {
    const regex = /\{slot(\d+)\}/g
    const parts = []
    let lastIndex = 0
    let match
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: line.substring(lastIndex, match.index) })
      }
      parts.push({ type: 'slot', index: parseInt(match[1], 10) })
      lastIndex = regex.lastIndex
    }
    if (lastIndex < line.length) {
      parts.push({ type: 'text', content: line.substring(lastIndex) })
    }
    return parts
  }

  const multiInputChoices = useMemo(() => {
    if (!isCodeMultiInput || !currentQuestion) return []
    if (currentQuestion.choices && currentQuestion.choices.length > 0) {
      if (currentQuestion.choices.length === 1) {
        const withDistractors = getChoicesForCodeInput(currentQuestion.choices[0], currentQuestion.choices)
        return shuffleChoices(withDistractors)
      }
      return shuffleChoices(currentQuestion.choices)
    }
    return []
  }, [currentQuestion?.question_id, currentQuestion?.choices, isCodeMultiInput])

  const choicesKey = (currentQuestion.choices || []).join('\u0001')
  const shuffledChoices = useMemo(
    () => shuffleChoices(currentQuestion.choices || []),
    [currentQuestion.question_id, choicesKey]
  )

  const codeTypeChoices = useMemo(() => {
    if (!isCodeType || !currentQuestion) return []
    if (currentQuestion.choices && currentQuestion.choices.length >= 2) {
      return shuffleChoices(currentQuestion.choices)
    }
    const answer = currentQuestion.answer
    const customChoices = currentQuestion.choices || []
    const generated = getChoicesForCodeInput(answer, customChoices)
    return shuffleChoices(generated)
  }, [currentQuestion?.question_id, currentQuestion?.choices, currentQuestion?.answer, isCodeType])

  const correctAnswerText = displayCorrectAnswer(
    aiResult?.correct_answer,
    currentQuestion.choices || [],
  )
  
  const isErrorFindNoChoice = currentQuestion.type === 'error_find'

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
        <div className="eb-b-ground-bot" />
        <div className="eb-b-hp-sub">
          <span className="eb-b-level-label">{LEVEL_LABELS[selectedLevel] ?? selectedLevel ?? '난이도'}</span>
          <span className="eb-b-boss-label">Endboss</span>
        </div>

        {showPhaseIntro && (
          <div className="eb-b-phase-intro" aria-hidden="true">
            <span>Phase{phase}</span>
          </div>
        )}
        
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
              <PlayerModel3D myShake={myShake} attackAnim={attackAnim} character={user?.character} position={[0, -0.3, 0]} rotation={[0, Math.PI * 0.15, 0]} />
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
          
          {isCodeMultiInput ? (
            <div className="eb-b-terminal" style={{ background: '#1E1B4B' }}>
              <pre style={{
                fontFamily: "'D2Coding', monospace", fontSize: '13px',
                lineHeight: '1.8', color: '#E9D5FF', whiteSpace: 'pre-wrap', margin: 0,
              }}>
                {currentQuestion.code_template ? currentQuestion.code_template.split('\n').map((line, lineIdx) => {
                  const hasSlot = /\{slot\d+\}/.test(line)
                  if (hasSlot) {
                    const indentMatch = line.match(/^(\s*)/)
                    const indent = indentMatch ? indentMatch[1] : ''
                    return (
                      <div key={lineIdx} style={{ display: 'flex', alignItems: 'center', minHeight: '26px' }}>
                        <span style={{ whiteSpace: 'pre' }}>{indent}</span>
                        <span style={{
                          display: 'inline-block',
                          background: '#3D2F6B',
                          border: '1.5px dashed #9F8FEF',
                          borderRadius: '6px',
                          padding: '1px 18px',
                          color: '#A78BFA',
                          fontSize: '14px',
                          letterSpacing: '0px',
                          minWidth: '120px',
                          textAlign: 'center',
                        }}>{'____________'}</span>
                      </div>
                    )
                  }
                  return (
                    <div key={lineIdx} style={{ display: 'flex', alignItems: 'center', minHeight: '26px' }}>
                      <span style={{ whiteSpace: 'pre-wrap' }}>{line}</span>
                    </div>
                  )
                }) : null}
              </pre>
            </div>
          ) : (
            parsed.code && (
              <div className="eb-b-terminal">
                <pre className="eb-b-code">{parsed.code}</pre>
              </div>
            )
          )}

          {parsed.after && (
            <div className="eb-b-qtext" style={{ marginTop: '6px' }}>{parsed.after}</div>
          )}

          {/* 객관식 / 출력선택 */}
          {hasChoice && (
            <div className="eb-b-radio-opts">
              {shuffledChoices.map((opt, idx) => {
                return (
                  <div
                    key={opt}
                    className={`eb-b-ropt${selectedOption === opt ? ' sel' : ''}`}
                    onClick={() => setSelectedOption(opt)}
                  >
                    <div className="eb-b-rcircle">{LABELS[idx] ?? idx + 1}</div>
                    <span className="eb-b-rtext">{stripChoiceLabel(opt)}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* 빈칸 채우기 (fill_in_blank / error_find 공용) */}
          {(currentQuestion.type === 'fill_in_blank' || isErrorFindNoChoice) && (
            <div className="eb-b-fib-row">
              <span className="eb-b-fib-lbl">답</span>
              <input
                className="eb-b-fib-in"
                type="text"
                value={answerInput}
                onChange={e => setAnswerInput(e.target.value)}
                placeholder={isErrorFindNoChoice ? '오류 줄 번호 입력...' : '정답 입력...'}
                onKeyDown={e => { if (e.key === 'Enter' && answerInput.trim()) onSubmit() }}
              />
            </div>
          )}

          {/* 코드 작성형 (code_multi_input / code_input 공용) */}
          {isCodeMultiInput && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              {currentQuestion.choices && currentQuestion.choices.length > 0 && (() => {
                const shortChoices = multiInputChoices
                if (shortChoices.length === 0) return null
                return (
                  <div style={{
                    border: '1.5px dashed #BDB4E8',
                    borderRadius: '12px',
                    background: '#F5F3FF',
                    padding: '12px 14px',
                    marginBottom: '4px',
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#5B21B6', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{isSingleAnswer ? '알맞은 코드를 입력하세요.' : '코드 조각을 순서에 맞게 바르게 입력하세요.'}</span>
                      <button
                        type="button"
                        onClick={() => !loading && !aiResult && setSingleLineValue('')}
                        disabled={loading || !!aiResult}
                        style={{ background: '#6D28D9', border: 'none', color: '#FFFFFF', fontSize: '12px', cursor: 'pointer', fontWeight: 700, opacity: (loading || !!aiResult) ? 0.4 : 1, padding: '4px 10px', borderRadius: '6px' }}
                      >
                        전체 지우기
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                      {shortChoices.map((choice, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #C4B9F0',
                            borderRadius: '8px',
                            padding: '5px 12px',
                            fontFamily: "'D2Coding', 'Courier New', monospace",
                            fontSize: '13px',
                            color: '#3B1F8C',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            boxShadow: '0 1px 3px rgba(109,40,217,0.08)',
                          }}
                        >
                          {choice}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              <div className="eb-b-fib-row">
                <span className="eb-b-fib-lbl" style={{ minWidth: '45px', flexShrink: 0 }}>정답</span>
                <input
                  className="eb-b-fib-in"
                  type="text"
                  value={singleLineValue}
                  onChange={(e) => setSingleLineValue(e.target.value)}
                  placeholder="빈칸 줄 전체를 입력하세요..."
                  disabled={loading || !!aiResult}
                  onKeyDown={e => { if (e.key === 'Enter' && singleLineValue.trim() && !aiResult) onSubmit() }}
                />
              </div>
            </div>
          )}

          {/* 코드 작성형 (code_input) */}
          {isCodeType && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              {codeTypeChoices && codeTypeChoices.length > 0 && (
                <div className="eb-b-choices-wrap" style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#4C4465', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{isSingleAnswer ? '알맞은 코드를 입력하세요.' : '코드 조각을 순서에 맞게 바르게 입력하세요.'}</span>
                    <button 
                      type="button" 
                      onClick={() => !loading && !aiResult && setAnswerInput('')} 
                      disabled={loading || !!aiResult}
                      style={{
                        background: 'transparent', border: 'none', color: '#DC2626', fontSize: '10px', cursor: 'pointer', fontWeight: 600
                      }}
                    >
                      전체 지우기
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {codeTypeChoices.map((choice, idx) => (
                      <div
                        key={idx}
                        style={{
                          textAlign: 'left',
                          background: '#F3F4F6',
                          border: '1px solid #E5E7EB',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          fontFamily: "'D2Coding', monospace",
                          fontSize: '14px',
                          color: '#1F2937',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      >
                        {choice}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="eb-b-editor">
                <div className="eb-b-editor-lbl"># 여기에 코드를 작성하세요</div>
                <textarea
                  className="eb-b-editor-text"
                  placeholder="코드 입력..."
                  rows={4}
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  disabled={loading || !!aiResult}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontFamily: "'D2Coding', monospace",
                    fontSize: '13px',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    resize: 'none',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 공격 버튼 */}
        <button
          className="eb-b-atk-btn"
          onClick={onSubmit}
          disabled={(!selectedOption && !answerInput.trim()) || loading}
        >
          {loading ? '채점 중...' : '🚀 공격하기'}
        </button>
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
            {!aiResult.is_correct && aiResult.hint && (
              <div className="eb-b-res-desc">힌트: {aiResult.hint}</div>
            )}
            {!aiResult.is_correct && aiResult.explanation && (
              <div className="eb-b-res-desc">해설: {aiResult.explanation}</div>
            )}
            {!aiResult.is_correct && correctAnswerText && (
              <div className="eb-b-res-desc">정답: {correctAnswerText}</div>
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
