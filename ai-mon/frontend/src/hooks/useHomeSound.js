import { useRef, useEffect, useCallback } from 'react'
import { useSoundStore } from './useSoundStore'
/**
 * useHomeSound
 * lookahead scheduler 방식으로 BGM을 안정적으로 루프 재생합니다.
 * (수만 개 노드를 한 번에 만들지 않고, 2~3초 앞만 예약 → 타이머로 반복)
 *
 * 브라우저 자동재생 정책 대응:
 *   playBGM() 호출 시 AudioContext가 suspended면 첫 클릭까지 대기 후 자동 시작
 */
export default function useHomeSound() {
  const ctxRef         = useRef(null)
  const isPlayingRef   = useRef(false)
  const schedulerRef   = useRef(null)
  const nextBarTimeRef = useRef(0)
  const _bgmVol = () => useSoundStore.getState().bgmVolume

  const currentTypeRef = useRef('lounge')

  const BEAT         = 0.18
  const BAR_DURATION = BEAT * 16   // adventure 1루프 2.88s
  const LOUNGE_BAR   = 2.0         // lounge 1루프 2.0s
  const LOOKAHEAD    = 3.0
  const INTERVAL_MS  = 1200

  useEffect(() => {
    return () => {
      _stop()
      if (ctxRef.current) {
        ctxRef.current.close()
        ctxRef.current = null
      }
    }
  }, [])

  // ─── 내부 유틸 ───────────────────────────────────────────────

  function _getCtx() {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return ctxRef.current
  }

  function _stop() {
    isPlayingRef.current = false
    clearTimeout(schedulerRef.current)
  }

  function _note(ac, type, freq, start, dur, vol) {
    if (start + dur < ac.currentTime) return   // 이미 지난 노트는 스킵
    const o = ac.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = ac.createGain()
    g.gain.setValueAtTime(vol * _bgmVol(), Math.max(start, ac.currentTime))
    g.gain.linearRampToValueAtTime(0, start + dur)
    o.connect(g)
    g.connect(ac.destination)
    o.start(Math.max(start, ac.currentTime))
    o.stop(start + dur + 0.01)
  }

  function _hat(ac, start, vol) {
    if (start < ac.currentTime) return
    const sr  = ac.sampleRate
    const len = Math.ceil(sr * 0.06)
    const buf = ac.createBuffer(1, len, sr)
    const d   = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.015))
    }
    const src = ac.createBufferSource()
    src.buffer = buf
    const g = ac.createGain()
    g.gain.value = vol * _bgmVol()
    src.connect(g)
    g.connect(ac.destination)
    src.start(start)
  }

  // ─── Lounge BGM 1바 예약 (2.0s / 루프) ─────────────────────
  function _scheduleLoungeBar(ac, t) {
    const pad  = [196, 247, 294, 330]
    const beat = 0.5

    pad.forEach((f, i) => {
      const st = t + i * beat
      if (st + beat < ac.currentTime) return

      const o = ac.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ac.createGain()
      const s = Math.max(st, ac.currentTime)
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.10 * _bgmVol(), s + 0.25)
      g.gain.linearRampToValueAtTime(0.07 * _bgmVol(), st + beat * 0.85)
      g.gain.linearRampToValueAtTime(0, st + beat * 1.05)
      o.connect(g); g.connect(ac.destination)
      o.start(s); o.stop(st + beat * 1.1)

      // 옥타브 위 배음
      const o2 = ac.createOscillator()
      o2.type = 'triangle'
      o2.frequency.value = f * 2
      const g2 = ac.createGain()
      g2.gain.setValueAtTime(0, s)
      g2.gain.linearRampToValueAtTime(0.04 * _bgmVol(), s + 0.25)
      g2.gain.linearRampToValueAtTime(0, st + beat)
      o2.connect(g2); g2.connect(ac.destination)
      o2.start(s); o2.stop(st + beat + 0.01)
    })


    // 저음 베이스 (2박마다)
    ;[98, 110].forEach((f, i) => {
      const st = t + i * 1.0
      if (st + 0.8 < ac.currentTime) return
      _note(ac, 'sine', f, Math.max(st, ac.currentTime), 0.8, 0.12)
    })
  }

  // ─── 어드벤처 BGM 1바 예약 ───────────────────────────────────

  function _scheduleBar(ac, t) {
    const mel  = [523, 659, 784, 659, 523, 587, 659, 523,
                  523, 659, 784, 880, 784, 659, 784, 523]
    const bass = [131, 131, 165, 131, 131, 131, 175, 131]

    mel.forEach((f, i) => {
      _note(ac, 'square',   f,       t + i * BEAT,     BEAT * 0.75, 0.12)
      _note(ac, 'sine',     f * 0.5, t + i * BEAT,     BEAT * 0.90, 0.06)
    })
    bass.forEach((f, i) => {
      _note(ac, 'triangle', f,       t + i * BEAT * 2, BEAT * 1.5,  0.14)
    })
    ;[0, 2, 4, 6, 8, 10, 12, 14].forEach(i => {
      _hat(ac, t + i * BEAT, 0.15)
    })
  }

  // ─── 스케줄러 루프 ───────────────────────────────────────────

  function _runScheduler() {
    clearTimeout(schedulerRef.current)
    if (!isPlayingRef.current) return

    const ac    = ctxRef.current
    const until = ac.currentTime + LOOKAHEAD
    const type  = currentTypeRef.current
    const barDur = type === 'lounge' ? LOUNGE_BAR : BAR_DURATION

    while (nextBarTimeRef.current < until) {
      if (type === 'lounge') _scheduleLoungeBar(ac, nextBarTimeRef.current)
      else                   _scheduleBar(ac, nextBarTimeRef.current)
      nextBarTimeRef.current += barDur
    }

    schedulerRef.current = setTimeout(_runScheduler, INTERVAL_MS)
  }

  function _startScheduler(type) {
    const ac = ctxRef.current
    currentTypeRef.current = type
    isPlayingRef.current   = true
    nextBarTimeRef.current = ac.currentTime + 0.05
    _runScheduler()
  }

  // ─── 공개 API ────────────────────────────────────────────────

  const playBGM = useCallback((type = 'lounge') => {
    const ac = _getCtx()

    if (ac.state === 'running') {
      if (!isPlayingRef.current) _startScheduler(type)
      return
    }

    // suspended → 첫 인터랙션까지 대기
    const onInteract = () => {
      ac.resume().then(() => {
        if (!isPlayingRef.current) _startScheduler(type)
      })
    }

    document.addEventListener('click',      onInteract, { once: true })
    document.addEventListener('keydown',    onInteract, { once: true })
    document.addEventListener('touchstart', onInteract, { once: true })
  }, [])

  const stopBGM = useCallback(() => {
    _stop()
  }, [])


  return { playBGM, stopBGM }
}
