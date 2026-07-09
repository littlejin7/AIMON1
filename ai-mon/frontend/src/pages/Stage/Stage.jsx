import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quizApi, progressApi, minibossApi, attemptsApi } from '../../api/index'
import { getApiErrorInfo, logApiError } from '../../api/client'
import { useAuthStore } from '../../hooks/useAuthStore'
import useBossSound from '../../hooks/useBossSound'
import StageBriefing from './StageBriefing'
import MiniBossAlert from './MiniBossAlert'
import StageQuiz from './StageQuiz'
import StageResult from './StageResult'
import TitleEarnedModal from '../../components/TitleEarnedModal/TitleEarnedModal'
import MiniBossGateModal from '../../components/MiniBossGateModal/MiniBossGateModal'
import InfoModal from '../../components/InfoModal/InfoModal'
import '../Boss/Boss.css'
import './Stage.css'

// evolution_stage(0~3) → 캐릭터 ID. 백엔드 character_for_stage 와 동일 기준.
// 진화는 엔드보스 클리어로만 발생하므로, 일반 스테이지 클리어 응답에서
// evolution_stage 가 바뀌는 일은 실제로는 없다 — 그래도 트리거 자체는 프론트
// 누적치/lv 계산이 아니라 항상 백엔드 user_state.evolution_stage 비교로만 판단한다.
const STAGE_TO_CHAR = { 0: 'slime', 1: 'robot', 2: 'speech_bubble', 3: 'final_ghost' }

