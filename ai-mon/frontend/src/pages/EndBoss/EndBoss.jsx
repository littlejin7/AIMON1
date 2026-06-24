import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { endbossApi, userApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import EndBossIntro  from './EndBossIntro'
import useBossSound from '../../hooks/useBossSound'
import EndBossBattle from './EndBossBattle'
import EndBossResult from './EndBossResult'
import TitleEarnedModal from '../../components/TitleEarnedModal/TitleEarnedModal'
import endbossOrgImg from '../../assets/endboss_finalorg.png'
import endbossQnaImg from '../../assets/endboss_finalqna.png'
import '../Boss/Boss.css'

// ── 페이즈 전환 화면용 보스 이미지 ──────────────────
function BossSmallSVG({ phaseStyle = 1 }) {
  const src = phaseStyle >= 2 ? endbossQnaImg : endbossOrgImg
  const filterStyle = phaseStyle === 3
    ? 'drop-shadow(0 0 20px rgba(239,68,68,.6))'
    : phaseStyle === 2
      ? 'drop-shadow(0 0 12px rgba(250,199,117,.4))'
      : 'drop-shadow(0 4px 12px rgba(83,74,183,.3))'
  return (
    <img
      src={src}
      alt="엔드보스"
      style={{ width: '90px', height: '90px', objectFit: 'contain', filter: filterStyle }}
    />
  )
}

export default function EndBoss() {
  const navigate = useNavigate()

  const user       = useAuthStore(s => s.user)
  const updateUser = useAuthStore(s => s.updateUser)

  const { playBGM, stopBGM, playSFX } = useBossSound()

  const [loading,         setLoading]         = useState(true)
  // 'intro' | 'phase1_transition' | 'phase2_transition' | 'phase3_transition'
  // | 'battle' | 'cleared' | 'failed'
  const [phase,           setPhase]           = useState('intro')
  const [bossData,        setBossData]        = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [selectedOption,  setSelectedOption]  = useState(null)
  const [answerInput,     setAnswerInput]     = useState('')
  const [aiResult,        setAiResult]        = useState(null)
  const [errorMsg,        setErrorMsg]        = useState('')

  // HP (엔드보스: 1200/1800)
  const BOSS_HP_INIT = 1800
  const MY_HP_INIT   = 1200
  const [myHp,       setMyHp]       = useState(MY_HP_INIT)
  const [bossHp,     setBossHp]     = useState(BOSS_HP_INIT)

  // 애니메이션 상태
  const [bossShake,   setBossShake]   = useState(false)
  const [myShake,     setMyShake]     = useState(false)
  const [bossHit,     setBossHit]     = useState(false)
  const [screenShake, setScreenShake] = useState(false)
  const [attackAnim,  setAttackAnim]  = useState(false)
  const [dmgPopup,    setDmgPopup]    = useState(null)

  // 엔드보스 전투 상태
  const [endbossState, setEndbossState] = useState({
    project:            null,
    phase:              1,
    phase1Questions:    [],
    phase2Questions:    [],
    phase3FirstQuestion: null,
    phase1Index:        0,
    phase2Index:        0,
    phase3Tries:        0,
    nextPhase3Question: null,
  })

  // 레벨업 / 칭호
  const [initialLevel,      setInitialLevel]      = useState(1)
  const [levelUpMessage,    setLevelUpMessage]    = useState('')
  const [newlyEarnedTitles, setNewlyEarnedTitles] = useState([])

  useEffect(() => {
    if (user) setInitialLevel(user.lv || 1)
  }, [user])

  useEffect(() => {
    endbossApi.getInfo().then(res => {
      setBossData(res.data)
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  // ── 공격 이펙트 ──────────────────────────────
  const playAttackEffect = (damage) => {
    setAttackAnim(true)
    setTimeout(() => {
      setBossHit(true)
      setBossShake(true)
      playSFX('attack')
      setDmgPopup(damage)
      setTimeout(() => {
        setBossHit(false)
        setBossShake(false)
        setDmgPopup(null)
        setAttackAnim(false)
      }, 600)
    }, 500)
  }

  // ── 피격 이펙트 ──────────────────────────────
  const playHitEffect = () => {
    playSFX('hit')
    setMyShake(true)
    setScreenShake(true)
    setTimeout(() => {
      setMyShake(false)
      setScreenShake(false)
    }, 600)
  }

  // ── 전투 시작 (선택한 프로젝트로 API 호출) ──
  const handleStart = async (project = null) => {
    setMyHp(MY_HP_INIT)
    setBossHp(BOSS_HP_INIT)
    setAiResult(null)
    setSelectedOption(null)
    setAnswerInput('')
    setLoading(true)
    try {
      if (!project) throw new Error('프로젝트를 선택해주세요.')
      const res = await endbossApi.startBattle(project)
      const d = res.data
      setEndbossState({
        project:             d.project,
        phase:               d.phase,
        phase1Questions:     d.phase1_questions,
        phase2Questions:     d.phase2_questions,
        phase3FirstQuestion: d.phase3_first_question,
        phase1Index:         0,
        phase2Index:         0,
        phase3Tries:         0,
        nextPhase3Question:  null,
      })
      // Phase 1 진입 문제 미리 세팅, 전환 화면 먼저 표시
      setCurrentQuestion(d.phase1_questions[0])
      setMyHp(d.my_hp)
      setBossHp(d.boss_hp)
      playBGM('endboss_intro')
      setPhase('phase1_transition')
      setErrorMsg('')
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || '도전 비용이 부족합니다!')
    } finally {
      setLoading(false)
    }
  }

  // ── 페이즈 전환 핸들러 ──────────────────────
  const handlePhase1Start = () => {
    setPhase('battle')
  }

  const handlePhase2Start = () => {
    setEndbossState(prev => ({ ...prev, phase: 2, phase2Index: 0 }))
    setCurrentQuestion(endbossState.phase2Questions[0])
    setAiResult(null)
    setSelectedOption(null)
    setAnswerInput('')
    setPhase('battle')
  }

  const handlePhase3Start = () => {
    setEndbossState(prev => ({ ...prev, phase: 3 }))
    setCurrentQuestion(endbossState.phase3FirstQuestion)
    setAiResult(null)
    setSelectedOption(null)
    setAnswerInput('')
    setPhase('battle')
  }

  // ── 정답 제출 ────────────────────────────────
  const handleSubmit = async () => {
    if (!currentQuestion) return
    const isCodeType = currentQuestion.type === 'code_input' || currentQuestion.type === 'fill_in_blank'
    const userAnswer = isCodeType ? answerInput : selectedOption
    if (!userAnswer) return

    setLoading(true)
    try {
      const res = await endbossApi.submitAnswer({
        question_id:  currentQuestion.question_id,
        user_answer:  userAnswer,
        phase:        endbossState.phase,
        my_hp:        myHp,
        boss_hp:      bossHp,
        phase3_tries: endbossState.phase3Tries,
        project:      endbossState.project,
      })

      const d         = res.data
      const isCorrect = d.is_correct
      const nextMyHp  = d.my_hp
      const nextBossHp = d.boss_hp
      const isClear   = d.is_clear
      const isFail    = d.is_fail

      setAiResult(d)
      setMyHp(nextMyHp)
      setBossHp(nextBossHp)

      const damage = bossHp - nextBossHp

      if (isCorrect) {
        playAttackEffect(damage > 0 ? damage : 150)
        if (isClear) {
          setTimeout(async () => {
            try {
              const clearRes = await endbossApi.clearBoss(endbossState.project)
              if (clearRes?.data?.newly_earned_titles?.length > 0) {
                setNewlyEarnedTitles(clearRes.data.newly_earned_titles)
              }
              const userRes     = await userApi.getMe()
              const updatedUser = userRes.data
              updateUser(updatedUser)
              const newLevel = updatedUser.lv || 1
              if (newLevel > initialLevel) {
                setLevelUpMessage(`🎉 레벨업 달성! Lv.${initialLevel} ➔ Lv.${newLevel}`)
              }
            } catch (e) {
              console.error('Failed to update user profile:', e)
            }
            playBGM('clear')
            setPhase('cleared')
          }, 1500)
        } else if (d.phase3_ready) {
          // Phase 2 완료 → Phase 3 전환 화면
          setTimeout(() => setPhase('phase3_transition'), 1500)
        }
      } else {
        playHitEffect()
        if (isFail) {
          setTimeout(() => { playBGM('fail'); setPhase('failed') }, 2500)
        }
        if (endbossState.phase === 3) {
          setEndbossState(prev => ({
            ...prev,
            phase3Tries:        d.phase3_tries,
            nextPhase3Question: d.next_phase3_question,
          }))
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // ── 다음 문제 ────────────────────────────────
  const handleNextQuestion = async () => {
    if (myHp <= 0 || endbossState.phase3Tries >= 3) {
      setPhase('failed')
      return
    }
    setLoading(true)
    try {
      if (endbossState.phase === 3) {
        if (currentQuestion.phase !== 3) {
          setCurrentQuestion(endbossState.phase3FirstQuestion)
        } else {
          setCurrentQuestion(endbossState.nextPhase3Question)
        }
      } else if (endbossState.phase === 1) {
        const nextIdx = endbossState.phase1Index + 1
        if (nextIdx < endbossState.phase1Questions.length) {
          setEndbossState(prev => ({ ...prev, phase1Index: nextIdx }))
          setCurrentQuestion(endbossState.phase1Questions[nextIdx])
        } else {
          // Phase 1 완료 → Phase 2 전환 화면
          setPhase('phase2_transition')
        }
      } else if (endbossState.phase === 2) {
        const nextIdx = endbossState.phase2Index + 1
        if (nextIdx < endbossState.phase2Questions.length) {
          setEndbossState(prev => ({ ...prev, phase2Index: nextIdx }))
          setCurrentQuestion(endbossState.phase2Questions[nextIdx])
        }
      }
      setAiResult(null)
      setSelectedOption(null)
      setAnswerInput('')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // ── 페이즈 전환 화면 공통 렌더러 ─────────────
  const renderPhaseTransition = (phaseNum) => {
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

          <button className="ep-continue-btn red" onClick={handlePhase3Start}>
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
      onStart: handlePhase1Start,
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
      onStart: handlePhase2Start,
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

  // ── 렌더링 ───────────────────────────────────
  if (loading) {
    return <div className="boss-loading"><div className="spinner" /></div>
  }

  return (
    <div className={`boss-page ${screenShake ? 'screen-shake' : ''}`}>
      <div className="boss-header">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { stopBGM(); navigate('/lesson') }}
        >
          도망가기 🏃
        </button>
      </div>

      <div className={`${phase === 'battle' ? 'boss-container-battle' : 'boss-container container'}`}>
        {phase === 'intro' && (
          <EndBossIntro
            bossData={bossData}
            errorMsg={errorMsg}
            onStart={handleStart}
          />
        )}

        {phase === 'phase1_transition' && renderPhaseTransition(1)}
        {phase === 'phase2_transition' && renderPhaseTransition(2)}
        {phase === 'phase3_transition' && renderPhaseTransition(3)}

        {phase === 'battle' && currentQuestion && (
          <EndBossBattle
            bossData={bossData}
            currentQuestion={currentQuestion}
            bossHp={bossHp}
            myHp={myHp}
            phase={endbossState.phase}
            phase3Tries={endbossState.phase3Tries}
            selectedOption={selectedOption}
            setSelectedOption={setSelectedOption}
            answerInput={answerInput}
            setAnswerInput={setAnswerInput}
            aiResult={aiResult}
            loading={loading}
            bossShake={bossShake}
            myShake={myShake}
            bossHit={bossHit}
            attackAnim={attackAnim}
            dmgPopup={dmgPopup}
            user={user}
            onSubmit={handleSubmit}
            onNextQuestion={handleNextQuestion}
            questionNum={
              endbossState.phase === 1 ? endbossState.phase1Index + 1 :
              endbossState.phase === 2 ? endbossState.phase2Index + 1 : 1
            }
            questionTotal={
              endbossState.phase === 1 ? endbossState.phase1Questions.length :
              endbossState.phase === 2 ? endbossState.phase2Questions.length : 1
            }
          />
        )}

        {(phase === 'cleared' || phase === 'failed') && (
          <EndBossResult
            phase={phase}
            aiResult={aiResult}
            levelUpMessage={levelUpMessage}
            onRetry={() => setPhase('intro')}
            onNavigateLesson={() => navigate('/lesson')}
          />
        )}
      </div>

      {newlyEarnedTitles.length > 0 && (
        <TitleEarnedModal
          titles={newlyEarnedTitles}
          onClose={() => setNewlyEarnedTitles([])}
        />
      )}
    </div>
  )
}
