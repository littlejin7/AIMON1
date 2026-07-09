import { useRef, useEffect, useCallback } from 'react'
import { useSoundStore } from './useSoundStore'
import bgmSrc from '@/assets/bgm/main_home_bgm.mp3'
/**
 * useHomeSound
 * 메인/홈 화면 BGM(main_home_bgm.mp3)을 루프 재생합니다.
 *
 * - 볼륨은 useSoundStore.bgmVolume 과 연동되어 설정 슬라이더가 실시간 반영됩니다.
 * - 브라우저 자동재생 정책 대응:
 *     playBGM() 호출 시 재생이 차단되면 첫 사용자 인터랙션(click/keydown/touch)까지
 *     대기했다가 자동으로 시작합니다.
 *
 * API 는 기존과 동일: { playBGM, stopBGM }
 * (playBGM(type) 의 type 인자는 하위호환을 위해 받기만 하고 무시합니다.)
 */
export default function useHomeSound() {
  const audioRef      = useRef(null)
  const unsubscribeRef = useRef(null)
  const pendingRef    = useRef(null)   // 자동재생 대기용 리스너 해제 함수

  // ─── 내부 유틸 ───────────────────────────────────────────────

  function _getAudio() {
    if (!audioRef.current) {
      const a = new Audio(bgmSrc)
      a.loop = true
      a.preload = 'auto'
      a.volume = useSoundStore.getState().bgmVolume
      audioRef.current = a

      // 스토어 볼륨 변경 실시간 반영
      unsubscribeRef.current = useSoundStore.subscribe((state) => {
        if (audioRef.current) audioRef.current.volume = state.bgmVolume
      })
    }
    return audioRef.current
  }

  function _clearPending() {
    if (pendingRef.current) {
      pendingRef.current()
      pendingRef.current = null
    }
  }

  // 컴포넌트 unmount 시 정리
  useEffect(() => {
    return () => {
      _clearPending()
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [])

  // ─── 공개 API ────────────────────────────────────────────────

  const playBGM = useCallback((/* type 무시 */) => {
    const a = _getAudio()
    a.volume = useSoundStore.getState().bgmVolume

    const tryPlay = () => a.play()

    tryPlay().catch(() => {
      // 자동재생 차단 → 첫 인터랙션까지 대기
      const onInteract = () => {
        a.play().catch(() => {})
        _clearPending()
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
  }, [])

  const stopBGM = useCallback(() => {
    _clearPending()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [])

  return { playBGM, stopBGM }
}
