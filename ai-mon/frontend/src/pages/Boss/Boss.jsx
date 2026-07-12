import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { bossApi, userApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import BossIntro from './BossIntro'
import useBossSound from '../../hooks/useBossSound'
import BossBattle from './BossBattle'
import BossResult from './BossResult'
import TitleEarnedModal from '../../components/TitleEarnedModal/TitleEarnedModal'
import './Boss.css'

export default function Boss() {
  const { lessonId } = useParams()
  const navigate = useNavigate()

  const user = useAuthStore(s => s.user)
  const updateUser = useAuthStore(s => s.updateUser)

  const { playBGM, stopBGM, playSFX } = useBossSound()

  const [loading, setLoading] = useState(true)
  // 'intro' | 'battle' | 'cleared' | 'failed'
  const [phase, setPhase] = useState('intro')
  const [bossData, setBossData] = useState(null)
  // 서버 권위 배틀 토큰: /start 에서 발급받아 이후 /answer 마다 동봉. 클리어 판정은
  // 서버가 이 세션의 정답 누적으로 결정한다(클라 HP 권위 제거).
  const [battleToken, setBattleToken] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [answerInput, setAnswerInput] = useState('')
  const [aiResult, setAiResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  // HP & 전투 상태 (유닛보스: 1000/1000)
  const BOSS_HP_INIT = 1000
  const MY_HP_INIT = 1000
  const [myHp, setMyHp] = useState(MY_HP_INIT)
  const [bossHp, setBossHp] = useState(BOSS_HP_INIT)
  const [wrongCount, setWrongCount] = useState(0)

  // 애니메이션 상태
  const [bossShake, setBossShake] = useState(false)
  const [myShake, setMyShake] = useState(false)
  const [bossHit, setBossHit] = useState(false)
  const [screenShake, setScreenShake] = useState(false)
  const [attackAnim, setAttackAnim] = useState(false)
  const [dmgPopup, setDmgPopup] = useState(null)

  // 레벨업 정보
  const [initialLevel, setInitialLevel] = useState(1)
  const [levelUpMessage, setLevelUpMessage] = useState('')
  const [newlyEarnedTitles, setNewlyEarnedTitles] = useState([])

  // 제출 중복 방지 lock — React state(loading)는 비동기 반영이라 빠른 연타 첫 프레임을
  // 놓칠 수 있으므로 ref 로 즉시 차단한다(중복 /boss/answer 발사 방지).
  const submitLockRef = useRef(false)

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
    playSFX('unitboss_attack')
    setAttackAnim(true)
    setTimeout(() => {
      setBossHit(true)
      setBossShake(true)
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
      // 응답 형식: { question, battle_token }
      setBossData(prev => {
        if (!prev) return prev
        const freeAttempts = prev.free_attempts_per_day ?? 0
        const crownCost = prev.crown_cost_from_attempt ?? 1
        if (freeAttempts > 0) {
          return { ...prev, free_attempts_per_day: freeAttempts - 1 }
        }
        return { ...prev, crowns: Math.max(0, (prev.crowns ?? 0) - crownCost) }
      })
      setBattleToken(res.data.battle_token)
      setCurrentQuestion(res.data.question)
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
    const isCodeType = currentQuestion.type === 'code_input' || currentQuestion.type === 'fill_in_blank' || currentQuestion.type === 'code_multi_input'
    // error_find: 줄 클릭 UI 폐지 → 빈칸 직접 입력(answerInput)으로 채점
    const isTextAnswer = isCodeType || currentQuestion.type === 'error_find'
    const userAnswer = isTextAnswer ? answerInput : selectedOption
    if (!userAnswer) return

    // 이미 제출 진행 중이면 즉시 차단 (연타 방어) — state 반영 전이라도 ref 로 막힘
    if (submitLockRef.current) return
    submitLockRef.current = true

    setLoading(true)
    try {
      const res = await bossApi.submitAnswer({
        question_id: currentQuestion.question_id,
        user_answer: userAnswer,
        is_code_question: isCodeType,
        unit: parseInt(lessonId) || 1,
        battle_token: battleToken,   // 서버 세션 식별 (HP/오답수는 서버가 누적)
      })

      const d = res.data
      const isCorrect = d.is_correct
      const nextMyHp = d.my_hp
      const nextBossHp = d.boss_hp
      const nextWrongCount = d.wrong_count || wrongCount
      const isClear = d.is_clear
      const isFail = d.is_fail

      setMyHp(nextMyHp)
      setBossHp(nextBossHp)
      setWrongCount(nextWrongCount)

      const damage = bossHp - nextBossHp

      if (isCorrect) {
        playAttackEffect(damage > 0 ? damage : 150)
        setTimeout(() => setAiResult(d), 1100)
        if (isClear) {
          if (d.newly_earned_titles && d.newly_earned_titles.length > 0) {
            setNewlyEarnedTitles(d.newly_earned_titles)
          }
          setTimeout(async () => {
            try {
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
        }
      } else {
        setAiResult(d)
        playHitEffect()
        if (isFail) {
          setTimeout(() => { playBGM('fail'); setPhase('failed') }, 2500)
        }
      }
    } catch (err) {
      console.error(err)
      if (err.response?.status === 429) {
        setErrorMsg('잠시 후 다시 시도해주세요. (1분 요청 한도 초과)')
      } else {
        setErrorMsg(err.response?.data?.detail || '채점 중 오류가 발생했습니다. 다시 시도해주세요.')
      }
    } finally {
      // 성공·실패·grading_failed 무관하게 항상 해제 → API 실패 시 영구 disabled 방지,
      // 오답 후 재제출/다음 문제 이동 등 정상 플로우 유지.
      submitLockRef.current = false
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
      const nextRes = await bossApi.nextQuestion(lessonId, battleToken)
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
      <div className={`boss-container${phase === 'battle' ? ' boss-container-battle' : ' container'}`}>
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
            lessonId={lessonId}
            onSubmit={handleSubmit}
            onNextQuestion={handleNextQuestion}
            onEscape={() => { stopBGM(); navigate(`/lesson/${lessonId}`) }}
          />
        )}
        {/* 배틀 중 에러 토스트 */}
        {phase === 'battle' && errorMsg && (
          <div
            style={{
              position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
              background: '#1e1e2e', color: '#FF6B6B', border: '1px solid #FF6B6B',
              borderRadius: '12px', padding: '12px 24px', fontSize: '14px', fontWeight: 600,
              zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', maxWidth: '90vw', textAlign: 'center'
            }}
          >
            ⚠️ {errorMsg}
            <button
              onClick={() => setErrorMsg('')}
              style={{ marginLeft: '12px', background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '16px' }}
            >✕</button>
          </div>
        )}

        {(phase === 'cleared' || phase === 'failed') && (
          <BossResult
            phase={phase}
            aiResult={aiResult}
            levelUpMessage={levelUpMessage}
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
