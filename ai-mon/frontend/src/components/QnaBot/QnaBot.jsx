import { useEffect, useRef, useState } from 'react'
import { guideApi } from '../../api/index'
import qnabotImg from '../../assets/QNABOT.png'
import './QnaBot.css'

const GREETING = '안녕하세요! 저는 QnA봇이에요. 궁금한 걸 아래 버튼에서 골라보세요.'

const FAB_SIZE = 68
const EDGE_GAP = 8
const PANEL_GAP = 12
const IDLE_HINT_DELAY = 10000
const POS_STORAGE_KEY = 'aimon:qna-bot-position'
const IDLE_HINT_MESSAGES = [
  '또 틀렸네.',
  '괜찮아! 다음엔 맞힐 거야!',
  '복습 대상 추가.',
  '성장 포인트도 추가!',
  '찍지 말고 생각해.',
  '생각하는 힘이 점점 커지고 있어!',
  '이번엔 맞았네.',
  '내가 그럴 줄 알았어!',
  '실력 인정.',
  '최고야! 계속 가자.',
  '집중력이 살짝 부족했어.',
  '잠깐 쉬고 다시 하면 더 잘할 수 있어!',
  '같은 실수는 금지.',
  '같은 성장은 환영!',
  '분석 완료. 원인 파악 끝.',
  '이제 해결만 하면 된다!',
  '포기하면 여기서 끝이야.',
  '포기하지 않으면 끝이 아니야!',
  '다음 문제.',
  '같이 가자! 화이팅!',
]

function clampPos(x, y) {
  const maxX = window.innerWidth - FAB_SIZE - EDGE_GAP
  const maxY = window.innerHeight - FAB_SIZE - EDGE_GAP
  return {
    x: Math.min(Math.max(x, EDGE_GAP), Math.max(EDGE_GAP, maxX)),
    y: Math.min(Math.max(y, EDGE_GAP), Math.max(EDGE_GAP, maxY)),
  }
}

function defaultPos() {
  return clampPos(window.innerWidth - FAB_SIZE - 18, window.innerHeight - FAB_SIZE - 84)
}

function loadStoredPos() {
  try {
    const saved = JSON.parse(localStorage.getItem(POS_STORAGE_KEY))
    if (typeof saved?.x === 'number' && typeof saved?.y === 'number') {
      return clampPos(saved.x, saved.y)
    }
  } catch {
    // 저장값이 깨졌으면 기본 위치로 복구한다.
  }
  return defaultPos()
}

function saveStoredPos(pos) {
  try {
    localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos))
  } catch {
    // localStorage를 사용할 수 없는 환경에서는 세션 내 위치만 유지한다.
  }
}

function computePanelStyle(pos) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const panelW = Math.min(340, vw * 0.86)
  const panelH = Math.min(460, vh * 0.7)

  // 세로: 캐릭터 위쪽에 우선 배치, 공간이 없으면 아래쪽으로
  let top = pos.y - PANEL_GAP - panelH
  if (top < EDGE_GAP) {
    top = Math.min(pos.y + FAB_SIZE + PANEL_GAP, vh - panelH - EDGE_GAP)
  }

  // 가로: 캐릭터 오른쪽 끝에 패널 오른쪽 끝을 맞추고, 화면 밖으로 안 나가게 클램프
  let left = pos.x + FAB_SIZE - panelW
  left = Math.max(EDGE_GAP, Math.min(left, vw - panelW - EDGE_GAP))

  return { left, top, width: panelW, height: panelH }
}

function computeHintStyle(pos) {
  const vw = window.innerWidth
  const maxHintW = 220
  const leftSide = pos.x + FAB_SIZE + maxHintW + PANEL_GAP > vw - EDGE_GAP
  const top = Math.max(EDGE_GAP, pos.y + 8)

  if (leftSide) {
    return {
      style: { right: vw - pos.x + PANEL_GAP, top, maxWidth: maxHintW },
      side: 'left',
    }
  }

  return {
    style: { left: pos.x + FAB_SIZE + PANEL_GAP, top, maxWidth: maxHintW },
    side: 'right',
  }
}

