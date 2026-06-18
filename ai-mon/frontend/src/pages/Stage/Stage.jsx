import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quizApi, progressApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import useBossSound from '../../hooks/useBossSound'
import StageBriefing from './StageBriefing'
import MiniBossAlert from './MiniBossAlert'
import StageQuiz from './StageQuiz'
import StageResult from './StageResult'
import './Stage.css'

const EVOLUTION_MAP = {
  10: { from: 'slime',         to: 'robot' },
  20: { from: 'robot',         to: 'speech_bubble' },
  30: { from: 'speech_bubble', to: 'final_ghost' },
}

function shuffleChoices(question) {
  if (question.type === 'error_find' || question.type === 'fill_in_blank') return question
  const labels = ['A', 'B', 'C', 'D']
  const hasLetterPrefix = /^[A-D]\.\s/.test(question.choices?.[0] ?? '')
  if (hasLetterPrefix) {
    const answerIndex = labels.indexOf(question.answer)
    if (answerIndex === -1) return question
    const correctText = question.choices[answerIndex].replace(/^[A-D]\.\s*/, '')
    const texts = question.choices.map(c => c.replace(/^[A-D]\.\s*/, ''))
    const shuffled = [...texts].sort(() => Math.random() - 0.5)
    const newChoices = shuffled.map((t, i) => `${labels[i]}. ${t}`)
    return { ...question, choices: newChoices, answer: labels[shuffled.indexOf(correctText)] }
  } else {
    return { ...question, choices: [...question.choices].sort(() => Math.random() - 0.5) }
  }
}

