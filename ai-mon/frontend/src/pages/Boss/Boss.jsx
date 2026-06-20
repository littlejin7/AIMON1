import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { bossApi, userApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import BossIntro  from './BossIntro'
import useBossSound from '../../hooks/useBossSound'
import BossBattle from './BossBattle'
import BossResult from './BossResult'
import TitleEarnedModal from '../../components/TitleEarnedModal/TitleEarnedModal'
import './Boss.css'

export default function Boss() {
  const { lessonId } = useParams()
  const navigate     = useNavigate()

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

  // HP & 전투 상태 (유닛보스: 1000/1000)
  const BOSS_HP_INIT = 1000
  const MY_HP_INIT   = 1000
  const [myHp,       setMyHp]       = useState(MY_HP_INIT)
  const [bossHp,     setBossHp]     = useState(BOSS_HP_INIT)
  const [wrongCount, setWrongCount] = useState(0)

  // 애니메이션 상태
  const [bossShake,    setBossShake]    = useState(false)
  const [myShake,      setMyShake]      = useState(false)
  const [bossHit,      setBossHit]      = useState(false)
  const [screenShake,  setScreenShake]  = useState(false)
  const [attackAnim,   setAttackAnim]   = useState(false)
  const [dmgPopup,     setDmgPopup]     = useState(null)

  // 레벨업 정보
  const [initialLevel,    setInitialLevel]    = useState(1)
  const [levelUpMessage,  setLevelUpMessage]  = useState('')
  const [newlyEarnedTitles, setNewlyEarnedTitles] = useState([])

  useEffect(() => {
    if (user) setInitialLevel(user.lv || 1)
  }, [user])

  useEffect(() => {
    bossApi.getInfo(lessonId).then(res => {
      setBossData(res.data)
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [lessonId])

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
  const handleStart = async () => {
    setMyHp(MY_HP_INIT)
    setBossHp(BOSS_HP_INIT)
    setWrongCount(0)
    setAiResult(null)
    setSelectedOption(null)
    setAnswerInput('')
    setLoading(true)
    try {
      const res = await bossApi.startBattle(lessonId)
      setCurrentQuestion(res.data)
      playBGM('unitboss_intro')
      setPhase('battle')
      setErrorMsg('')
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || '도전 비용이 부족합니다!')
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
      const res = await bossApi.submitAnswer({
        question_id:     currentQuestion.question_id,
        user_answer:     userAnswer,
        is_code_question: isCodeType,
        wrong_count:     wrongCount,
        my_hp:           myHp,
        boss_hp:         bossHp,
        unit:            parseInt(lessonId) || 1,
      })

      const d = res.data
      const isCorrect = d.is_correct
      const nextMyHp = d.my_hp
      const nextBossHp = d.boss_hp
      const nextWrongCount = d.wrong_count || wrongCount
      const isClear = d.is_clear
      const isFail = d.is_fail

      setAiResult(d)
      setMyHp(nextMyHp)
      setBossHp(nextBossHp)
      setWrongCount(nextWrongCount)

      const damage = bossHp - nextBossHp

      if (isCorrect) {
        playAttackEffect(damage > 0 ? damage : 150)
        if (isClear) {
          if (d.newly_earned_titles && d.newly_earned_titles.length > 0) {
            setNewlyEarnedTitles(d.newly_earned_titles)
          }
          setTimeout(async () => {
            try {
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
        }
      } else {
        playHitEffect()
        if (isFail) {
          setTimeout(() => { playBGM('fail'); setPhase('failed') }, 2500)
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
    if (myHp <= 0 || wrongCount >= 3) {
      setPhase('failed')
      return
    }
    setLoading(true)
    try {
      const nextRes = await bossApi.nextQuestion(lessonId)
      setCurrentQuestion(nextRes.data)
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
          onClick={() => { stopBGM(); navigate(`/lesson/${lessonId}`) }}
        >
          도망가기 🏃
        </button>
      </div>

      <div className="boss-container container">
        {phase === 'intro' && (
          <BossIntro
            bossData={bossData}
            errorMsg={errorMsg}
            onStart={handleStart}
          />
        )}

        {phase === 'battle' && currentQuestion && (
          <BossBattle
            bossData={bossData}
            currentQuestion={currentQuestion}
            bossHp={bossHp}
            myHp={myHp}
            wrongCount={wrongCount}
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
          <BossResult
            phase={phase}
            aiResult={aiResult}
            levelUpMessage={levelUpMessage}
            lessonId={lessonId}
            onRetry={handleStart}
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