export default function QnaBot() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(loadStoredPos)
  const [showIdleHint, setShowIdleHint] = useState(false)
  const [idleHintIndex, setIdleHintIndex] = useState(0)
  const [messages, setMessages] = useState([])
  const [faqItems, setFaqItems] = useState([])
  const [faqLoading, setFaqLoading] = useState(false)
  const [faqError, setFaqError] = useState('')
  const listRef = useRef(null)
  const fabRef = useRef(null)
  const openRef = useRef(open)
  const idleTimerRef = useRef(null)
  const idleIntervalRef = useRef(null)
  const dragRef = useRef({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    lastPos: pos,
  })

  useEffect(() => {
    openRef.current = open
    if (open && messages.length === 0) {
      setMessages([{ role: 'bot', text: GREETING }])
    }
    if (open) {
      setShowIdleHint(false)
    }
    if (open && faqItems.length === 0 && !faqLoading) {
      setFaqLoading(true)
      setFaqError('')
      guideApi
        .getFaq()
        .then((res) => {
          setFaqItems(res?.data?.items || [])
        })
        .catch(() => {
          setFaqError('버튼 목록을 불러오지 못했어요.')
        })
        .finally(() => {
          setFaqLoading(false)
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    const clearIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
      if (idleIntervalRef.current) {
        clearInterval(idleIntervalRef.current)
      }
    }

    const resetIdleTimer = () => {
      setShowIdleHint(false)
      setIdleHintIndex(0)
      clearIdleTimer()
      idleTimerRef.current = setTimeout(() => {
        if (!openRef.current) {
          setShowIdleHint(true)
          setIdleHintIndex(0)
          idleIntervalRef.current = setInterval(() => {
            if (openRef.current) {
              setShowIdleHint(false)
              return
            }
            setIdleHintIndex((index) => (index + 1) % IDLE_HINT_MESSAGES.length)
          }, IDLE_HINT_DELAY)
        }
      }, IDLE_HINT_DELAY)
    }

    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']
    events.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer))
    resetIdleTimer()

    return () => {
      clearIdleTimer()
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer))
    }
  }, [])

  useEffect(() => {
    const onResize = () => {
      setPos((p) => {
        const next = clampPos(p.x, p.y)
        saveStoredPos(next)
        return next
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handlePointerDown = (e) => {
    setShowIdleHint(false)
    const d = dragRef.current
    d.dragging = true
    d.moved = false
    d.startX = e.clientX
    d.startY = e.clientY
    d.baseX = pos.x
    d.baseY = pos.y
    d.lastPos = pos
    fabRef.current?.setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e) => {
    const d = dragRef.current
    if (!d.dragging) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true
    const next = clampPos(d.baseX + dx, d.baseY + dy)
    d.lastPos = next
    setPos(next)
  }

  const handlePointerUp = (e) => {
    const d = dragRef.current
    d.dragging = false
    fabRef.current?.releasePointerCapture?.(e.pointerId)
    if (d.moved) {
      saveStoredPos(d.lastPos)
    } else {
      setOpen((o) => !o)
    }
  }

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  // 버튼 클릭 → API 호출 없이 MD에서 미리 파싱해온 고정 답변을 바로 붙인다.
  const handlePick = (item) => {
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: item.question },
      { role: 'bot', text: item.answer },
    ])
  }

  const panelStyle = open ? computePanelStyle(pos) : null
  const hint = showIdleHint && !open ? computeHintStyle(pos) : null

  return (
    <>
      {open && (
        <div className="qb-panel" style={panelStyle} role="dialog" aria-label="안내봇 채팅">
          <div className="qb-header">
            <img src={qnabotImg} alt="" className="qb-header-avatar" />
            <span className="qb-header-title">QnA봇</span>
            <button
              type="button"
              className="qb-close"
              onClick={() => setOpen(false)}
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          <div className="qb-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`qb-bubble-row ${m.role}`}>
                {m.role === 'bot' && (
                  <img src={qnabotImg} alt="" className="qb-bubble-avatar" />
                )}
                <div className={`qb-bubble ${m.role}`}>{m.text}</div>
              </div>
            ))}
          </div>

          {faqError && <div className="qb-error">{faqError}</div>}

          <div className="qb-quickreplies">
            {faqLoading && <span className="qb-quickreplies-hint">불러오는 중…</span>}
            {!faqLoading &&
              faqItems.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  className="qb-chip"
                  onClick={() => handlePick(item)}
                >
                  {item.question}
                </button>
              ))}
          </div>
        </div>
      )}

      {hint && (
        <div className={`qb-idle-hint qb-idle-hint-${hint.side}`} style={hint.style} role="status">
          {IDLE_HINT_MESSAGES[idleHintIndex]}
        </div>
      )}

      <button
        ref={fabRef}
        type="button"
        className={`qb-fab no-3d${open ? ' qb-fab-open' : ''}`}
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label={open ? '안내봇 닫기' : '안내봇 열기 (드래그로 위치 이동 가능)'}
      >
        <img src={qnabotImg} alt="안내봇" className="qb-fab-img" draggable={false} />
      </button>
    </>
  )
}