export default function Stage({ _lessonId, _stage }) {
  const params    = useParams()
  const lessonId  = _lessonId || params.lessonId
  const stage     = _stage    || params.stage
  const navigate  = useNavigate()
  const stageNum  = parseInt(stage, 10)

  const token      = useAuthStore((s) => s.token)
  const user       = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const courseLevel = user?.course_level || 'beginner'
  const { playBGM, stopBGM, playSFX } = useBossSound()
  
  // ── 퀴즈 진행 상태 ──
  const [questions,        setQuestions]        = useState([])
  const [current,          setCurrent]          = useState(0)
  const [score,            setScore]            = useState(0)
  const [correct,          setCorrect]          = useState(0)
  const [correctQuestions, setCorrectQuestions] = useState([])
  const [finished,         setFinished]         = useState(false)
  const [loading,          setLoading]          = useState(true)
  const [attempt,          setAttempt]          = useState(1)
  const [retryTick,        setRetryTick]        = useState(0)

  // ── 결과 상태 ──
  const [xpAwarded,     setXpAwarded]     = useState(0)
  const [unitInfo,      setUnitInfo]      = useState(null)
  const [evoModal,      setEvoModal]      = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)

  // ── 미니보스 상태 ──
  const [showMinibossAlert,  setShowMinibossAlert]  = useState(false)
  const [minibossStartIndex, setMinibossStartIndex] = useState(null)
  const [stageQuizCorrect,   setStageQuizCorrect]   = useState(0)

  // ── 브리핑 상태 ──
  const [briefings,     setBriefings]     = useState([])
  const [briefingIndex, setBriefingIndex] = useState(0)
  const [showBriefing,  setShowBriefing]  = useState(true)

  // ── 스테이지 초기화 ──
  const resetStageState = () => {
    setAttempt(1)
    setCurrent(0)
    setScore(0)
    setCorrect(0)
    setFinished(false)
    setShowBriefing(true)
    setBriefingIndex(0)
    setCorrectQuestions([])
    setMinibossStartIndex(null)
    setStageQuizCorrect(0)
    setLoading(true)
    setShowMinibossAlert(false)
    setRetryTick(t => t + 1)
  }

  // ── 데이터 로드 ──
  useEffect(() => {
    const fetchUnit = quizApi.getUnit(lessonId, courseLevel).then(r => r.data).catch(() => null)

    const formattedLessonId = `${lessonId}-${stageNum}-${courseLevel}`
    const fetchSlides = quizApi.getLesson(formattedLessonId, courseLevel).then(r => r.data).catch(() => null)

    const fetchQuestions = quizApi.getQuestions({
      unit: lessonId,
      stage: `${lessonId}-${stageNum}`,
      course_level: courseLevel,
      limit: 20,
      attempt,
    }).then(r => r.data).catch(() => [])

    const fetchProgress = token
      ? progressApi.getProgress().then(r => r.data).catch(() => [])
      : Promise.resolve([])

    Promise.all([fetchUnit, fetchSlides, fetchQuestions, fetchProgress])
      .then(([unitData, lessonData, questionsData, progressData]) => {
        setUnitInfo(unitData)

        let shouldShowBriefing = false
        if (lessonData?.slides?.length > 0) {
          setBriefings(lessonData.slides)
          shouldShowBriefing = true
        } else {
          setBriefings([])
        }

        // 미니보스 체크포인트 복원
        const stageKey = `${lessonId}-${stageNum}`
        const existing = progressData.find(
          p => p.unit === parseInt(lessonId, 10) && p.stage === stageKey
        )

        let startMini = false
        if (existing?.checkpoint === 'miniboss_ready' && !existing?.is_completed && questionsData.length > 0) {
          const miniIndex = questionsData.findIndex(q => q.quiz_category === 'miniboss')
          if (miniIndex !== -1) {
            shouldShowBriefing = false
            startMini = true
            setCurrent(miniIndex)
            setMinibossStartIndex(miniIndex)
            setStageQuizCorrect(0)
            setCorrect(0)
          }
        }

        setShowBriefing(shouldShowBriefing)
        setQuestions(questionsData.map(q => shuffleChoices(q)))
        setLoading(false)

        if (startMini) {
          setShowMinibossAlert(true)
          playBGM('miniboss_intro')
        }
      })
  }, [lessonId, stageNum, courseLevel, attempt, token, retryTick])

  // ── 스테이지 퀴즈 실패 (60% 미만) ──
  const handleStageQuizFailure = () => {
    setCorrectQuestions([])
    setCurrent(0)
    setScore(0)
    setCorrect(0)
    setFinished(false)
    setShowBriefing(false)
    alert('개념 퀴즈를 60% 이상 맞춰야 미니보스에 도전할 수 있어요! 다시 도전해봐요 💪')
    // setAttempt이 useEffect를 트리거해 자동으로 새 문제를 로드하므로 별도 fetch 불필요
    setAttempt(prev => prev + 1)
  }

  // ── 미니보스 재도전 ──
  const handleMinibossRetry = () => {
    setCurrent(minibossStartIndex)
    setCorrect(stageQuizCorrect)
    setScore(stageQuizCorrect * 20)
    setFinished(false)
  }

  // ── 정답 처리 ──
  const handleAnswer = ({ correct: isCorrect, retried }) => {
    const pts = (isCorrect && !retried) ? 20 : 0
    setScore(prev => prev + pts)
    setCorrect(prev => prev + ((isCorrect && !retried) ? 1 : 0))
    if (isCorrect) {
      setCorrectQuestions(prev => [...prev, questions[current].question_id])
    }
  }

  // ── 다음 문제 / 완료 처리 ──
  const handleNext = async () => {
    const currentCategory = questions[current]?.quiz_category

    // 스테이지 퀴즈 → 미니보스 전환 시점 (동적으로 최초 미니보스 문제 직전 검출)
    const firstMinibossIndex = questions.findIndex(q => q.quiz_category === 'miniboss')
    const isTransitionToMiniboss = firstMinibossIndex !== -1 && (current + 1 === firstMinibossIndex)

    if (isTransitionToMiniboss) {
      const stageQuizCount = current + 1
      const stageQuizScore = Math.round((correct / stageQuizCount) * 100)
      if (stageQuizScore < 60) {
        handleStageQuizFailure()
        return
      }
      setMinibossStartIndex(current + 1)
      setStageQuizCorrect(correct)
      if (token) {
        progressApi.saveProgress({
          unit: parseInt(lessonId, 10),
          stage: `${lessonId}-${stageNum}`,
          score: stageQuizScore,
          is_completed: false,
          checkpoint: 'miniboss_ready',
        }).catch(err => console.error(err))
      }
      playBGM('miniboss_intro')
      setShowMinibossAlert(true)
      return
    }

    // 모든 문제 완료
    if (current + 1 >= questions.length) {
      if (currentCategory === 'stage_quiz') {
        const stageQuizScore = Math.round((correct / questions.length) * 100)
        if (stageQuizScore < 60) {
          handleStageQuizFailure()
          return
        }
      }

      // 비로그인 체험 (1-1)
      const isFreeTrial = String(lessonId) === '1' && stageNum === 1
      if (isFreeTrial && !token) {
        stopBGM()
        playBGM('clear')
        setFinished(true)
        setShowAuthModal(true)
        return
      }

      // 점수 계산
      let totalScore = Math.round((correct / questions.length) * 100)
      if (minibossStartIndex !== null) {
        const miniTotal   = questions.length - minibossStartIndex
        const miniCorrect = correct - stageQuizCorrect
        totalScore = Math.round((miniCorrect / miniTotal) * 100)
      }

      const prevLv   = user?.lv        || 1
      const prevChar = user?.character || 'slime'

      const res = await progressApi.saveProgress({
        unit: parseInt(lessonId, 10),
        stage: `${lessonId}-${stageNum}`,
        score: totalScore,
        is_completed: totalScore >= 80,
        checkpoint: 'done',
      })

      if (res?.data) {
        setXpAwarded(res.data.xp_awarded || 0)

        const newLv   = res.data.lv        || prevLv
        const newChar = res.data.character || prevChar

        // 진화 감지
        for (const [lvStr, evo] of Object.entries(EVOLUTION_MAP)) {
          const lvNum = Number(lvStr)
          if (prevLv < lvNum && newLv >= lvNum) {
            setEvoModal({ fromChar: evo.from, toChar: evo.to, newLevel: lvNum })
            break
          }
        }

        if (newLv !== prevLv || newChar !== prevChar) {
          updateUser({ ...user, lv: newLv, character: newChar })
        }
      }

      stopBGM()
      if (totalScore >= 80) playBGM('clear')
      else                  playBGM('fail')
      setFinished(true)
    } else {
      setCurrent(prev => prev + 1)
    }
  }

  // ── 결과 계산 ──
  const isMinibossPlayed = minibossStartIndex !== null
  const evalTotalCount   = isMinibossPlayed ? questions.length - minibossStartIndex : questions.length
  const evalCorrectCount = isMinibossPlayed ? correct - stageQuizCorrect : correct
  const finalScore       = evalTotalCount > 0 ? Math.round((evalCorrectCount / evalTotalCount) * 100) : 0
  const passed           = finalScore >= 80

  // ── 렌더링 ──
  if (loading) {
    return <div className="stage-loading"><div className="spinner" /></div>
  }

  if (finished) {
    return (
      <StageResult
        passed={passed}
        finalScore={finalScore}
        evalTotalCount={evalTotalCount}
        evalCorrectCount={evalCorrectCount}
        isMinibossPlayed={isMinibossPlayed}
        xpAwarded={xpAwarded}
        unitInfo={unitInfo}
        stageNum={stageNum}
        lessonId={lessonId}
        showAuthModal={showAuthModal}
        setShowAuthModal={setShowAuthModal}
        handleMinibossRetry={handleMinibossRetry}
        resetStageState={resetStageState}
        evoModal={evoModal}
        setEvoModal={setEvoModal}
      />
    )
  }

  if (questions.length === 0) {
    return (
      <div className="stage-loading">
        <p>문제를 불러올 수 없습니다.</p>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>돌아가기</button>
      </div>
    )
  }

  if (showBriefing && briefings.length > 0) {
    return (
      <StageBriefing
        briefings={briefings}
        briefingIndex={briefingIndex}
        setBriefingIndex={setBriefingIndex}
        setShowBriefing={setShowBriefing}
        lessonId={lessonId}
        stageNum={stageNum}
      />
    )
  }

  if (showMinibossAlert) {
    return (
      <MiniBossAlert
        onFight={() => {
          setShowMinibossAlert(false)
          if (minibossStartIndex !== null) setCurrent(minibossStartIndex)
          playBGM('battle')
        }}
      />
    )
  }

  return (
    <StageQuiz
      lessonId={lessonId}
      stageNum={stageNum}
      questions={questions}
      current={current}
      score={score}
      minibossStartIndex={minibossStartIndex}
      handleAnswer={handleAnswer}
      handleNext={handleNext}
    />
  )
}
