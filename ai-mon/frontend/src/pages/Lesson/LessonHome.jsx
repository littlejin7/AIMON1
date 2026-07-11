import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { quizApi, progressApi, userApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import LevelTestModal from '../../components/LevelTestModal/LevelTestModal'
import InfoModal from '../../components/InfoModal/InfoModal'
import unitBossImg from '../../assets/boss_finalorg.png'
import endBossImg from '../../assets/endboss_finalorg.png'
import './LessonHome.css'

const LEVEL_MAP = {
  beginner:     { label: '초급', idx: 0 },
  intermediate: { label: '중급', idx: 1 },
  advanced:     { label: '고급', idx: 2 },
}
const LEVELS = ['beginner', 'intermediate', 'advanced']
const LEVEL_LABELS = ['초급', '중급', '고급']

const UNIT_TITLES = [
  'Python 기초 & 변수',
  '함수와 제어 흐름',
  '자료구조 (리스트·딕셔너리)',
  '반복문과 조건문',
  '클래스와 객체',
  '문자열 & 라이브러리',
  '파일·JSON·API',
  'AI 에이전트',
]

const FALLBACK_UNIT_ICONS = {
  1: '🖨️',
  2: '📝',
  3: '🔀',
  4: '🔁',
  5: '📋',
  6: '⚙️',
  7: '🗂️',
  8: '🚀',
}

function getFallbackUnitIcon(unitId) {
  return FALLBACK_UNIT_ICONS[unitId] || '📘'
}

function getUnitShortTitle(title = '', unitId, courseLevel = 'beginner') {
  const mapping = {
    beginner: {
      1: '파이썬 첫걸음',
      2: '문자열',
      3: '조건문',
      4: '반복문',
      5: '리스트/파일',
      6: '함수',
      7: '딕셔너리',
      8: '프로젝트',
    },
    intermediate: {
      1: '예외처리',
      2: '자료형 심화',
      3: '함수 심화',
      4: '클래스 & OOP',
      5: '리스트/파일 심화',
      6: '가상환경',
      7: '정규표현식',
      8: 'API 프로젝트',
    },
    advanced: {
      1: '고급 문법',
      2: '비동기 프로그래밍',
      3: 'AI API 활용',
      4: 'Streamlit 챗봇',
      5: 'LangChain 기초',
      6: 'AI 에이전트',
      7: '웹 연동 프로젝트',
      8: '최종 프로젝트',
    }
  }

  return mapping[courseLevel]?.[unitId] || title.replace(/—/g, ' ').split(/\s+/).slice(0, 2).join(' ') || `Unit ${unitId}`
}

// 실제 커리큘럼 데이터(backend/data/lessons/{level}/unit_N.json)의 스테이지별 title.
// 코드에서 다시 fetch하지 않도록 정적 테이블로 유지한다.
const STAGE_TITLES = {
  beginner: {
    1: ['Hello, Python!', '변수 만들기', '숫자형', '문자열형', '불리언 & 비교', '자료형 변환', '입력 & f-string'],
    2: ['인덱싱 & 슬라이싱', '문자열 메서드 1', '문자열 메서드 2', 'f-string 심화', 'len() & 문자열 연산', '문자열 종합실습'],
    3: ['if / else 기본', 'elif 다중 조건', '비교 연산자', '논리 연산자', '중첩 조건문', '조건문 종합실습'],
    4: ['for + range', 'for + 리스트 순회', 'for + 딕셔너리 순회', 'while 반복', 'break & continue', '중첩 for', '반복문 종합실습'],
    5: ['리스트 기초', '리스트 수정', '리스트 메서드', '리스트 순회 & 탐색', '파일 읽기', '파일 쓰기', '리스트&파일 종합실습'],
    6: ['함수 기초', '매개변수 & 인수', 'return 반환값', '기본값 매개변수', '스코프', '함수 안의 함수', '함수 종합실습'],
    7: ['딕셔너리 기초', '딕셔너리 수정', '딕셔너리 순회', '세트 기초', '세트 연산', '딕셔너리&세트 종합실습'],
    8: ['인벤토리 메뉴 만들기', '아이템 획득하기', '인벤토리 상태 확인하기', '아이템 버리기', '아이템 검색하기', '데이터 저장하고 불러오기', '시스템 구동 엔진 만들기'],
  },
  intermediate: {
    1: ['try / except 기초', '다양한 예외 유형', 'finally & else', 'raise & 커스텀 예외', '예외처리 종합실습'],
    2: ['튜플 기초', '패킹 & 언패킹', '자료형 비교', '중첩 자료구조 심화', '자료형 심화 종합실습'],
    3: ['lambda 익명 함수', '*args와 **kwargs', '재귀 함수', '고차 함수 — map과 filter', '함수심화 종합실습'],
    4: ['클래스 기초', '인스턴스 메서드 & 속성', '클래스 변수 vs 인스턴스 변수', '상속', '캡슐화 & 특수 메서드', 'OOP 종합실습'],
    5: ['리스트 컴프리헨션', '딕셔너리·세트 컴프리헨션', 'JSON 파일 처리', 'CSV 파일 처리', '파일처리 종합실습'],
    6: ['가상환경이란', 'venv 생성 & 활성화', 'pip 패키지 관리', '표준 라이브러리 활용', '가상환경 종합실습'],
    7: ['정규식 기초', '주요 패턴', '그룹 & 추출', '치환 & 분리', '정규식 종합실습'],
    8: ['requests 라이브러리', 'API 인증', 'API 응답 파싱', '에러 처리 & 재시도', '실전 API 연동 1', '실전 API 연동 2', 'API 종합 프로젝트'],
  },
  advanced: {
    1: ['데코레이터 기초', '데코레이터 심화', '제너레이터', '컨텍스트 매니저', '고급 문법 종합실습'],
    2: ['동기 vs 비동기 개념', 'asyncio 기초', '비동기 태스크', '비동기 HTTP 요청', '비동기 종합실습'],
    3: ['API 키 & 보안', 'Claude API 기초', '시스템 프롬프트 & 멀티턴', '스트리밍 응답', 'AI API 종합실습'],
    4: ['Streamlit 기초', 'Streamlit 상태 관리', '챗봇 UI 구성', 'Claude API 연결', '챗봇 기능 확장', 'Streamlit 앱 배포'],
    5: ['LangChain 개요 & 설치', 'LLM 체인 구성', '메모리', 'RAG 기초', 'LangChain 종합실습'],
    6: ['Tool Use 개념', '도구 정의 & 등록', '에이전트 루프 기초', '멀티 도구 에이전트', '에러 처리 & 안전장치', 'AI 에이전트 종합실습'],
    7: ['FastAPI 기초', 'FastAPI + AI 연동', '프론트엔드 연결', '데이터베이스 연동', '웹 프로젝트 종합'],
    8: ['에이전트 + 파이프라인 설계', 'LangChain 에이전트 구성', '자동화 워크플로우', '외부 도구 연동', '멀티 에이전트 패턴', 'AI 자동화 최종 프로젝트'],
  },
}

function getStageDisplayTitle(unitId, stageNum, unitTitle = '', courseLevel = 'beginner') {
  const fromData = STAGE_TITLES[courseLevel]?.[unitId]?.[stageNum - 1]
  return fromData ? `Stage ${stageNum} - ${fromData}` : `Stage ${stageNum}`
}

function UnitIcon({ unitId, className = '' }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    'aria-hidden': true,
  }

  switch (unitId) {
    case 1:
      return (
        <svg {...common}>
          <rect x="6" y="8" width="12" height="8" rx="2" />
          <path d="M8 8V5h8v3" />
          <path d="M8 16v3h8v-3" />
          <path d="M9 12h6" />
        </svg>
      )
    case 2:
      return (
        <svg {...common}>
          <path d="M7 5h10" />
          <path d="M7 9h7" />
          <path d="M7 13h10" />
          <path d="M7 17h6" />
          <path d="M17 15l2 2-2 2" />
        </svg>
      )
    case 3:
      return (
        <svg {...common}>
          <path d="M6 6h5a4 4 0 0 1 4 4v1" />
          <path d="M6 18h5a4 4 0 0 0 4-4v-1" />
          <path d="M16 8l3 3-3 3" />
        </svg>
      )
    case 4:
      return (
        <svg {...common}>
          <path d="M17 7a6 6 0 0 0-10 2" />
          <path d="M7 7v2h2" />
          <path d="M7 17a6 6 0 0 0 10-2" />
          <path d="M17 17v-2h-2" />
        </svg>
      )
    case 5:
      return (
        <svg {...common}>
          <rect x="6" y="5" width="12" height="14" rx="2" />
          <path d="M9 9h6" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      )
    case 6:
      return (
        <svg {...common}>
          <path d="M8 7h8" />
          <path d="M8 12h8" />
          <path d="M8 17h5" />
          <path d="M5 7h.01" />
          <path d="M5 12h.01" />
          <path d="M5 17h.01" />
        </svg>
      )
    case 7:
      return (
        <svg {...common}>
          <rect x="5" y="5" width="14" height="14" rx="3" />
          <path d="M8 9h8" />
          <path d="M8 13h5" />
          <path d="M8 17h7" />
        </svg>
      )
    case 8:
      return (
        <svg {...common}>
          <path d="M12 4v5" />
          <path d="M8 8h8" />
          <rect x="6" y="10" width="12" height="8" rx="3" />
          <path d="M9 14h.01" />
          <path d="M15 14h.01" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <rect x="5" y="5" width="14" height="14" rx="3" />
          <path d="M9 9h6" />
          <path d="M9 13h6" />
        </svg>
      )
  }
}

