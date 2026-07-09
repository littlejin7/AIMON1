import { useState, useEffect, useMemo, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import PlayerModel3D from './PlayerModel3D'
import BossModel3D from './BossModel3D'
import unitbossBg    from '../../assets/unitbossbg.png'
import bossQnaIcon   from '../../assets/boss_finalqna.png'
import charSlimeIcon  from '../../assets/character_slime.png'
import charRobotIcon  from '../../assets/character_robot.png'
import charBubbleIcon from '../../assets/character_bubble.png'
import charGhostIcon  from '../../assets/character_final_ghost.png'
import { bossApi } from '../../api/index'
import { parseQuestionText, TYPE_BADGE, getChoicesForCodeInput } from './bossBattleUtils'
import { PythonHighlighter } from '../../utils/pythonHighlight'
import '../../components/QuizCard/QuizCard.css'
import './BossBattle.css'

const LABELS = ['A', 'B', 'C', 'D', 'E']

function stripChoiceLabel(opt) {
  return String(opt || '').replace(/^[A-E]\.\s*/, '')
}

function shuffleChoices(choices) {
  const shuffled = [...choices]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export default function BossBattle({
  bossData,
  currentQuestion,
  bossHp,
  myHp,
  wrongCount,
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
  lessonId,
  onSubmit,
  onNextQuestion,
  onEscape,
}) {
  const [usedHints,    setUsedHints]    = useState(0)
  const [currentHint,  setCurrentHint]  = useState('')
  const [hintLoading,  setHintLoading]  = useState(false)

  // 단일 라인 입력 state (code_multi_input: slot 줄 전체를 1개 input으로 입력)
  const [singleLineValue, setSingleLineValue] = useState('')

  useEffect(() => {
    setSingleLineValue('')
  }, [currentQuestion?.question_id])

  useEffect(() => {
    if (currentQuestion?.type === 'code_multi_input' || currentQuestion?.type === 'code_input') {
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
  }, [singleLineValue, currentQuestion?.code_template, currentQuestion?.question_id, currentQuestion?.type, setAnswerInput])

  useEffect(() => {
    setUsedHints(0)
    setCurrentHint('')
  }, [currentQuestion?.question_id])

  const handleGetHint = async () => {
    if (usedHints >= 2 || !currentQuestion) return
    setHintLoading(true)
    try {
      const isCodeTypeHint = currentQuestion.type === 'code_input' ||
        currentQuestion.type === 'code_multi_input' ||
        currentQuestion.type === 'fill_in_blank' ||
        (currentQuestion.type === 'error_find' && (currentQuestion.choices?.length || 0) === 0)
      const res = await bossApi.getHint({
        question_id: currentQuestion.question_id,
        user_answer: isCodeTypeHint ? answerInput : (selectedOption || ''),
      })
      setCurrentHint(res.data.hint)
      setUsedHints(prev => prev + 1)
    } catch (err) {
      console.error(err)
    } finally {
      setHintLoading(false)
    }
  }

  const BOSS_HP_MAX = 1000
  const MY_HP_MAX   = 1000

  const bossPct = Math.max(0, (bossHp / BOSS_HP_MAX) * 100)
  const myHpPct = Math.max(0, (myHp  / MY_HP_MAX)   * 100)

  const characterIcon =
    user?.character === 'robot'         ? charRobotIcon  :
    user?.character === 'speech_bubble' ? charBubbleIcon :
    user?.character === 'final_ghost'   ? charGhostIcon  :
    charSlimeIcon

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

  const choicesKey = (currentQuestion.choices || []).join('\u0001')
  const shuffledChoices = useMemo(
    () => shuffleChoices(currentQuestion.choices || []),
    [currentQuestion.question_id, choicesKey],
  )

  const multiInputChoices = useMemo(() => {
    if (!isCodeMultiInput || !currentQuestion) return []
    if (currentQuestion.choices && currentQuestion.choices.length > 0) {
      if (currentQuestion.choices.length === 1) {
        const withDistractors = getChoicesForCodeInput(currentQuestion.choices[0], currentQuestion.choices)
        return shuffleChoices(withDistractors)
      }
      return shuffleChoices(currentQuestion.choices)
    }
    if (Array.isArray(currentQuestion.answer)) {
      const correct = currentQuestion.answer
      const distractors = ['await', 'run', 'async', 'gather', 'sleep(1)', 'create_task', 'def'].filter(
        d => !correct.includes(d)
      )
      const targetCount = Math.max(5, correct.length + 1)
      const extra = distractors.slice(0, targetCount - correct.length)
      return shuffleChoices([...correct, ...extra])
    }
    return []
  }, [currentQuestion?.question_id, currentQuestion?.choices, currentQuestion?.answer, isCodeMultiInput])

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
  
  const templateLines = currentQuestion?.code_template ? currentQuestion.code_template.split('\n') : []

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
  
  // error_find: 줄 클릭 UI 폐지 — 정답 줄 번호를 빈칸에 직접 입력하는 방식으로 통일
  const isErrorFindNoChoice = currentQuestion.type === 'error_find'

  const bossHpGrad = bossPct > 50
    ? 'linear-gradient(90deg,#FF6B6B,#FF4444)'
    : bossPct > 25
      ? 'linear-gradient(90deg,#FF9E2C,#FF6B6B)'
      : 'linear-gradient(90deg,#FF4444,#CC0000)'

  const hintLeft = 2 - usedHints

  return (
    <div className="eb-b-wrap">


      {/* ── 전투 배경 ── */}
      <div className="eb-b-bg" style={{ backgroundImage: `url(${unitbossBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="eb-b-ground-bot" />

        {/* 플레이어 HP 박스 — 상단 왼쪽 */}
        <div className={`eb-b-player-hpbox${myShake ? ' shake' : ''}`} style={{ top: '12px', bottom: 'auto', left: '12px' }}>
          <div className="eb-b-hp-bar-wrap">
            <span className="eb-b-hp-label">HP</span>
            <div className="eb-b-hp-track">
              <div className="eb-b-hp-fill player" style={{ width: `${myHpPct}%` }} />
            </div>
          </div>
          <div className="eb-b-hp-nums">{myHp}/{MY_HP_MAX}</div>
        </div>

        {/* 보스 HP 박스 — 상단 오른쪽 */}
        <div className="eb-b-boss-hpbox" style={{ top: '12px' }}>
          <div className="eb-b-hp-name">{bossData?.boss_name || '코드몬 보스'}</div>
          <div className="eb-b-hp-bar-wrap">
            <span className="eb-b-hp-label">HP</span>
            <div className="eb-b-hp-track">
              <div className="eb-b-hp-fill" style={{ width: `${bossPct}%`, background: bossHpGrad }} />
            </div>
          </div>
          <Canvas
            camera={{ position: [0, 0, 3], fov: 40 }}
            style={{ background: 'transparent' }}
            gl={{ alpha: true }}
          >
            <ambientLight intensity={3} />
            <directionalLight position={[2, 4, 2]} intensity={2.0} />
            <directionalLight position={[-2, 2, 2]} intensity={1.0} />
            <Suspense fallback={null}>
              <PlayerModel3D myShake={myShake} attackAnim={attackAnim} character={user?.character} position={[0, -0.9, 0]} rotation={[0, Math.PI * 0.15, 0]} />
            </Suspense>
          </Canvas>
        </div>

        {/* 보스 3D 캐릭터 — 하단 오른쪽 */}
        <div className={`eb-b-boss-canvas${bossHit ? ' hit-red' : ''}`} style={{ bottom: '10px', top: 'auto', right: '-25px', width: '220px', height: '220px' }}>
          <Canvas
            camera={{ position: [0, 0, 3], fov: 40 }}
            style={{ background: 'transparent' }}
            gl={{ alpha: true }}
          >
            <ambientLight intensity={2.5} />
            <directionalLight position={[3, 5, 3]} intensity={4} />
            <directionalLight position={[-2, 2, 2]} intensity={2.0} />
            <directionalLight position={[0, -2, 2]} intensity={2} />
            <Suspense fallback={null}>
              <BossModel3D bossHit={bossHit} bossShake={bossShake} modelPath="/models/boss_unitboss.glb" />
            </Suspense>
          </Canvas>
        </div>

        {/* 플레이어 3D 캐릭터 */}
        <div className={`eb-b-player-canvas${myShake ? ' hit-red' : ''}`}>
          <Canvas
            camera={{ position: [0, 0, 3], fov: 40 }}
            style={{ background: 'transparent' }}
            gl={{ alpha: true }}
          >
            <ambientLight intensity={3} />
            <directionalLight position={[2, 4, 2]} intensity={2.0} />
            <directionalLight position={[-2, 2, 2]} intensity={1.0} />
            <Suspense fallback={null}>
              <PlayerModel3D myShake={myShake} attackAnim={attackAnim} character={user?.character} position={[0, -0.9, 0]} rotation={[-0.8, -Math.PI * 0.15, 0]} />
            </Suspense>
          </Canvas>
        </div>

        {/* 데미지 팝업 */}
        {dmgPopup && <div className="eb-b-dmg-popup">-{dmgPopup}</div>}
      </div>

      {/* ── 퀴즈 패널 ── */}
      <div className={`eb-b-quiz-wrap quiz-attack-wrap${attackAnim ? ' attack-fly' : ''}`}>

        {/* 유형 뱃지 + 힌트 + 문제 번호 */}
        <div className="eb-b-topbar">
          <span
            className="eb-b-badge"
            style={{ background: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
          {/* 힌트 필 (유닛보스 전용) */}
          <span
            className={`eb-b-hint-pill${hintLeft === 0 ? ' used' : ''}`}
            onClick={() => !loading && hintLeft > 0 && !aiResult && handleGetHint()}
          >
            {hintLoading ? '생성 중...' : `💡 힌트 ${hintLeft}회`}
          </span>
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
                {templateLines.map((line, lineIdx) => {
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
                          fontSize: '12px',
                          letterSpacing: '2px',
                          minWidth: '80px',
                          textAlign: 'center',
                        }}>{'_ _ _ _ _'}</span>
                      </div>
                    )
                  }
                  return (
                    <div key={lineIdx} style={{ display: 'flex', alignItems: 'center', minHeight: '26px' }}>
                      <span style={{ whiteSpace: 'pre-wrap' }}>{line}</span>
                    </div>
                  )
                })}
              </pre>
            </div>
          ) : (
            parsed.code && (
              <div className="eb-b-terminal">
                <PythonHighlighter code={parsed.code} className="eb-b-code" />
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
                    onClick={() => !aiResult && setSelectedOption(opt)}
                  >
                    <div className="eb-b-rcircle">{LABELS[idx] ?? idx + 1}</div>
                    <span className="eb-b-rtext">{stripChoiceLabel(opt)}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* 빈칸 채우기 */}
          {(isFibType || isErrorFindNoChoice) && (
            <div className="eb-b-fib-row">
              <span className="eb-b-fib-lbl">답</span>
              <input
                className="eb-b-fib-in"
                type="text"
                value={answerInput}
                onChange={e => setAnswerInput(e.target.value)}
                placeholder={isErrorFindNoChoice ? '오류 줄 번호 입력...' : '정답 입력...'}
                onKeyDown={e => { if (e.key === 'Enter' && answerInput.trim() && !aiResult) onSubmit() }}
              />
            </div>
          )}

          {/* 코드 빈칸 채우기 (다중 빈칸 입력) */}
          {isCodeMultiInput && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              {multiInputChoices && multiInputChoices.length > 0 && (() => {
                const shortChoices = multiInputChoices.filter(c => c.length <= 30)
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
                        style={{ background: 'transparent', border: 'none', color: '#5B21B6', fontSize: '12px', cursor: 'pointer', fontWeight: 700, opacity: (loading || !!aiResult) ? 0.4 : 1 }}
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

           {isCodeType && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                <div className="eb-b-edlbl"># 코드를 작성하세요</div>
                <textarea
                  className="eb-b-edta"
                  rows={5}
                  value={answerInput}
                  onChange={e => setAnswerInput(e.target.value)}
                  placeholder="여기에 코드 작성..."
                />
              </div>
            </div>
          )}

          {/* 힌트 박스 */}
          {currentHint && !aiResult && (
            <div className="eb-b-hint-box">
              <span className="eb-b-hint-title">💡 에이몬의 힌트</span>
              <span className="eb-b-hint-body">{currentHint}</span>
            </div>
          )}
        </div>

        {/* 공격 버튼 */}
        {!aiResult && (
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
            {aiResult.hint && (
              <div className="eb-b-res-hint">
                <span style={{ fontWeight: 600, color: '#8A5500' }}>💡 힌트</span>
                <span>{aiResult.hint}</span>
              </div>
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
