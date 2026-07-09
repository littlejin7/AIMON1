import { useEffect, useRef } from 'react'
import { useSoundStore } from './useSoundStore'

/**
 * useGameBgm
 * 미니게임 BGM(MP3)을 컴포넌트 mount 동안 루프 재생하는 재사용 훅.
 *
 *   useGameBgm(aizzakSrc)              // 마운트 시 재생, 언마운트 시 정지
 *   useGameBgm(aizzakSrc, { enabled }) // enabled=false 면 정지
 *
 * - 볼륨은 useSoundStore.bgmVolume 과 실시간 연동 (설정 슬라이더 반영)
 * - 브라우저 자동재생 차단 시 첫 사용자 인터랙션(click/keydown/touch)까지 대기 후 시작
 *
 * @param {string}  src               번들된 mp3 URL
 * @param {object}  [opts]
 * @param {boolean} [opts.enabled=true] false 면 재생하지 않고 정지
 */
export default function useGameBgm(src, { enabled = true } = {}) {
  const audioRef   = useRef(null)
  const pendingRef = useRef(null)   // 자동재생 대기 리스너 해제 함수

  useEffect(() => {
    if (!src || !enabled) return

    const a = new Audio(src)
    a.loop = true
    a.preload = 'auto'
    a.volume = useSoundStore.getState().bgmVolume
    audioRef.current = a

    // 볼륨 실시간 반영
    const unsub = useSoundStore.subscribe((state) => {
      if (audioRef.current) audioRef.current.volume = state.bgmVolume
    })

    const clearPending = () => {
      if (pendingRef.current) { pendingRef.current(); pendingRef.current = null }
    }

    a.play().catch(() => {
      // 자동재생 차단 → 첫 인터랙션까지 대기
      const onInteract = () => {
        a.play().catch(() => {})
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

    return () => {
      clearPending()
      unsub()
      a.pause()
      a.src = ''
      audioRef.current = null
    }
  }, [src, enabled])
}
