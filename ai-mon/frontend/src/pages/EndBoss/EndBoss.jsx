import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { endbossApi, userApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import EndBossIntro from './EndBossIntro'
import useBossSound from '../../hooks/useBossSound'
import EndBossBattle from './EndBossBattle'
import EndBossResult from './EndBossResult'
import TitleEarnedModal from '../../components/TitleEarnedModal/TitleEarnedModal'
import EndBossPhaseTransition from './EndBossPhaseTransition'
import '../Boss/Boss.css'
import './EndBossIntro.css'
import './EndBossPhaseTransition.css'
import '../Boss/BossBattle.css'

export default function EndBoss() {
  const navigate = useNavigate()

  const user = useAuthStore(s => s.user)
  const updateUser = useAuthStore(s => s.updateUser)

  const { playBGM, stopBGM, playSFX } = useBossSound()

  const [loading, setLoading] = useState(true)
  // 'intro' | 'phase1_transition' | 'phase2_transition' | 'phase3_transition'
  // | 'battle' | 'cleared' | 'failed'
  const [phase, setPhase] = useState('intro')
  const [bossData, setBossData] = useState(null)
  const [selectedLevel, setSelectedLevel] = useState('beginner')
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [answerInput, setAnswerInput] = useState('')
  const [aiResult, setAiResult] = useState(null)
  const [clearResult, setClearResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  // HP (엔드보스: 1200/1800)
  const BOSS_HP_INIT = 1800
  const MY_HP_INIT = 1200
  const [myHp, setMyHp] = useState(MY_HP_INIT)
  const [bossHp, setBossHp] = useState(BOSS_HP_INIT)

  // 애니메이션 상태
  const [bossShake, setBossShake] = useState(false)
  const [myShake, setMyShake] = useState(false)
  const [bossHit, setBossHit] = useState(false)
  const [screenShake, setScreenShake] = useState(false)
  const [attackAnim, setAttackAnim] = useState(false)
  const [dmgPopup, setDmgPopup] = useState(null)

  // 엔드보스 전투 상태
  const [endbossState, setEndbossState] = useState({
    project: null,
    phase: 1,
    phase1Questions: [],
    phase2Questions: [],
    phase3FirstQuestion: null,
    phase1Index: 0,
    phase2Index: 0,
    phase3Tries: 0,
    nextPhase3Question: null,
  })

  // 레벨업 / 칭호
  const [initialLevel, setInitialLevel] = useState(1)
  const [levelUpMessage, setLevelUpMessage] = useState('')
  const [newlyEarnedTitles, setNewlyEarnedTitles] = useState([])

  // 제출 중복 방지 lock — React state(loading)는 비동기 반영이라 빠른 연타 첫 프레임을
  // 놓칠 수 있으므로 ref 로 즉시 차단한다. code_input(phase3)의 중복 Claude 호출 방지.
  const submitLockRef = useRef(false)

  useEffect(() => {
    // target_level 없이 호출 — 기존 계약과 동일한 baseline 조회(게이트 없음).
    endbossApi.getInfo().then(res => {
      setBossData(res.data)
      setSelectedLevel(res.data.course_level || 'beginner')
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  // ── 레벨 칩 선택 (인트로 화면에서만 노출) ──
  const handleLevelChange = async (level) => {
    setSelectedLevel(level)
    // 진행 중이던 배틀 상태 초기화 (레벨 전환 시 잔존 방지)
    setMyHp(MY_HP_INIT)
    setBossHp(BOSS_HP_INIT)
    setCurrentQuestion(null)
    setSelectedOption(null)
    setAnswerInput('')
    setAiResult(null)
    setClearResult(null)
    setErrorMsg('')
    setEndbossState({
      project: null,
      phase: 1,
      phase1Questions: [],
      phase2Questions: [],
      phase3FirstQuestion: null,
      phase1Index: 0,
      phase2Index: 0,
      phase3Tries: 0,
      nextPhase3Question: null,
    })
    try {
      const res = await endbossApi.getInfo(level)
      setBossData(res.data)
    } catch (err) {
      console.error(err)
    }
  }

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
    setInitialLevel(user?.lv || 1)
    setMyHp(MY_HP_INIT)
    setBossHp(BOSS_HP_INIT)
    setAiResult(null)
    setClearResult(null)
    setSelectedOption(null)
    setAnswerInput('')
    setLoading(true)
    try {
      if (!project) throw new Error('프로젝트를 선택해주세요.')
      const res = await endbossApi.startBattle(project, selectedLevel)
      const d = res.data
      setEndbossState({
        project: d.project,
        phase: d.phase,
        phase1Questions: d.phase1_questions,
        phase2Questions: d.phase2_questions,
        phase3FirstQuestion: d.phase3_first_question,
        phase1Index: 0,
        phase2Index: 0,
        phase3Tries: 0,
        nextPhase3Question: null,
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
    // error_find: 줄 클릭 UI 폐지 → 빈칸 직접 입력(answerInput)으로 채점
    const isTextAnswer = isCodeType || currentQuestion.type === 'error_find'
    const userAnswer = isTextAnswer ? answerInput : selectedOption
    if (!userAnswer) return

    // 이미 제출 진행 중이면 즉시 차단 (연타 방어) — state 반영 전이라도 ref 로 막힘
    if (submitLockRef.current) return
    submitLockRef.current = true

    setLoading(true)
    try {
      const res = await endbossApi.submitAnswer({
        question_id: currentQuestion.question_id,
        user_answer: userAnswer,
        phase: endbossState.phase,
        my_hp: myHp,
        boss_hp: bossHp,
        phase3_tries: endbossState.phase3Tries,
        project: endbossState.project,
        ...(selectedLevel && { target_level: selectedLevel }),
      })

      const d = res.data
      const isCorrect = d.is_correct
      const nextMyHp = d.my_hp
      const nextBossHp = d.boss_hp
      const isClear = d.is_clear
      const isFail = d.is_fail

      setMyHp(nextMyHp)
      setBossHp(nextBossHp)

      const damage = bossHp - nextBossHp

      if (isCorrect) {
        playAttackEffect(damage > 0 ? damage : 150)
        setTimeout(() => setAiResult(d), 1100)
        if (isClear) {
          setTimeout(async () => {
            try {
              const clearRes = await endbossApi.clearBoss(endbossState.project, selectedLevel)
              setClearResult(clearRes?.data || null)
              if (clearRes?.data?.newly_earned_titles?.length > 0) {
                setNewlyEarnedTitles(clearRes.data.newly_earned_titles)
              }
              const userRes = await userApi.getMe()
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
        setAiResult(d)
        playHitEffect()
        if (isFail) {
          setTimeout(() => { playBGM('fail'); setPhase('failed') }, 2500)
        }
        if (endbossState.phase === 3) {
          setEndbossState(prev => ({
            ...prev,
            phase3Tries: d.phase3_tries,
            nextPhase3Question: d.next_phase3_question,
          }))
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      // 성공·실패 무관하게 항상 해제 → API 실패 시 영구 disabled 방지, 정상 플로우 유지.
      submitLockRef.current = false
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
            selectedLevel={selectedLevel}
            onLevelChange={handleLevelChange}
          />
        )}

        {(phase === 'phase1_transition' || phase === 'phase2_transition' || phase === 'phase3_transition') && (
          <EndBossPhaseTransition
            phaseNum={phase === 'phase1_transition' ? 1 : phase === 'phase2_transition' ? 2 : 3}
            myHp={myHp}
            MY_HP_INIT={MY_HP_INIT}
            endbossState={endbossState}
            onPhase1Start={handlePhase1Start}
            onPhase2Start={handlePhase2Start}
            onPhase3Start={handlePhase3Start}
          />
        )}

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
            onEscape={() => { stopBGM(); navigate('/lesson') }}
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
            clearResult={clearResult}
            levelUpMessage={levelUpMessage}
            onRetry={() => { setClearResult(null); setPhase('intro') }}
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
