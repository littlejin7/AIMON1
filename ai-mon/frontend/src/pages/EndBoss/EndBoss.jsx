import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { endbossApi, userApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import EndBossIntro  from './EndBossIntro'
import useBossSound from '../../hooks/useBossSound'
import EndBossBattle from './EndBossBattle'
import EndBossResult from './EndBossResult'
import '../Boss/Boss.css' // 재사용

export default function EndBoss() {
  const navigate = useNavigate()

  const user       = useAuthStore(s => s.user)
  const updateUser = useAuthStore(s => s.updateUser)
  
  const { playBGM, stopBGM, playSFX } = useBossSound()
  
  const [loading,       setLoading]       = useState(true)
  // 'intro' | 'battle' | 'cleared' | 'failed'
  const [phase,         setPhase]         = useState('intro')
  const [bossData,      setBossData]      = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [selectedOption,  setSelectedOption]  = useState(null)
  const [answerInput,     setAnswerInput]     = useState('')
  const [aiResult,        setAiResult]        = useState(null)
  const [errorMsg,        setErrorMsg]        = useState('')

  // HP & 전투 상태 (엔드보스: 1200/1800)
  const BOSS_HP_INIT = 1800
  const MY_HP_INIT   = 1200
  const [myHp,       setMyHp]       = useState(MY_HP_INIT)
  const [bossHp,     setBossHp]     = useState(BOSS_HP_INIT)

  // 애니메이션 상태
  const [bossShake,    setBossShake]    = useState(false)
  const [myShake,      setMyShake]      = useState(false)
  const [bossHit,      setBossHit]      = useState(false)
  const [screenShake,  setScreenShake]  = useState(false)
  const [attackAnim,   setAttackAnim]   = useState(false)
  const [dmgPopup,     setDmgPopup]     = useState(null)

  // 엔드보스 상태
  const [endbossState, setEndbossState] = useState({
    project: null,
    phase: 1,
    phase1Questions: [],
    phase2Questions: [],
    phase3FirstQuestion: null,
    phase1Index: 0,
    phase2Index: 0,
    phase3Tries: 0,
    nextPhase3Question: null
  })

  // 레벨업 정보
  const [initialLevel,    setInitialLevel]    = useState(1)
  const [levelUpMessage,  setLevelUpMessage]  = useState('')

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

  // ── 공격 이펙트 ──
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

  // ── 피격 이펙트 ──
  const playHitEffect = () => {
    playSFX('hit')
    setMyShake(true)
    setScreenShake(true)
    setTimeout(() => {
      setMyShake(false)
      setScreenShake(false)
    }, 600)
  }

  // ── 전투 시작 ──
  const handleStart = async (project = null) => {
    setMyHp(MY_HP_INIT)
    setBossHp(BOSS_HP_INIT)
    setAiResult(null)
    setSelectedOption(null)
    setAnswerInput('')
    setLoading(true)
    try {
      if (!project) throw new Error("프로젝트를 선택해주세요.")
      const res = await endbossApi.startBattle(project)
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
        nextPhase3Question: null
      })
      setCurrentQuestion(d.phase1_questions[0])
      setMyHp(d.my_hp)
      setBossHp(d.boss_hp)
      playBGM('endboss_intro')
      setPhase('battle')
      setErrorMsg('')
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || '도전 비용이 부족합니다!')
    } finally {
      setLoading(false)
    }
  }

  // ── 정답 제출 ──
  const handleSubmit = async () => {
    if (!currentQuestion) return
    const isCodeType  = currentQuestion.type === 'code_input' || currentQuestion.type === 'fill_in_blank'
    const userAnswer  = isCodeType ? answerInput : selectedOption
    if (!userAnswer) return

    setLoading(true)
    try {
      const res = await endbossApi.submitAnswer({
        question_id:     currentQuestion.question_id,
        user_answer:     userAnswer,
        phase:           endbossState.phase,
        my_hp:           myHp,
        boss_hp:         bossHp,
        phase3_tries:    endbossState.phase3Tries,
        project:         endbossState.project
      })

      const d = res.data
      const isCorrect = d.is_correct
      const nextMyHp = d.my_hp
      const nextBossHp = d.boss_hp
      const isClear = d.is_clear
      const isFail = d.is_fail

      setAiResult(d)
      setMyHp(nextMyHp)
      setBossHp(nextBossHp)

      const damage = bossHp - nextBossHp

      if (isCorrect) {
        playAttackEffect(damage > 0 ? damage : 150)
        if (isClear) {
          setTimeout(async () => {
            try {
              await endbossApi.clearBoss(endbossState.project)
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
          setEndbossState(prev => ({ ...prev, phase: 3 }))
        }
      } else {
        playHitEffect()
        if (isFail) {
          setTimeout(() => { playBGM('fail'); setPhase('failed') }, 2500)
        }
        if (endbossState.phase === 3) {
          setEndbossState(prev => ({
            ...prev,
            phase3Tries: d.phase3_tries,
            nextPhase3Question: d.next_phase3_question
          }))
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // ── 다음 문제 ──
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
          setEndbossState(prev => ({ ...prev, phase: 2, phase2Index: 0 }))
          setCurrentQuestion(endbossState.phase2Questions[0])
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

  // ── 렌더링 ──
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

      <div className="boss-container container">
        {phase === 'intro' && (
          <EndBossIntro
            bossData={bossData}
            errorMsg={errorMsg}
            onStart={handleStart}
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
    </div>
  )
}
