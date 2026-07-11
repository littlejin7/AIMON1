import { useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useSoundStore } from '../hooks/useSoundStore'
import bgmSrc from '@/assets/bgm/main_home_bgm.mp3'

/**
 * GlobalBGM
 * 앱 전역 기본 배경음악(main_home_bgm.mp3)을 재생하는 단일 마운트 컴포넌트.
 *
 * 재생 규칙:
 *  - 기본적으로 모든 화면에서 루프 재생한다.
 *  - 아래 두 조건 중 하나라도 참이면 부드럽게 페이드아웃 후 정지한다.
 *      1) 현재 경로가 자체 BGM 을 갖는 "실제 플레이 화면"일 때 (isExcludedPath)
 *      2) useSoundStore.bgmOwned === true (보스/미니보스 등 자체 BGM 이 재생 중)
 *  - 재생 재개 시에는 페이드인으로 자연스럽게 들어온다.
 *  - 볼륨은 useSoundStore.bgmVolume 과 실시간 연동된다.
 *  - 브라우저 자동재생 차단 시 첫 사용자 인터랙션까지 대기 후 시작한다.
 *
 * App.jsx 의 BrowserRouter 내부, Routes 위쪽에 1회만 마운트한다.
 */

// ── 페이드 시간(ms). 뚝 끊김이 심하면 값을 키우고, 더 즉각적이면 줄인다 ──
const FADE_OUT_MS = 600
const FADE_IN_MS  = 800

// ── 전역 홈 BGM 전용 게인(배율) ──
// 설정 슬라이더(bgmVolume)는 보스/게임 BGM 과 공유되므로 슬라이더 값은 그대로 두고,
// "홈 BGM 만" 이 배율만큼 더 작게 재생한다.
// 값이 작을수록 조용하다.
// (예: 슬라이더 50% → 실제 0.5 × 0.2 = 0.1). 더 줄이려면 값을 낮추고, 키우려면 올린다.
const GLOBAL_BGM_GAIN = 0.2

// 자체 BGM 을 가진 "실제 플레이 화면" 경로 (전역 BGM 정지 대상).
// ⚠ 선택/허브 화면(/boss, /game, /game/ranking)은 자체 BGM 이 없으므로 제외하지 않는다
//    → 전역 홈 BGM 이 그대로 재생된다.
const EXCLUDED_GAME_ROUTES = [
  '/game/aibomb',    // AI 폭탄
  '/game/pairs',     // 에이짝 (aizzak)
  '/game/aicross',   // 에이칸 (aikan)
  '/game/aipang',    // AI팡 퍼즐
  '/game/runner',    // 에이런 (airun)
  '/dev-aibomb-preview',
]

function isExcludedPath(pathname) {
  // 보스/엔드보스 "전투" (선택 화면 '/boss' 자체는 제외 대상 아님)
  if (pathname.startsWith('/boss/')) return true
  // 개별 미니게임 (허브 '/game', 랭킹 '/game/ranking' 은 제외 대상 아님)
  return EXCLUDED_GAME_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

export default function GlobalBGM() {
  const { pathname } = useLocation()
  const bgmOwned = useSoundStore((s) => s.bgmOwned)

  const audioRef    = useRef(null)
  const pendingRef  = useRef(null)   // 자동재생 대기 리스너 해제 함수
  const fadeRef     = useRef(null)   // 진행 중 페이드 취소 함수
  const fadingRef   = useRef(false)  // 페이드 중이면 볼륨 구독이 개입하지 않도록 가드

  // 오디오 엘리먼트 1회 생성 + 볼륨 실시간 연동 (마운트 동안 유지)
  useEffect(() => {
    const a = new Audio(bgmSrc)
    a.loop = true
    a.preload = 'auto'
    a.volume = 0            // 첫 재생은 페이드인으로 들어온다
    audioRef.current = a

    // 설정 슬라이더 변경 실시간 반영 (단, 페이드 진행 중에는 개입 금지)
    const unsub = useSoundStore.subscribe((state) => {
      if (audioRef.current && !fadingRef.current) {
        audioRef.current.volume = state.bgmVolume * GLOBAL_BGM_GAIN
      }
    })

    return () => {
      unsub()
      if (fadeRef.current) { fadeRef.current(); fadeRef.current = null }
      if (pendingRef.current) { pendingRef.current(); pendingRef.current = null }
      a.pause()
      a.src = ''
      audioRef.current = null
    }
  }, [])

  // 경로/소유 플래그 변화에 따라 페이드 재생 or 페이드 정지
  useEffect(() => {
    const a = audioRef.current
    if (!a) return

    const clearPending = () => {
      if (pendingRef.current) { pendingRef.current(); pendingRef.current = null }
    }
    const cancelFade = () => {
      if (fadeRef.current) { fadeRef.current(); fadeRef.current = null }
      fadingRef.current = false
    }

    // from → to 로 볼륨을 ms 동안 선형 램프. 완료 시 onDone 호출.
    const fade = (from, to, ms, onDone) => {
      cancelFade()
      const clamp = (v) => Math.max(0, Math.min(1, v))
      const steps = Math.max(1, Math.round(ms / 30))
      let i = 0
      fadingRef.current = true
      a.volume = clamp(from)
      const id = setInterval(() => {
        i += 1
        a.volume = clamp(from + (to - from) * (i / steps))
        if (i >= steps) {
          clearInterval(id)
          fadeRef.current = null
          fadingRef.current = false
          onDone && onDone()
        }
      }, 30)
      fadeRef.current = () => { clearInterval(id) }
    }

    const shouldStop = isExcludedPath(pathname) || bgmOwned

    if (shouldStop) {
      clearPending()
      if (a.paused) { cancelFade(); return }   // 이미 멈춰 있으면 할 일 없음
      // 페이드아웃 후 정지 + 처음으로 되감기
      fade(a.volume, 0, FADE_OUT_MS, () => {
        a.pause()
        a.currentTime = 0
      })
      return
    }

    // ── 재생(페이드인) ──
    const target = useSoundStore.getState().bgmVolume * GLOBAL_BGM_GAIN

    const startPlayback = () => {
      a.volume = 0
      a.play()
        .then(() => fade(0, target, FADE_IN_MS))
        .catch(() => {
          // 자동재생 차단 → 첫 사용자 인터랙션까지 대기
          const onInteract = () => {
            // 대기 사이에 제외 화면으로 이동했을 수 있으니 재검사
            if (!isExcludedPath(window.location.pathname) &&
                !useSoundStore.getState().bgmOwned) {
              a.volume = 0
              a.play().then(() => fade(0, useSoundStore.getState().bgmVolume * GLOBAL_BGM_GAIN, FADE_IN_MS)).catch(() => {})
            }
            clearPending()
          }
          document.addEventListener('click',      onInteract, { once: true })
          document.addEventListener('keydown',    onInteract, { once: true })
          document.addEventListener('touchstart', onInteract, { once: true })
          pendingRef.current = () => {
            document.removeEventListener('click',      onInteract)
            document.removeEventListener('keydown',    onInteract)
            document.removeEventListener('touchstart', onInteract)
          }
        })
    }

    if (a.paused) {
      startPlayback()
    } else {
      // 이미 재생 중(비제외 화면 간 이동 등) — 목표 볼륨과 다르면 부드럽게 보정
      if (Math.abs(a.volume - target) > 0.01) fade(a.volume, target, FADE_IN_MS)
    }
  }, [pathname, bgmOwned])

  return null
}
