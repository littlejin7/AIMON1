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
import { parseQuestionText, TYPE_BADGE } from './bossBattleUtils'
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

  useEffect(() => {
    setUsedHints(0)
    setCurrentHint('')
  }, [currentQuestion?.question_id])

  const handleGetHint = async () => {
    if (usedHints >= 2 || !currentQuestion) return
    setHintLoading(true)
    try {
      const isCodeType = currentQuestion.type === 'code_input' ||
        currentQuestion.type === 'fill_in_blank' ||
        (currentQuestion.type === 'error_find' && (currentQuestion.choices?.length || 0) === 0)
      const res = await bossApi.getHint({
        question_id: currentQuestion.question_id,
        user_answer: isCodeType ? answerInput : (selectedOption || ''),
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

  const isCodeType = currentQuestion.type === 'code_input'
  const isFibType  = currentQuestion.type === 'fill_in_blank'
  const hasChoice  = !isCodeType && !isFibType && currentQuestion.choices?.length > 0
  const choicesKey = (currentQuestion.choices || []).join('\u0001')
  const shuffledChoices = useMemo(
    () => shuffleChoices(currentQuestion.choices || []),
    [currentQuestion.question_id, choicesKey],
  )
  
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
          <div className="eb-b-hp-nums">{myHp} / {MY_HP_MAX}</div>
        </div>

        {/* 보스 HP 박스 — 상단 오른쪽 */}
        <div className="eb-b-boss-hpbox" style={{ top: '12px', right: '12px' }}>
          <div className="eb-b-hp-bar-wrap">
            <span className="eb-b-hp-label">HP</span>
            <div className="eb-b-hp-track">
              <div className="eb-b-hp-fill" style={{ width: `${bossPct}%`, background: bossHpGrad }} />
            </div>
          </div>
          <div className="eb-b-hp-nums">{bossHp} / {BOSS_HP_MAX}</div>
        </div>

        {/* 플레이어 3D 캐릭터 — 하단 왼쪽 */}
        <div className={`eb-b-player-canvas${myShake ? ' hit-red' : ''}`} style={{ bottom: '0px', top: 'auto', left: '0px', width: '170px', height: '170px' }}>
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
          {parsed.code && (
            <div className="eb-b-terminal">
              <PythonHighlighter code={parsed.code} className="eb-b-code" />
            </div>
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

          {/* 코드 작성 */}
          {isCodeType && (
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
