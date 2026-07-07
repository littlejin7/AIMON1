import BossModel3D from '../Boss/BossModel3D'
import PlayerModel3D from '../Boss/PlayerModel3D'
import endbossBg from '../../assets/endbossbg.png'
import { useState, useEffect, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
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

  const isCodeType = currentQuestion.type === 'code_input' || currentQuestion.type === 'fill_in_blank'
  const hasChoice  = !isCodeType && currentQuestion.choices?.length > 0
  const choicesKey = (currentQuestion.choices || []).join('\u0001')
  const shuffledChoices = useMemo(
    () => shuffleChoices(currentQuestion.choices || []),
    [currentQuestion.question_id, choicesKey],
  )
  const correctAnswerText = displayCorrectAnswer(
    aiResult?.correct_answer,
    currentQuestion.choices || [],
  )
  
  // error_find: 줄 클릭 UI 폐지 — 정답 줄 번호를 빈칸에 직접 입력하는 방식으로 통일
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
