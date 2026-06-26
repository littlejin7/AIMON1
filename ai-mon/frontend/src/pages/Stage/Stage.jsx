import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quizApi, progressApi, minibossApi, attemptsApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import useBossSound from '../../hooks/useBossSound'
import StageBriefing from './StageBriefing'
import MiniBossAlert from './MiniBossAlert'
import StageQuiz from './StageQuiz'
import StageResult from './StageResult'
import TitleEarnedModal from '../../components/TitleEarnedModal/TitleEarnedModal'
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
    let answerIndex = labels.indexOf(question.answer)

    // answer가 "A"/"B"가 아닌 텍스트(예: "p", "yth")로 저장된 경우:
    // choices 텍스트 부분에서 answer와 일치하는 항목을 찾아 레이블로 변환
    if (answerIndex === -1) {
      const texts = question.choices.map(c => c.replace(/^[A-D]\.\s*/, ''))
      const matchIdx = texts.findIndex(t => t === question.answer)
      if (matchIdx === -1) return question  // 매칭 실패 → 원본 반환
      question = { ...question, answer: labels[matchIdx] }
      answerIndex = matchIdx
    }

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
  const loadedStageRef = useRef(null)
  
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
  const [newlyEarnedTitles, setNewlyEarnedTitles] = useState([])

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
    const stageKey = `${lessonId}-${stageNum}`
    if (loadedStageRef.current !== null && loadedStageRef.current !== stageKey) {
      loadedStageRef.current = stageKey
      resetStageState()
      return
    }
    loadedStageRef.current = stageKey

    if (!loading) return

    const fetchUnit = quizApi.getUnit(lessonId, courseLevel).then(r => r.data).catch(() => null)

    const formattedLessonId = `${lessonId}-${stageNum}-${courseLevel}`
    const fetchSlides = quizApi.getLesson(formattedLessonId, courseLevel).then(r => r.data).catch(() => null)

    const fetchQuestions = quizApi.getQuestions({
      unit: lessonId,
      stage: `${lessonId}-${stageNum}`,
      course_level: courseLevel,
      limit: 10,
      attempt,
    }).then(r => r.data).catch(() => [])

    const fetchProgress = token
      ? progressApi.getProgress(courseLevel).then(r => r.data).catch(() => [])
      : Promise.resolve([])

    Promise.all([fetchUnit, fetchSlides, fetchQuestions, fetchProgress])
      .then(async ([unitData, lessonData, questionsData, progressData]) => {
        setUnitInfo(unitData)

        let shouldShowBriefing = false
        if (lessonData?.slides?.length > 0) {
          setBriefings(lessonData.slides)
          shouldShowBriefing = true
        } else {
          setBriefings([])
        }

        // 미니보스 체크포인트 복원
        const existing = progressData.find(
          p => p.unit === parseInt(lessonId, 10) && p.stage === stageKey
        )

        let startMini = false
        let finalQuestions = questionsData

        if (existing?.checkpoint === 'miniboss_ready' && !existing?.is_completed && questionsData.length > 0) {
          try {
            const res = await minibossApi.startBattle(lessonId, stageKey)
            const miniQuestions = res.data.questions
            finalQuestions = [...questionsData, ...miniQuestions]
            shouldShowBriefing = false
            startMini = true
            setCurrent(questionsData.length)
            setMinibossStartIndex(questionsData.length)
            setStageQuizCorrect(0)
            setCorrect(0)
          } catch (err) {
            console.error("체크포인트 미니보스 로드 실패", err)
          }
        }

        setShowBriefing(shouldShowBriefing)
        setQuestions(finalQuestions.map(q => shuffleChoices(q)))
        setLoading(false)

        if (startMini) {
          setShowMinibossAlert(true)
          playBGM('miniboss_intro')
        }
      })
  }, [lessonId, stageNum, courseLevel, attempt, token, retryTick, loading])

  // ── 스테이지 퀴즈 실패 (60% 미만) ──
  const handleStageQuizFailure = () => {
    setCorrectQuestions([])
    setCurrent(0)
    setScore(0)
    setCorrect(0)
    setFinished(false)
    setShowBriefing(false)
    setLoading(true)
    alert('개념 퀴즈를 60% 이상 맞춰야 미니보스에 도전할 수 있어요! 다시 도전해봐요 💪')
    // setAttempt이 useEffect를 트리거해 자동으로 새 문제를 로드하므로 별도 fetch 불필요
    setAttempt(prev => prev + 1)
  }


  // ── [임시] 미니보스 바로가기 ──
  const handleSkipToMiniboss = async () => {
    try {
      const stageKey = `${lessonId}-${stageNum}`
      const res = await minibossApi.startBattle(lessonId, stageKey)
      const miniQuestions = res.data.questions.map(q => shuffleChoices(q))
      setQuestions(miniQuestions)
      setMinibossStartIndex(0)
      setStageQuizCorrect(0)
      setCorrect(0)
      setScore(0)
      setCurrent(0)
      setFinished(false)
      playBGM('miniboss_intro')
      setShowMinibossAlert(true)
    } catch (err) {
      alert('미니보스 로드 실패: ' + (err?.message || err))
    }
  }

  
  // ── 미니보스 재도전 ──
  const handleMinibossRetry = () => {
    setCurrent(minibossStartIndex)
    setCorrect(stageQuizCorrect)
    setScore(stageQuizCorrect * 20)
    setFinished(false)
  }

  // ── 개념 퀴즈부터 다시 도전 (체크포인트 초기화) ──
  const handleRestartFromBeginning = async () => {
    if (token) {
      try {
        await progressApi.saveProgress({
          unit: parseInt(lessonId, 10),
          stage: `${lessonId}-${stageNum}`,
          score: 0,
          is_completed: false,
          checkpoint: 'concept_quiz',
        })
      } catch (err) {
        console.error("체크포인트 초기화 실패", err)
      }
    }
    resetStageState()
  }

  const handleAnswer = async ({ correct: isCorrect, retried }) => {
    const isVillain = questions[current]?.quiz_category === 'miniboss'

    // 풀이 전수 기록 (정오답 무관, retry 포함). 미니보스는 서버 /answer 가 기록하므로 제외.
    if (!isVillain && token && questions[current]) {
      attemptsApi.record({
        question_id: questions[current].question_id || questions[current].id || '',
        unit:        parseInt(lessonId, 10),
        stage:       `${lessonId}-${stageNum}`,
        level:       courseLevel,
        mode:        'quiz',
        is_correct:  !!isCorrect,
      }).catch(() => { /* 전수 기록 실패는 무시 (fire-and-forget) */ })
    }

    if (isVillain && !retried && token) {
      try {
        await minibossApi.submitAnswer({
          question_id: questions[current].question_id,
          user_answer: isCorrect ? questions[current].answer : 'wrong', // Simplified for client logic
          unit: parseInt(lessonId, 10),
          stage: `${lessonId}-${stageNum}`,
          my_hp: 900, boss_hp: 500 // Server handles actual HP clamping and reduction
        })
      } catch (err) {
        console.error('Failed to submit miniboss answer', err)
      }
    }

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

    // 모든 문제 완료 시도
    if (current + 1 >= questions.length) {
      // 1. 스테이지 퀴즈 완료 -> 미니보스로 전환
      if (currentCategory === 'stage_quiz' && minibossStartIndex === null) {
        const stageQuizScore = Math.round((correct / questions.length) * 100)
        if (stageQuizScore < 60) {
          handleStageQuizFailure()
          return
        }
        
        // 미니보스 문제 로드
        try {
          const res = await minibossApi.startBattle(lessonId, `${lessonId}-${stageNum}`)
          const miniQuestions = res.data.questions.map(q => shuffleChoices(q))
          setQuestions(prev => [...prev, ...miniQuestions])
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
        } catch (err) {
          console.error("미니보스 시작 실패", err)
          // 미니보스가 없다면 그대로 스테이지 클리어로 진행
        }
      }
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

      // 미니보스 클리어 처리
      if (minibossStartIndex !== null && token) {
        try {
          await minibossApi.clearBoss({
            unit: parseInt(lessonId, 10),
            stage: `${lessonId}-${stageNum}`
          })
        } catch (err) {
          console.error("미니보스 클리어 API 실패", err)
        }
      }

      const res = await progressApi.saveProgress({
        unit: parseInt(lessonId, 10),
        stage: `${lessonId}-${stageNum}`,
        score: totalScore,
        is_completed: totalScore >= 80,
        checkpoint: totalScore >= 80 ? 'done' : (minibossStartIndex !== null ? 'miniboss_ready' : 'concept_quiz'),
      })

      if (res?.data) {
        setXpAwarded(res.data.xp_awarded || 0)

        if (res.data.newly_earned_titles && res.data.newly_earned_titles.length > 0) {
          setNewlyEarnedTitles(res.data.newly_earned_titles)
        }

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
      <>
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
          handleRestartFromBeginning={handleRestartFromBeginning}
          resetStageState={resetStageState}
          evoModal={evoModal}
          setEvoModal={setEvoModal}
        />
        {newlyEarnedTitles.length > 0 && (
          <TitleEarnedModal
            titles={newlyEarnedTitles}
            onClose={() => setNewlyEarnedTitles([])}
          />
        )}
      </>
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
        unitInfo={unitInfo}
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
    <>
      {/* [임시] 미니보스 바로가기 버튼 */}
      {minibossStartIndex === null && (
        <button
          onClick={handleSkipToMiniboss}
          style={{
            position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
            background: '#ff4d4f', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '10px 16px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          ⚔️ [임시] 미니보스 바로가기
        </button>
      )}
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
    </>
  )
}