export default function LessonHome() {
  const user       = useAuthStore((s) => s.user)
  const token      = useAuthStore((s) => s.token)
  const updateUser = useAuthStore((s) => s.updateUser)
  const navigate   = useNavigate()
  const { id: routeUnitId } = useParams()
  const routeExpandedUnit = Number.parseInt(routeUnitId, 10)

  const [showLevelTest, setShowLevelTest] = useState(false)
  const [pendingUnitId, setPendingUnitId] = useState(null)
  const [levelTestErrorMsg, setLevelTestErrorMsg] = useState(null)
  const [guestNoticeMsg, setGuestNoticeMsg] = useState(null)
  const [lessons,  setLessons]  = useState([])
  const [progress, setProgress] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expandedUnit, setExpandedUnit] = useState(
    Number.isInteger(routeExpandedUnit) ? routeExpandedUnit : 1
  )
  const [unitInfoOpen, setUnitInfoOpen] = useState(false)
  const unitSelectorRef = useRef(null)
  const unitDragRef = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    didDrag: false,
  })
  const [unitSelectorDragging, setUnitSelectorDragging] = useState(false)
  const [quickStageMenu, setQuickStageMenu] = useState(null)

  const courseLevel = user?.course_level || 'beginner'
  const activeLevelIdx = LEVEL_MAP[courseLevel]?.idx ?? 0
  const clearedLevels = Array.isArray(user?.endboss_cleared_levels) ? user.endboss_cleared_levels : []
  const isCurrentLevelCleared = clearedLevels.includes(courseLevel)
  
  // max_unlocked_unit 는 백엔드에서 {beginner,intermediate,advanced} 객체.
  // (레거시 스칼라도 방어적으로 허용)
  const rawMaxUnlocked = user?.max_unlocked_unit
  const maxUnlocked = isCurrentLevelCleared ? 9 : (
    rawMaxUnlocked && typeof rawMaxUnlocked === 'object'
      ? rawMaxUnlocked[courseLevel]
      : rawMaxUnlocked
  ) ?? 1

  useEffect(() => {
    const calls = [quizApi.getUnits(courseLevel)]
    if (token) {
      calls.push(progressApi.getProgress(courseLevel).catch(() => null))
      calls.push(userApi.getMe().catch(() => null))
    }
    Promise.all(calls)
      .then(([l, p, u]) => {
        setLessons(l.data)
        if (p?.data) setProgress(p.data)
        if (u?.data) updateUser(u.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token, courseLevel])

  // 레벨 테스트 미완료 시 자동 시작
  useEffect(() => {
    if (!loading && token && user && !user.is_level_tested) {
      setShowLevelTest(true)
    }
  }, [loading, token, user])

  // 진행 중인 유닛 자동 펼치기
  useEffect(() => {
    if (lessons.length === 0) return
    if (Number.isInteger(routeExpandedUnit) && lessons.some((l) => l.unit_id === routeExpandedUnit)) {
      setExpandedUnit(routeExpandedUnit)
      return
    }
    const currentUnit = lessons.find((l) => {
      if (l.unit_id > maxUnlocked) return false
      const prog = getUnitProgress(l.unit_id, l.stages)
      return prog.completed < l.stages
    })
    if (currentUnit) setExpandedUnit(currentUnit.unit_id)
  }, [lessons, progress, routeExpandedUnit, maxUnlocked])

  useEffect(() => {
    if (!unitInfoOpen) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [unitInfoOpen])

  useEffect(() => {
    setUnitInfoOpen(false)
    setQuickStageMenu(null)
  }, [expandedUnit])

  const handleLevelTestFinish = async (levelKey, updatedUser) => {
    try {
      if (updatedUser) {
        updateUser(updatedUser)
      } else {
        const res = await userApi.updateMe({ course_level: levelKey, is_level_tested: true })
        updateUser(res.data)
      }
      if (pendingUnitId) {
        setExpandedUnit(pendingUnitId)
        navigate(`/lesson/${pendingUnitId}`)
      }
    } catch {
      setLevelTestErrorMsg('레벨 설정 변경에 실패했습니다.')
    } finally {
      setShowLevelTest(false)
      setPendingUnitId(null)
    }
  }

  const isStageComplete = (unitId, stageNum) =>
    isCurrentLevelCleared ||
    progress.some((p) => p.unit === unitId && p.stage === `${unitId}-${stageNum}` && p.is_completed && p.course_level === courseLevel)

  // 표시용 진행도 = "1-1부터 연속으로 완료된 스테이지 개수".
  // 중간에 구멍(예: 1-1 미완료인데 1-2 완료)이 있는 깨진 데이터에서는
  // 구멍 직전까지만 진행으로 보여 ✓가 중간에 박히거나 current 노드가 둘이 되는 것을 막는다.
  const getUnitProgress = (unitId, stages = 0) => {
    let completed = 0
    for (let s = 1; s <= stages; s++) {
      if (isStageComplete(unitId, s)) completed++
      else break
    }
    return { completed }
  }

  const isBossComplete = (unitId) =>
    isCurrentLevelCleared ||
    progress.some((p) => p.unit === unitId && p.stage === `${unitId}-boss` && p.is_completed && p.course_level === courseLevel)

  const totalStages = lessons.reduce((a, l) => a + (l.stages || 0), 0)
  // 맵 표시(연속 완료 기반)와 동일 정의로 집계해야 헤더/전체 카운트가 맵과 일치한다.
  // (보스 스테이지는 제외 — totalStages 도 보스 미포함)
  const doneStages  = lessons.reduce((a, l) => a + getUnitProgress(l.unit_id, l.stages).completed, 0)
  const overallPct  = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0


  const endbossUnlocked = token && lessons.length > 0 && lessons.every((l) => {
    const prog = getUnitProgress(l.unit_id, l.stages)
    return l.stages > 0 && prog.completed >= l.stages && isBossComplete(l.unit_id)
  })

  const selectedLesson = lessons.find((l) => l.unit_id === expandedUnit) || lessons[0]

  
  const handleUnitClick = (lesson, unlocked) => {
    if (!unlocked) return
    if (!token && lesson.unit_id === 1) { navigate('/stage/1/1'); return }
    if (!token) { navigate('/auth'); return }
    if (!user?.is_level_tested) { setPendingUnitId(lesson.unit_id); setShowLevelTest(true); return }
    navigate(`/lesson/${lesson.unit_id}`)
  }

  const toggleExpand = (unitId, unlocked) => {
    if (!unlocked) return
    setExpandedUnit(prev => prev === unitId ? null : unitId)
  }

  const handleUnitSelectorPointerDown = (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    const scroller = unitSelectorRef.current
    if (!scroller) return

    unitDragRef.current = {
      isDown: true,
      startX: event.clientX,
      scrollLeft: scroller.scrollLeft,
      didDrag: false,
    }
    setUnitSelectorDragging(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handleUnitSelectorPointerMove = (event) => {
    const drag = unitDragRef.current
    const scroller = unitSelectorRef.current
    if (!drag.isDown || !scroller) return

    const deltaX = event.clientX - drag.startX
    if (Math.abs(deltaX) > 3) {
      drag.didDrag = true
    }
    scroller.scrollLeft = drag.scrollLeft - deltaX
    event.preventDefault()
  }

  const stopUnitSelectorDrag = (event) => {
    if (!unitDragRef.current.isDown) return
    unitDragRef.current.isDown = false
    setUnitSelectorDragging(false)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const handleUnitSelectorClickCapture = (event) => {
    if (!unitDragRef.current.didDrag) return
    event.preventDefault()
    event.stopPropagation()
    unitDragRef.current.didDrag = false
  }

  const scrollUnitSelector = (direction) => {
    const scroller = unitSelectorRef.current
    if (!scroller) return

    const scrollAmount = Math.max(scroller.clientWidth * 0.65, 180)
    scroller.scrollBy({
      left: direction * scrollAmount,
      behavior: 'smooth',
    })
  }

  const isFreeTrialStage = (unitId, stageNum) =>
    Number(unitId) === 1 && Number(stageNum) === 1

  const showGuestTrialNotice = () => {
    setGuestNoticeMsg('로그인 없이 1-1만 무료로 체험할 수 있어요. 계속 학습하려면 회원가입 또는 로그인을 진행해주세요.')
  }

  const openStageMode = (unitId, stageNum, mode = 'lesson') => {
    if (!token) {
      if (isFreeTrialStage(unitId, stageNum) && mode === 'lesson') {
        navigate('/stage/1/1')
      } else {
        showGuestTrialNotice()
      }
      return
    }
    if (!user?.is_level_tested && !isFreeTrialStage(unitId, stageNum)) {
      setPendingUnitId(unitId)
      setShowLevelTest(true)
      return
    }
    navigate(`/stage/${unitId}/${stageNum}?mode=${mode}`)
  }

  if (loading) {
    return (
      <div className="lh-loading">
        <div className="spinner" />
        <p>레슨 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="lh-page">
      {showLevelTest && (
        <LevelTestModal
          forced={!user?.is_level_tested}
          onClose={() => { setShowLevelTest(false); setPendingUnitId(null) }}
          onFinish={handleLevelTestFinish}
          isLoggedIn={true}
        />
      )}

      <InfoModal
        icon="⚠️"
        message={levelTestErrorMsg}
        onConfirm={() => setLevelTestErrorMsg(null)}
      />

      <InfoModal
        icon="🔒"
        message={guestNoticeMsg}
        onConfirm={() => setGuestNoticeMsg(null)}
      />

      <div className="lh-scroll">
        {/* ── 레벨 표시 ── */}
        <div className="lh-level-tabs">
          {LEVELS.map((lv, i) => (
            <div
              key={lv}
              className={`lh-tab ${i === activeLevelIdx ? 'active' : ''}`}
            >
              {LEVEL_LABELS[i]}
            </div>
          ))}
        </div>

        {/* ── 3차: 통합 로드맵 보드 ── */}
        {lessons.length > 0 && (
          <section className="lh-roadmap-board" aria-label={`${LEVEL_MAP[courseLevel]?.label} 로드맵`}>
            {/* 상단: 진행률 요약 */}
            <div className="lh-roadmap-board-head">
              <div className="lh-roadmap-board-header-row">
                <h2>{LEVEL_MAP[courseLevel]?.label} 로드맵</h2>
                <span className="lh-roadmap-board-percent">{overallPct}%</span>
              </div>
              <div className="lh-roadmap-board-count">
                <strong>{doneStages}</strong> / {totalStages} 스테이지 완료
              </div>
            </div>
            
            {token && (
              <div className="lh-roadmap-board-progress-bar">
                <div className="lh-roadmap-board-progress-fill" style={{ width: `${overallPct}%` }} />
              </div>
            )}

            {/* 하단: 유닛 가로 선택 노드 */}
            <div className="lh-unit-selector-viewport">
              <button
                type="button"
                className="lh-roadmap-arrow lh-roadmap-arrow-left no-3d"
                onClick={() => scrollUnitSelector(-1)}
                aria-label="로드맵 왼쪽으로 이동"
              />
              <div
                ref={unitSelectorRef}
                className={`lh-unit-selector-scroll ${unitSelectorDragging ? 'dragging' : ''}`}
                onPointerDown={handleUnitSelectorPointerDown}
                onPointerMove={handleUnitSelectorPointerMove}
                onPointerUp={stopUnitSelectorDrag}
                onPointerCancel={stopUnitSelectorDrag}
                onPointerLeave={stopUnitSelectorDrag}
                onClickCapture={handleUnitSelectorClickCapture}
              >
              {lessons.map((lesson, idx) => {
                const unlocked = token ? lesson.unit_id <= maxUnlocked : lesson.unit_id === 1
                const prog = getUnitProgress(lesson.unit_id, lesson.stages)
                const done = prog.completed >= lesson.stages && lesson.stages > 0 && isBossComplete(lesson.unit_id)
                const isSelected = lesson.unit_id === expandedUnit
                const isCurrent = unlocked && !done && lesson.unit_id === expandedUnit
                const title = lesson.title || UNIT_TITLES[idx] || `Unit ${lesson.unit_id}`
                const shortTitle = getUnitShortTitle(title, lesson.unit_id, courseLevel)

                return (
                  <button
                    key={lesson.unit_id}
                    type="button"
                    className={`lh-unit-node no-3d unit-${lesson.unit_id} ${done ? 'done' : !unlocked ? 'locked' : isCurrent ? 'current' : 'open'} ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      if (!unlocked) return
                      setExpandedUnit(lesson.unit_id)
                    }}
                    disabled={!unlocked}
                    aria-label={`Unit ${lesson.unit_id} ${shortTitle}`}
                  >
                    <span className="lh-unit-node-icon-wrap">
                      <UnitIcon unitId={lesson.unit_id} className="lh-unit-node-svg" />
                      {done && <span className="lh-unit-node-state done">✓</span>}
                      {!unlocked && <span className="lh-unit-node-state locked">🔒</span>}
                      {isCurrent && <span className="lh-unit-node-state current">▶</span>}
                    </span>
                    <span className="lh-unit-node-num">{lesson.unit_id}</span>
                    <span className="lh-unit-node-title">{shortTitle}</span>
                    {/* status text is hidden to match roadmap box mock */}
                  </button>
                )
              })}
              </div>
              <button
                type="button"
                className="lh-roadmap-arrow lh-roadmap-arrow-right no-3d"
                onClick={() => scrollUnitSelector(1)}
                aria-label="로드맵 오른쪽으로 이동"
              />
            </div>
          </section>
        )}

        {/* ── 선택된 유닛 상세 및 발자국 로드맵 ── */}
        {selectedLesson && (() => {
          const lesson = selectedLesson
          const idx = lessons.findIndex((l) => l.unit_id === lesson.unit_id)
          const unlocked = token ? lesson.unit_id <= maxUnlocked : lesson.unit_id === 1
          const prog = getUnitProgress(lesson.unit_id, lesson.stages)
          const done = prog.completed >= lesson.stages && lesson.stages > 0 && isBossComplete(lesson.unit_id)
          const pct = lesson.stages > 0 ? Math.round((prog.completed / lesson.stages) * 100) : 0
          const title = lesson.title || UNIT_TITLES[idx] || `Unit ${lesson.unit_id}`
          const icon = lesson.icon || getFallbackUnitIcon(lesson.unit_id)
          const stageNums = Array.from({ length: lesson.stages || 0 }, (_, i) => i + 1)
          
          const isBossFinished = isBossComplete(lesson.unit_id)
          const isReadyForBoss = prog.completed >= lesson.stages
          const bossState = isBossFinished ? 'cleared' : isReadyForBoss ? 'open' : 'locked'
          const activeQuickStage = quickStageMenu?.unitId === lesson.unit_id ? quickStageMenu.stage : null

          const toggleQuickStage = (stageNum) => {
            setQuickStageMenu(prev => (
              prev?.unitId === lesson.unit_id && prev.stage === stageNum
                ? null
                : { unitId: lesson.unit_id, stage: stageNum }
            ))
          }

          const renderQuickStageActions = () => {
            if (!activeQuickStage) return null
            return (
              <div className="lh-stage-quick-actions">
                <div className="lh-stage-quick-head">
                  <span>Stage {activeQuickStage}</span>
                </div>
                <div className="lh-stage-quick-buttons">
                  <button
                    type="button"
                    className="lh-stage-quick-btn no-3d lesson"
                    onClick={() => openStageMode(lesson.unit_id, activeQuickStage, 'lesson')}
                  >
                    레슨
                  </button>
                  <button
                    type="button"
                    className="lh-stage-quick-btn no-3d quiz"
                    onClick={() => openStageMode(lesson.unit_id, activeQuickStage, 'quiz')}
                  >
                    퀴즈
                  </button>
                  <button
                    type="button"
                    className="lh-stage-quick-btn no-3d miniboss"
                    onClick={() => openStageMode(lesson.unit_id, activeQuickStage, 'miniboss')}
                  >
                    미니보스
                  </button>
                </div>
              </div>
            )
          }

          const handleBossClick = () => {
            if (!token || prog.completed < lesson.stages) return
            if (!user?.is_level_tested) {
              setPendingUnitId(lesson.unit_id)
              setShowLevelTest(true)
              return
            }
            navigate(`/boss/${lesson.unit_id}`)
          }

          return (
            <>
            <section className={`lh-selected-unit-card unit-${lesson.unit_id} ${!unlocked ? 'locked' : ''}`}>
              <div className="lh-selected-unit-head">
                <div className="lh-selected-unit-icon">
                  <UnitIcon unitId={lesson.unit_id} className="lh-selected-unit-svg" />
                </div>
                <div className="lh-selected-unit-info">
                  <div className="lh-selected-unit-meta-row">
                    <span className="lh-selected-unit-kicker">UNIT {lesson.unit_id}</span>
                    <button
                      type="button"
                      className="lh-selected-unit-info-pill no-3d"
                      onClick={() => setUnitInfoOpen(true)}
                    >
                      유닛 정보
                    </button>
                  </div>
                  <h2>{title}</h2>
                </div>
              </div>

              <div className="lh-selected-unit-progress">
                <span>{prog.completed} / {lesson.stages} 스테이지 완료</span>
                <div className="lh-selected-unit-bar">
                  <div style={{ width: `${done ? 100 : pct}%` }} />
                </div>
              </div>

              {(() => {
                // 1. 잠긴 유닛
                if (!unlocked) {
                  return (
                    <div className="lh-unit-lock-notice">
                      <span className="lh-lock-icon">🔒</span>
                      <p className="lh-lock-text">
                        이 유닛은 아직 잠겨 있습니다.<br />
                        이전 유닛들을 완료하여 해금해 보세요.
                      </p>
                    </div>
                  )
                }

                const shortTitle = getUnitShortTitle(title, lesson.unit_id, courseLevel)

                // 2. 완료 유닛 또는 진행중 유닛
                return (
                  <div className="lh-unlocked-unit-content">
                    {done ? (
                      <div className="lh-unit-done-container">
                        <div className="lh-stage-complete-header">
                          <h3>완료한 스테이지</h3>
                        </div>
                        <div className="lh-stage-chip-list">
                          {stageNums.map((s) => {
                            return (
                              <button
                                key={s}
                                type="button"
                                className={`lh-stage-pill no-3d ${activeQuickStage === s ? 'active' : ''}`}
                                onClick={() => {
                                  toggleQuickStage(s)
                                }}
                                aria-expanded={activeQuickStage === s}
                                aria-label={`Stage ${s} 복습`}
                              >
                                <span className="lh-stage-pill-num">{s}</span>
                                <span className="lh-stage-pill-check">✓</span>
                              </button>
                            )
                          })}
                        </div>
                        {renderQuickStageActions()}
                      </div>
                    ) : (
                      <>
                      <div className="lh-paw-roadmap">
                        {stageNums.map((s) => {
                          const stageDone = s <= prog.completed
                          const isCurrent = s === prog.completed + 1
                          const enabled = unlocked && s <= prog.completed + 1
                          const isGuestFreeTrial = !token && isFreeTrialStage(lesson.unit_id, s)
                          const stateClass = stageDone ? 'done' : isCurrent ? 'current' : 'locked'

                          return (
                            <button
                              key={s}
                              type="button"
                              className={`lh-paw-stage no-3d ${stateClass} ${activeQuickStage === s ? 'active' : ''}`}
                              disabled={token ? !enabled : false}
                              onClick={() => {
                                if (!token) {
                                  if (isGuestFreeTrial) {
                                    navigate('/stage/1/1')
                                  } else {
                                    showGuestTrialNotice()
                                  }
                                  return
                                }
                                if (!enabled) return
                                if (stageDone) {
                                  toggleQuickStage(s)
                                  return
                                }
                                if (!user?.is_level_tested && !isFreeTrialStage(lesson.unit_id, s)) {
                                  setPendingUnitId(lesson.unit_id)
                                  setShowLevelTest(true)
                                  return
                                }
                                navigate(`/stage/${lesson.unit_id}/${s}`)
                              }}
                            >
                              <span className="lh-paw-node">{s}</span>
                              <span className="lh-paw-content">
                                <span className="lh-paw-title">{getStageDisplayTitle(lesson.unit_id, s, title, courseLevel)}</span>
                                <span className="lh-paw-status">
                                  {isGuestFreeTrial ? '체험 가능' : stageDone ? '완료' : isCurrent ? '진행중' : '잠김'}
                                </span>
                              </span>
                              {stageDone && <span className="lh-paw-action review">복습</span>}
                              {isCurrent && <span className="lh-paw-action continue">{isGuestFreeTrial ? '무료 체험' : '이어하기'}</span>}
                              {!enabled && <span className="lh-paw-lock">🔒</span>}
                            </button>
                          )
                        })}
                      </div>
                      {renderQuickStageActions()}
                      </>
                    )}

                    {/* ── 유닛보스 게이트 박스 ── */}
                    <div className="lh-unitboss-gate-card">
                      <div className="lh-unitboss-gate-body">
                        <div className="lh-unitboss-gate-text">
                          <span className="lh-unitboss-gate-kicker">유닛보스 게이트</span>
                          <h4>{shortTitle} 마스터</h4>
                          <p>
                            {bossState === 'cleared'
                              ? '보스전을 다시 복습할 수 있어요.'
                              : bossState === 'open'
                              ? '최종 관문이 열렸어요!'
                              : '모든 스테이지 완료 후 도전 가능'}
                          </p>
                        </div>
                        <div className="lh-unitboss-gate-monster">
                          <img
                            className={`lh-unitboss-gate-img ${bossState}`}
                            src={unitBossImg}
                            alt="유닛보스"
                            draggable={false}
                          />
                          {bossState === 'locked' && <span className="lh-unitboss-lock-badge">LOCK</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`lh-unitboss-gate-cta no-3d ${bossState}`}
                        disabled={bossState === 'locked'}
                        onClick={handleBossClick}
                      >
                        {bossState === 'cleared'
                          ? '보스 복습'
                          : bossState === 'open'
                          ? '유닛보스 도전하기'
                          : '유닛보스 잠김'}
                      </button>
                    </div>
                  </div>
                )
              })()}
            </section>

            {unitInfoOpen && (
              <div className="lh-unit-info-overlay" onClick={() => setUnitInfoOpen(false)}>
                <div className="lh-unit-info-card" onClick={(e) => e.stopPropagation()}>
                  <div className="lh-unit-info-header">
                    <h3>Unit {lesson.unit_id} 정보</h3>
                    <button
                      type="button"
                      className="lh-unit-info-close no-3d"
                      onClick={() => setUnitInfoOpen(false)}
                      aria-label="닫기"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="lh-unit-info-section">
                    <span className="lh-unit-info-label">유닛명</span>
                    <p className="lh-unit-info-value">{lesson.title}</p>
                  </div>

                  <div className="lh-unit-info-section">
                    <span className="lh-unit-info-label">설명</span>
                    <p className="lh-unit-info-value">{lesson.description || '설명이 등록되지 않았습니다.'}</p>
                  </div>

                  <div className="lh-unit-info-section">
                    <span className="lh-unit-info-label">스테이지 ({lesson.stages}개)</span>
                    <ol className="lh-unit-info-stage-list">
                      {stageNums.map((s) => (
                        <li key={s}>{getStageDisplayTitle(lesson.unit_id, s, title, courseLevel)}</li>
                      ))}
                    </ol>
                  </div>

                  <button
                    type="button"
                    className="lh-unit-info-close-btn no-3d"
                    onClick={() => setUnitInfoOpen(false)}
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}
            </>
          )
        })()}

        {/* ── 엔드보스 티저 ── */}
        <div className="lh-endboss-outer-card">
          <div className={`lh-endboss-gate-card ${endbossUnlocked ? 'unlocked' : 'locked'}`}>
            <div className="lh-endboss-gate-body">
              <div className="lh-endboss-gate-text">
                <span className="lh-endboss-gate-kicker">
                  <span className="lh-endboss-crown-badge" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
                      <path d="M3 8l4 3 5-6 5 6 4-3-1.5 10h-15L3 8z" fill="currentColor" />
                    </svg>
                  </span>
                  최종 관문
                </span>
                <h4>엔드보스</h4>
                <p>
                  {endbossUnlocked
                    ? "모든 유닛을 클리어했어요. 최종 보스에 도전하세요!"
                    : "모든 유닛을 클리어하고 최종 보스에 도전하세요."}
                </p>
              </div>
              <div className="lh-endboss-gate-media">
                <img
                  className={`lh-endboss-gate-img ${endbossUnlocked ? 'unlocked' : 'locked'}`}
                  src={endBossImg}
                  alt="엔드보스"
                  draggable={false}
                />
                {!endbossUnlocked && <span className="lh-endboss-lock-badge">LOCK</span>}
              </div>
            </div>
            <button
              type="button"
              className={`lh-endboss-gate-cta no-3d ${endbossUnlocked ? 'unlocked' : 'locked'}`}
              disabled={!endbossUnlocked}
              onClick={() => endbossUnlocked && navigate('/boss/endboss')}
            >
              {endbossUnlocked ? "엔드보스 도전하기" : "엔드보스 잠김"}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
