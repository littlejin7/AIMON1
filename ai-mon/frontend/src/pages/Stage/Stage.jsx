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
  const loadedStageRef        = useRef(null)
  // 이 세션에서 미니보스 패배가 발생했음을 기록 — 서버 저장 실패 시에도
  // 체크포인트 복원 자동 재진입을 클라이언트 측에서 차단하는 보조 가드
  const minibossDefeatedRef   = useRef(false)
  // quiz 답안 누적 (question_id → attempt payload). 완료 직전 flush 에 사용.
  // miniboss/code_input 은 제외 — 각각 서버 battle session / /code/submit 이 권위.
  const sessionAnswersRef     = useRef(new Map())
  
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
  // 미니보스 HP 누적(서버 응답으로 갱신) — 표시용. 클리어/패배는 서버 세션이 판정.
  const [minibossHp,         setMinibossHp]         = useState({ my_hp: 900, boss_hp: 500 })
  // 서버 권위 배틀 토큰: /start 에서 발급받아 /answer·/clear 마다 동봉.
  const [minibossToken,      setMinibossToken]      = useState(null)

  // ── 브리핑 상태 ──
  const [briefings,     setBriefings]     = useState([])
  const [briefingIndex, setBriefingIndex] = useState(0)
  const [showBriefing,  setShowBriefing]  = useState(true)

  // ── 진행 상태 초기화 (attempt 는 호출부가 결정) ──
  // attempt 를 건드리지 않으므로, 신규 진입(Set A)과 실패 재도전(다음 Set)이
  // 같은 로직을 공유하되 어떤 세트를 받을지는 호출부가 setAttempt 로 정한다.
  const resetProgressState = () => {
    setCurrent(0)
    setScore(0)
    setCorrect(0)
    setFinished(false)
    setShowBriefing(true)
    setBriefingIndex(0)
    setCorrectQuestions([])
    setMinibossStartIndex(null)
    setStageQuizCorrect(0)
    setMinibossHp({ my_hp: 900, boss_hp: 500 })
    setLoading(true)
    setShowMinibossAlert(false)
    sessionAnswersRef.current = new Map()   // 재도전/재시작 시 누적 답안 초기화
    setRetryTick(t => t + 1)
  }

  // ── 신규 스테이지 진입: 항상 Set A(attempt=1)부터 ──
  const resetStageState = () => {
    minibossDefeatedRef.current = false
    setAttempt(1)
    resetProgressState()
  }

  // ── 실패 재도전: 직전과 다른 세트(attempt+1)로 처음부터 ──
  const retryWithNextSet = () => {
    setAttempt(prev => prev + 1)
    resetProgressState()
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

        // 브리핑은 신규 진입(attempt===1)에서만. 재도전(attempt>1)은 바로 퀴즈로.
        let shouldShowBriefing = false
        if (attempt === 1 && lessonData?.slides?.length > 0) {
          setBriefings(lessonData.slides)
          shouldShowBriefing = true
        } else {
          setBriefings(lessonData?.slides ?? [])
        }

        // 미니보스 체크포인트 복원
        const existing = progressData.find(
          p => p.unit === parseInt(lessonId, 10) && p.stage === stageKey
        )

        let startMini = false
        let finalQuestions = questionsData

        if (existing?.checkpoint === 'miniboss_ready' && !existing?.is_completed && questionsData.length > 0 && !minibossDefeatedRef.current) {
          try {
            const res = await minibossApi.startBattle(lessonId, stageKey)
            setMinibossToken(res.data.battle_token)
            const miniQuestions = res.data.questions
            finalQuestions = [...questionsData, ...miniQuestions]
            shouldShowBriefing = false
            startMini = true
            setCurrent(questionsData.length)
            setMinibossStartIndex(questionsData.length)
            setStageQuizCorrect(0)
            setCorrect(0)
            setMinibossHp({ my_hp: 900, boss_hp: 500 })
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
    alert('개념 퀴즈를 60% 이상 맞춰야 미니보스에 도전할 수 있어요! 다시 도전해봐요 💪')
    // attempt+1 로 직전과 다른 세트를 재fetch (useEffect 트리거).
    retryWithNextSet()
  }


  // ── [임시] 미니보스 바로가기 ──
  const handleSkipToMiniboss = async () => {
    try {
      const stageKey = `${lessonId}-${stageNum}`
      const res = await minibossApi.startBattle(lessonId, stageKey)
      setMinibossToken(res.data.battle_token)
      const miniQuestions = res.data.questions.map(q => shuffleChoices(q))
      setQuestions(miniQuestions)
      setMinibossStartIndex(0)
      setStageQuizCorrect(0)
      setCorrect(0)
      setScore(0)
      setCurrent(0)
      setFinished(false)
      setMinibossHp({ my_hp: 900, boss_hp: 500 })
      playBGM('miniboss_intro')
      setShowMinibossAlert(true)
    } catch (err) {
      alert('미니보스 로드 실패: ' + (err?.message || err))
    }
  }

  
  // ── 미니보스 패배 처리 (오답 3회 누적 = my_hp 0) ──
  // 체크포인트를 concept_quiz 로 되돌려 새로고침 시 미니보스 자동 재진입을 막는다.
  // 저장 실패 시 1회 재시도, 재시도까지 실패하면 ref 플래그로 이 세션 내 자동 재진입을 차단.
  const handleMinibossDefeat = async () => {
    // ref 플래그를 즉시 세팅 — 저장 성공 여부와 무관하게 이 세션은 재진입 불가
    minibossDefeatedRef.current = true
    if (token) {
      const payload = {
        unit: parseInt(lessonId, 10),
        stage: `${lessonId}-${stageNum}`,
        score: 0,
        is_completed: false,
        checkpoint: 'concept_quiz',
      }
      try {
        await progressApi.saveProgress(payload)
      } catch (err) {
        console.error('미니보스 패배 체크포인트 저장 실패 (1차)', err)
        try {
          await progressApi.saveProgress(payload)
        } catch (retryErr) {
          // 재시도까지 실패 — ref 플래그가 이미 세팅돼 있어 이 세션 내 자동 재진입은 차단됨
          console.error('미니보스 패배 체크포인트 저장 실패 (재시도)', retryErr)
        }
      }
    }
    stopBGM()
    playBGM('fail')
    setFinished(true)
  }

  // ── 미니보스 재도전: 같은 문제 재생이 아니라 개념 Set B 를 처음부터 재학습 ──
  const handleMinibossRetry = () => {
    retryWithNextSet()
  }

  // ── 개념 퀴즈부터 다시 도전 (체크포인트 초기화 + 다음 세트) ──
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
    retryWithNextSet()
  }

  // ── 채점 겸 기록 (단일 서버 경로, F) ──
  // 클라는 정답을 모른다(서버가 strip). 답안마다 서버가 채점하고 그 결과를 돌려준다.
  //   - 미니보스: /boss/miniboss/answer (배틀 세션이 채점·HP·클리어 소유)
  //   - code_input: /code/submit 결과를 clientIsCorrect 로 받아 중계 + 기록
  //   - 객관식/단답: /attempts 가 user_answer 를 grade_objective 로 서버 재채점 + 기록
  // 반환: { is_correct, feedback, hint, correct_answer } — QuizCard 가 reveal 에 사용.
  const handleAnswer = async ({ userAnswer, retried, clientIsCorrect }) => {
    const q = questions[current]
    const isVillain = q?.quiz_category === 'miniboss'
    const qType = q?.quiz_type || q?.type
    const isCodeType = qType === 'code_input'
    const qid = q?.question_id || q?.id || ''

    let isCorrect = false
    let result = { is_correct: false, feedback: '', hint: '', correct_answer: '' }

    if (isVillain) {
      // 미니보스: 서버 배틀 세션이 단일 권위. code_input 은 /code/submit 결과를 중계.
      const res = await minibossApi.submitAnswer({
        question_id: qid,
        user_answer: isCodeType ? '' : (userAnswer ?? ''),
        code_is_correct: isCodeType ? !!clientIsCorrect : undefined,
        unit: parseInt(lessonId, 10),
        stage: `${lessonId}-${stageNum}`,
        battle_token: minibossToken,
      })
      const data = res?.data || {}
      isCorrect = !!data.is_correct
      result = {
        is_correct: isCorrect,
        feedback: data.feedback || '',
        hint: data.hint || '',
        correct_answer: data.correct_answer ?? '',
      }
      setMinibossHp({
        my_hp:   data.my_hp   ?? minibossHp.my_hp,
        boss_hp: data.boss_hp ?? minibossHp.boss_hp,
      })
      if (data.is_fail) {
        await handleMinibossDefeat()
        return result   // 점수/정답 누적·다음 진행 중단
      }
    } else if (isCodeType) {
      // 코드: /code/submit(QuizCard)가 채점 권위 → 결과 중계 + 전수 기록.
      isCorrect = !!clientIsCorrect
      result = { is_correct: isCorrect, feedback: '', hint: '', correct_answer: '' }
      try {
        const res = await attemptsApi.record({
          question_id: qid, unit: parseInt(lessonId, 10), stage: `${lessonId}-${stageNum}`,
          level: courseLevel, mode: 'quiz', is_correct: isCorrect, user_answer: undefined,
        })
        const d = res?.data || {}
        isCorrect = !!d.is_correct
        result = { is_correct: isCorrect, feedback: d.feedback || '', hint: d.hint || '', correct_answer: d.correct_answer ?? '' }
      } catch { /* 기록 실패는 무시 — 코드 결과는 이미 /code/submit 가 확정 */ }
    } else {
      // 객관식/단답: 서버가 user_answer 를 재채점(단일 채점 겸 기록 경로).
      // token 유무와 무관하게 호출 — 비로그인 1-1 공개 구간은 서버가 익명 채점(기록 생략).
      const res = await attemptsApi.record({
        question_id: qid, unit: parseInt(lessonId, 10), stage: `${lessonId}-${stageNum}`,
        level: courseLevel, mode: 'quiz', is_correct: false, user_answer: userAnswer,
      })
      const d = res?.data || {}
      isCorrect = !!d.is_correct
      result = { is_correct: isCorrect, feedback: d.feedback || '', hint: d.hint || '', correct_answer: d.correct_answer ?? '' }
      // 완료 게이트 폴백용: 서버가 재채점할 (qid, 첫 답안) 누적.
      // 게이트는 'qid별 첫 시도 정답'만 집계하므로 폴백도 '첫 답안'을 보존한다.
      // 이미 키가 있으면 덮지 않음 → 재시도 정답이 첫 오답을 가리지 못한다(엿보기 차단).
      if (token && qid && !sessionAnswersRef.current.has(qid)) {
        sessionAnswersRef.current.set(qid, { question_id: qid, user_answer: userAnswer })
      }
    }

    // 점수 누적 — 서버 채점 결과 기준, 재시도(retried)는 점수 미반영
    if (!retried) {
      setScore(prev => prev + (isCorrect ? 20 : 0))
      setCorrect(prev => prev + (isCorrect ? 1 : 0))
    }
    if (isCorrect && qid) {
      setCorrectQuestions(prev => [...prev, qid])
    }

    return result
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
          setMinibossToken(res.data.battle_token)
          const miniQuestions = res.data.questions.map(q => shuffleChoices(q))
          setQuestions(prev => [...prev, ...miniQuestions])
          setMinibossStartIndex(current + 1)
          setStageQuizCorrect(correct)
          setMinibossHp({ my_hp: 900, boss_hp: 500 })
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
            stage: `${lessonId}-${stageNum}`,
            battle_token: minibossToken,   // 서버 세션 won 검증용
          })
        } catch (err) {
          console.error("미니보스 클리어 API 실패", err)
        }
      }

      // 완료 케이스: 각 답안은 이미 handleAnswer 에서 서버 채점·기록을 await 했다(race 해소).
      // 그래도 개별 record POST 가 유실됐을 때를 위해 sessionAnswersRef 의 (qid, 답안)을
      // answered_questions 로 함께 보낸다 → 서버가 grade_objective 로 재채점해 게이트에 합산.
      let answeredQuestions = []
      if (totalScore >= 80 && token) {
        answeredQuestions = Array.from(sessionAnswersRef.current.values())
      }

      const res = await progressApi.saveProgress({
        unit: parseInt(lessonId, 10),
        stage: `${lessonId}-${stageNum}`,
        score: totalScore,
        is_completed: totalScore >= 80,
        checkpoint: totalScore >= 80 ? 'done' : (minibossStartIndex !== null ? 'miniboss_ready' : 'concept_quiz'),
        ...(answeredQuestions.length > 0 ? { answered_questions: answeredQuestions } : {}),
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
          retryWithNextSet={retryWithNextSet}
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
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>✕</button>
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