function shuffleChoices(question) {
  if (!question || !question.choices) return question
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

// 문제 로드 실패(throw) 를 사용자용 사유 메시지로 변환.
// getApiErrorInfo 로 뽑은 { status, detail, message } 를 받아 { status, message } 반환.
// 서버가 detail 을 문자열로 준 경우(예: 403 "이전 스테이지(1-2)를 먼저 완료해주세요")는
// 어느 스테이지가 막혔는지까지 알려주므로 우선 노출한다.
function messageForLoadError(info) {
  const status = info?.status ?? null
  const detail = typeof info?.detail === 'string' ? info.detail : null
  if (status === 401) {
    return { status, message: detail || '로그인이 필요합니다.' }
  }
  if (status === 403) {
    return { status, message: detail || '이전 스테이지 완료 기록이 없어 진입할 수 없습니다.' }
  }
  return { status, message: '문제를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' }
}

// 완료(is_completed) 저장은 다음 스테이지 진입 게이트의 근거다 — 유실되면 진입 불가
// (실제 사례: de0040ab). fire-and-forget 대신 await + 실패 재시도(최대 attempts 회).
// 최종 실패는 throw 해서 호출부가 처리(미니보스 스테이지는 서버 clearBoss 가 이미
// 완료를 영속화했으므로 호출부에서 결과 화면은 계속 진행한다).
async function saveProgressWithRetry(payload, attempts = 3) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await progressApi.saveProgress(payload)
    } catch (err) {
      lastErr = err
      logApiError(`saveProgress 재시도 ${i + 1}/${attempts}`, err)
    }
  }
  throw lastErr
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
  // 문제 로드 실패 사유. { status, message } — null 이면 실패 없음.
  // "HTTP 200 + 빈 배열"(정상 응답이지만 데이터 없음)과 구분하기 위한 별도 상태.
  const [loadError,        setLoadError]        = useState(null)

  // ── 결과 상태 ──
  const [xpAwarded,     setXpAwarded]     = useState(0)
  const [gpAwarded,     setGpAwarded]     = useState(0)
  const [unitInfo,      setUnitInfo]      = useState(null)
  const [evoModal,      setEvoModal]      = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [newlyEarnedTitles, setNewlyEarnedTitles] = useState([])

  // ── 개념 퀴즈 실패(60% 미만) 안내 팝업 ──
  const [showQuizFailModal, setShowQuizFailModal] = useState(false)
  // ── 미니보스 로드 실패 안내 팝업(임시 바로가기 버튼 / 미니보스 재도전 공용) ──
  const [minibossLoadErrorMsg, setMinibossLoadErrorMsg] = useState(null)

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
    setShowQuizFailModal(false)
    setLoadError(null)
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

    // 직전 실패 사유는 이 로드를 트리거한 호출부(resetProgressState/handleLoadRetry)가
    // 이미 초기화했다 — 여기서 동기 setState 를 하지 않는다(cascading render 방지).

    const fetchUnit = quizApi.getUnit(lessonId, courseLevel)
      .then(r => r.data)
      .catch(err => { logApiError('GET /quiz/units', err); return null })

    const formattedLessonId = `${lessonId}-${stageNum}-${courseLevel}`
    const fetchSlides = quizApi.getLesson(formattedLessonId, courseLevel)
      .then(r => r.data)
      .catch(err => { logApiError('GET /quiz/lessons', err); return null })

    // 문제 로드만은 에러를 삼키지 않는다. 성공/실패를 봉투로 감싸 구분하고,
    // 실패 시 상태코드/detail 을 loadError 로 넘겨 빈 화면에 사유를 노출한다.
    //   { ok: true,  data }              → 정상(빈 배열 포함)
    //   { ok: false, error: {status,…} } → API 실패(401/403/500/네트워크)
    const fetchQuestions = quizApi.getQuestions({
      unit: lessonId,
      stage: `${lessonId}-${stageNum}`,
      course_level: courseLevel,
      limit: 10,
      attempt,
    })
      .then(r => ({ ok: true, data: r.data }))
      .catch(err => {
        logApiError('GET /quiz/questions', err)
        return { ok: false, error: getApiErrorInfo(err) }
      })

    const fetchProgress = token
      ? progressApi.getProgress(courseLevel)
          .then(r => r.data)
          .catch(err => { logApiError('GET /progress', err); return [] })
      : Promise.resolve([])

    Promise.all([fetchUnit, fetchSlides, fetchQuestions, fetchProgress])
      .then(async ([unitData, lessonData, questionsResult, progressData]) => {
        setUnitInfo(unitData)

        // 문제 로드 실패(throw) — 빈 배열로 뭉개지 않고 사유를 노출하고 여기서 종료.
        // 사용자가 사유를 보고 재시도를 선택하게 하며, navigate(-1) 자동 튕김을 하지 않는다.
        if (!questionsResult.ok) {
          setLoadError(messageForLoadError(questionsResult.error))
          setQuestions([])
          setLoading(false)
          return
        }
        const questionsData = questionsResult.data

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
            const res = await minibossApi.startBattle(lessonId, stageKey, attempt)
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
      .catch(err => {
        // 여기 도달 = 문제 로드 봉투 이후 처리(예: 미니보스 복원)에서 삼켜지지 않은 예외.
        // 스피너에 갇히지 않도록 사유를 노출하고 로딩을 종료한다.
        logApiError('스테이지 로드 처리 실패', err)
        setLoadError(messageForLoadError(getApiErrorInfo(err)))
        setLoading(false)
      })
  }, [lessonId, stageNum, courseLevel, attempt, token, retryTick, loading])

  // ── 스테이지 퀴즈 실패 (60% 미만) ──
  // 브라우저 alert() 대신 현재 화면 위에 뜨는 모달(MiniBossGateModal)로 안내.
  // 페이지 전환 없이 "확인"을 누르면 재도전(retryWithNextSet)이 실행된다.
  const handleStageQuizFailure = () => {
    setShowQuizFailModal(true)
  }

  const handleQuizFailModalConfirm = () => {
    setShowQuizFailModal(false)
    retryWithNextSet()
  }


  // ── [임시] 미니보스 바로가기 ──
  const handleSkipToMiniboss = async () => {
    try {
      const stageKey = `${lessonId}-${stageNum}`
      const res = await minibossApi.startBattle(lessonId, stageKey, attempt)
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
      setMinibossLoadErrorMsg('미니보스 로드 실패: ' + (err?.message || err))

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

  // ── 미니보스 재도전: 개념 퀴즈로 돌아가지 않고 미니보스 문제만 다음 세트로 즉시 재시작 ──
  const handleMinibossRetry = async () => {
    const nextAttempt = attempt + 1
    const stageKey = `${lessonId}-${stageNum}`

    setAttempt(nextAttempt)
    minibossDefeatedRef.current = false

    try {
      const res = await minibossApi.startBattle(lessonId, stageKey, nextAttempt)
      setMinibossToken(res.data.battle_token)
      const miniQuestions = res.data.questions.map(q => shuffleChoices(q))

      setQuestions(miniQuestions)
      setMinibossStartIndex(0)
      setStageQuizCorrect(0)
      setCorrect(0)
      setScore(0)
      setCurrent(0)
      setFinished(false)
      setShowBriefing(false)
      setBriefingIndex(0)
      setShowMinibossAlert(true)
      setLoadError(null)
      setLoading(false)
      setMinibossHp({ my_hp: 900, boss_hp: 500 })

      playBGM('miniboss_intro')
    } catch (err) {
      console.error('미니보스 재도전 로드 실패', err)
      setMinibossLoadErrorMsg('미니보스 로드 실패: ' + (err?.message || err))
    }
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
    const isCodeType = qType === 'code_input' || qType === 'code_multi_input'
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
          const res = await minibossApi.startBattle(lessonId, `${lessonId}-${stageNum}`, attempt)
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

      const prevLv    = user?.lv              || 1
      const prevChar  = user?.character       || 'slime'
      const prevStage = user?.evolution_stage ?? 0

      // ── 미니보스 클리어 처리 — 스테이지 완료(is_completed) 판정의 단일 소스 ──
      // 미니보스를 플레이한 스테이지는 프론트가 점수로 완료를 재판정하지 않는다.
      // clearBoss 성공(throw 안 함) = 서버 세션이 승리(5문항 중 4정답)를 인정 → 서버가
      // 이미 progress is_completed=True 를 영속화. 실패(패배/세션문제)면 403 throw → 미완료.
      let minibossCleared = false
      if (minibossStartIndex !== null && token) {
        try {
          await minibossApi.clearBoss({
            unit: parseInt(lessonId, 10),
            stage: `${lessonId}-${stageNum}`,
            battle_token: minibossToken,   // 서버 세션 won 검증용
          })
          minibossCleared = true
        } catch (err) {
          logApiError('미니보스 클리어 API 실패', err)
          minibossCleared = false
        }
      }

      // 완료 판정 단일화: 미니보스 플레이 시 서버 클리어 성공에 종속(프론트 점수 무관).
      // 미니보스 없는 스테이지(데이터 예외 폴백)에서만 개념 점수 기준을 유지한다.
      // totalScore/finalScore 는 결과 화면 '표시용'으로만 남는다.
      const isCompleted = minibossStartIndex !== null ? minibossCleared : (totalScore >= 80)

      // 완료 시: 개별 record POST 유실 대비 sessionAnswersRef 의 (qid, 첫 답안)을
      // answered_questions 로 함께 보내 서버 게이트가 grade_objective 로 재채점·합산.
      let answeredQuestions = []
      if (isCompleted && token) {
        answeredQuestions = Array.from(sessionAnswersRef.current.values())
      }

      // 완료 저장은 게이트 근거 — fire-and-forget 금지, await + 실패 재시도.
      let res = null
      try {
        res = await saveProgressWithRetry({
          unit: parseInt(lessonId, 10),
          stage: `${lessonId}-${stageNum}`,
          score: totalScore,
          is_completed: isCompleted,
          checkpoint: isCompleted ? 'done' : (minibossStartIndex !== null ? 'miniboss_ready' : 'concept_quiz'),
          ...(answeredQuestions.length > 0 ? { answered_questions: answeredQuestions } : {}),
        })
      } catch (err) {
        // 최종 저장 실패. 미니보스 스테이지는 서버 clearBoss 가 이미 완료를 영속화했으므로
        // 결과 화면은 계속 진행하고 보상/레벨 갱신만 생략한다.
        logApiError('스테이지 완료 저장 최종 실패', err)
      }

      if (res?.data) {
        // 신규 계약: reward.coin_delta/gp_delta. 구 응답(xp_awarded) 은 폴백(코인 표시용).
        setXpAwarded(res.data.reward?.coin_delta ?? res.data.xp_awarded ?? 0)
        setGpAwarded(res.data.reward?.gp_delta ?? 0)

        if (res.data.newly_earned_titles && res.data.newly_earned_titles.length > 0) {
          setNewlyEarnedTitles(res.data.newly_earned_titles)
        }

        const newLv    = res.data.lv                          || prevLv
        const newChar  = res.data.character                   || prevChar
        const newStage = res.data.user_state?.evolution_stage ?? prevStage

        // 진화 감지: 프론트에서 누적치/lv 를 재계산하지 않는다 — 백엔드가 응답에 실어준
        // user_state.evolution_stage 가 이전 값보다 올라갔을 때만 트리거한다(단일
        // 소스 = 백엔드). 진화는 엔드보스 클리어로만 발생하므로 일반 스테이지
        // 클리어에서는 사실상 발동하지 않지만, 판정 기준 자체는 여기서 통일한다.
        if (newStage > prevStage) {
          setEvoModal({
            fromChar: STAGE_TO_CHAR[prevStage] || 'slime',
            toChar: STAGE_TO_CHAR[newStage] || newChar,
            stage: newStage,
          })
        }

        if (newLv !== prevLv || newChar !== prevChar || newStage !== prevStage) {
          updateUser({ ...user, lv: newLv, character: newChar, evolution_stage: newStage })
        }
      }

      stopBGM()
      if (isCompleted) playBGM('clear')
      else             playBGM('fail')
      setFinished(true)
    } else {
      setCurrent(prev => prev + 1)
    }
  }

  // ── 로드 실패 후 재시도: 같은 세트(attempt 유지)로 문제 재요청 ──
  // loadError 를 지우고 loading 을 다시 켜 데이터 로드 useEffect 를 재실행한다.
  const handleLoadRetry = () => {
    setLoadError(null)
    setLoading(true)
    setRetryTick(t => t + 1)
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
          gpAwarded={gpAwarded}
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
        <InfoModal
          icon="⚠️"
          message={minibossLoadErrorMsg}
          onConfirm={() => setMinibossLoadErrorMsg(null)}
        />
      </>
    )
  }

  // API 실패(throw) — 사유를 노출하고 재시도/뒤로를 사용자가 선택. 자동 튕김 없음.
  if (loadError) {
    return (
      <div className="stage-loading">
        <p>{loadError.message}</p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button className="btn btn-primary" onClick={handleLoadRetry}>다시 시도</button>
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>뒤로</button>
        </div>
      </div>
    )
  }

  // 정상 응답(HTTP 200)이지만 문제가 비어 있는 경우 — 실패와 구분해 표기.
  if (questions.length === 0) {
    return (
      <div className="stage-loading">
        <p>문제 데이터가 없습니다.</p>
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
      {/* {minibossStartIndex === null && (
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
      )} */}
      {showQuizFailModal && (
        <MiniBossGateModal onConfirm={handleQuizFailModalConfirm} />
      )}
      <InfoModal
        icon="⚠️"
        message={minibossLoadErrorMsg}
        onConfirm={() => setMinibossLoadErrorMsg(null)}
      />
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
