import { useRef, useEffect, useCallback } from 'react'
import { useSoundStore } from './useSoundStore'
import minibossSrc from '@/assets/bgm/miniboss_bgm.mp3'
import unitbossSrc from '@/assets/bgm/unitboss_bgm.mp3'
import endbossSrc  from '@/assets/bgm/endboss_bgm.mp3'
/**
 * useBossSound
 *
 * BGM: 보스 등장~전투는 MP3 파일을 루프 재생합니다.
 *   - 'miniboss_intro' | 'battle' → miniboss_bgm.mp3 (하나의 곡을 끊김 없이 루프)
 *   - 'unitboss_intro' → unitboss_bgm.mp3
 *   - 'endboss_intro' → endboss_bgm.mp3
 * 결과 효과음('clear' | 'fail')과 SFX('attack' | 'hit')는 Web Audio 코드 생성.
 *
 * BGM 종류: 'miniboss_intro' | 'unitboss_intro' | 'endboss_intro'
 *           | 'battle' | 'clear' | 'fail'
 * SFX 종류: 'attack' | 'hit'
 *
 * 사용법:
 *   const { playBGM, stopBGM, playSFX, setVolume } = useBossSound()
 */

// 파일로 재생되는 BGM 타입 → 소스 매핑.
// 같은 파일이 매핑된 타입끼리는 재생 중 재시작 없이 이어집니다(intro→battle 끊김 없음).
const BGM_FILES = {
  miniboss_intro: minibossSrc,
  battle:         minibossSrc,
  unitboss_intro: unitbossSrc,
  endboss_intro:  endbossSrc,
}

export default function useBossSound() {
  const ctxRef          = useRef(null)
  const bgmNodesRef     = useRef([])
  const _bgmVol = () => useSoundStore.getState().bgmVolume
  const _sfxVol = () => useSoundStore.getState().sfxVolume
  // 파일 BGM
  const fileAudioRef    = useRef(null)   // 현재 재생 중인 HTMLAudioElement
  const fileSrcRef      = useRef(null)   // 현재 로드된 소스 URL
  const volSubRef       = useRef(null)   // 볼륨 스토어 구독 해제 함수
  const filePendingRef  = useRef(null)   // 자동재생 대기 리스너 해제 함수

  // 컴포넌트 unmount 시 모든 사운드 정리
  useEffect(() => {
    return () => {
      _stopAllBgm()
      if (volSubRef.current) { volSubRef.current(); volSubRef.current = null }
      if (fileAudioRef.current) {
        fileAudioRef.current.src = ''
        fileAudioRef.current = null
      }
      if (ctxRef.current) {
        ctxRef.current.close()
        ctxRef.current = null
      }
    }
  }, [])

  // ─── 내부 유틸 ────────────────────────────────────────────────

  function _getCtx() {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }

  function _stopAllBgm() {
    // 파일 BGM 정지
    _clearFilePending()
    if (fileAudioRef.current) {
      fileAudioRef.current.pause()
      fileAudioRef.current.currentTime = 0
    }
    fileSrcRef.current = null
    // 일반 노드 정리
    bgmNodesRef.current.forEach(n => { try { n.stop() } catch (_) {} })
    bgmNodesRef.current = []
    // 전역 홈 BGM 재개 허용 (보스/미니보스 BGM 종료 신호)
    useSoundStore.getState().setBgmOwned(false)
  }

  function _clearFilePending() {
    if (filePendingRef.current) {
      filePendingRef.current()
      filePendingRef.current = null
    }
  }

  /** 파일 BGM 재생. 같은 소스가 이미 재생 중이면 재시작하지 않고 그대로 이어감. */
  function _playFileBgm(src) {
    // 같은 곡이 이미 재생 중이면 유지 (intro→battle 끊김 없음)
    if (fileSrcRef.current === src && fileAudioRef.current && !fileAudioRef.current.paused) {
      return
    }
    _stopAllBgm()

    let a = fileAudioRef.current
    if (!a) {
      a = new Audio()
      a.loop = true
      a.preload = 'auto'
      fileAudioRef.current = a
      // 스토어 볼륨 실시간 반영
      volSubRef.current = useSoundStore.subscribe((state) => {
        if (fileAudioRef.current) fileAudioRef.current.volume = state.bgmVolume
      })
    }
    if (a.src !== src) a.src = src
    a.currentTime = 0
    a.volume = _bgmVol()
    fileSrcRef.current = src

    a.play().catch(() => {
      // 자동재생 차단 → 첫 인터랙션까지 대기
      const onInteract = () => {
        if (fileSrcRef.current === src) a.play().catch(() => {})
        _clearFilePending()
      }
      document.addEventListener('click',      onInteract, { once: true })
      document.addEventListener('keydown',    onInteract, { once: true })
      document.addEventListener('touchstart', onInteract, { once: true })
      filePendingRef.current = () => {
        document.removeEventListener('click',      onInteract)
        document.removeEventListener('keydown',    onInteract)
        document.removeEventListener('touchstart', onInteract)
      }
    })
  }

  /** 오실레이터 하나 생성 후 재생 */
  function _note(ac, type, freq, start, dur, vol, freqEnd, volMult = _bgmVol()) {
    const o = ac.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, start)
    if (freqEnd !== undefined) {
      o.frequency.linearRampToValueAtTime(freqEnd, start + dur)
    }
    const g = ac.createGain()
    g.gain.setValueAtTime(vol * volMult, start)
    g.gain.linearRampToValueAtTime(0, start + dur)
    o.connect(g)
    g.connect(ac.destination)
    o.start(start)
    o.stop(start + dur + 0.01)
    return o
  }

  /** 화이트노이즈 버퍼 생성 후 재생 */
  function _noise(ac, start, dur, vol, decay, volMult = _bgmVol()) {
    const sr  = ac.sampleRate
    const buf = ac.createBuffer(1, Math.ceil(sr * dur), sr)
    const d   = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * decay))
    }
    const src = ac.createBufferSource()
    src.buffer = buf
    const g = ac.createGain()
    g.gain.value = vol * volMult
    src.connect(g)
    g.connect(ac.destination)
    src.start(start)
    return src
  }

  // ─── BGM 생성 함수들 ─────────────────────────────────────────

  function _playClear(ac) {
    const t      = ac.currentTime
    const mel    = [523, 659, 784, 1047, 784, 1047, 1175, 1319]
    const durs   = [0.15, 0.15, 0.15, 0.30, 0.10, 0.15, 0.15, 0.50]
    const nodes  = []
    let cursor   = t
    mel.forEach((f, i) => {
      nodes.push(_note(ac, 'sine',     f,       cursor, durs[i], 0.30))
      nodes.push(_note(ac, 'triangle', f * 0.5, cursor, durs[i], 0.10))
      cursor += durs[i] * 0.9
    })
    return nodes
  }

  function _playFail(ac) {
    const t      = ac.currentTime
    const mel    = [392, 349, 311, 262, 233, 196]
    const durs   = [0.20, 0.20, 0.25, 0.30, 0.30, 0.60]
    const nodes  = []
    let cursor   = t
    mel.forEach((f, i) => {
      nodes.push(_note(ac, 'sawtooth', f,       cursor, durs[i],       0.30))
      nodes.push(_note(ac, 'sine',     f * 0.5, cursor, durs[i] * 1.2, 0.10))
      cursor += durs[i] * 0.85
    })
    return nodes
  }

  // ─── SFX 생성 함수들 ─────────────────────────────────────────

  function _playAttack(ac) {
    const t = ac.currentTime
    const sv = _sfxVol()
    _note(ac, 'square', 440,  t,        0.05, 0.30, undefined, sv)
    _note(ac, 'square', 660,  t + 0.05, 0.05, 0.30, undefined, sv)
    _note(ac, 'square', 880,  t + 0.10, 0.10, 0.40, undefined, sv)
    _note(ac, 'sine',   1320, t + 0.15, 0.20, 0.25, 880,       sv)
  }

  function _playHit(ac) {
    const t = ac.currentTime
    const sv = _sfxVol()
    _noise(ac, t, 0.3, 0.6, 0.08, sv)
    _note(ac, 'sawtooth', 150, t,        0.05, 0.30, 60,  sv)
    _note(ac, 'sawtooth', 80,  t + 0.05, 0.20, 0.25, 30,  sv)
  }

  // ─── 공개 API ────────────────────────────────────────────────

  /** BGM 재생. 기존 BGM은 자동으로 정지됩니다. */
  const playBGM = useCallback((type) => {
    // 파일로 재생되는 타입(보스 등장~전투)
    if (BGM_FILES[type]) {
      _playFileBgm(BGM_FILES[type])
      // 전역 홈 BGM 정지 신호 (_playFileBgm 내부 _stopAllBgm 이 false 로 만든 뒤 재설정)
      useSoundStore.getState().setBgmOwned(true)
      return
    }

    // Web Audio 코드 생성 타입(보스 인트로 일부 / 결과 효과음)
    const ac = _getCtx()
    _stopAllBgm()
    // 전역 홈 BGM 정지 신호
    useSoundStore.getState().setBgmOwned(true)

    const doPlay = () => {
      let nodes = []
      switch (type) {
        case 'clear':            nodes = _playClear(ac);          break
        case 'fail':             nodes = _playFail(ac);           break
        default:
          console.warn(`useBossSound: 알 수 없는 BGM 타입 "${type}"`)
      }
      bgmNodesRef.current = nodes
    }

    // await 이후 호출 시 suspended 상태일 수 있으므로 resume 후 재생
    if (ac.state === 'suspended') {
      ac.resume().then(doPlay)
    } else {
      doPlay()
    }
  }, [])

  /** 현재 재생 중인 BGM 정지 */
  const stopBGM = useCallback(() => {
    _stopAllBgm()
  }, [])

  /** SFX 재생 (BGM과 독립적으로 재생됩니다) */
  const playSFX = useCallback((type) => {
    const ac = _getCtx()
    const doPlay = () => {
      switch (type) {
        case 'attack': _playAttack(ac); break
        case 'hit':    _playHit(ac);    break
        default:
          console.warn(`useBossSound: 알 수 없는 SFX 타입 "${type}"`)
      }
    }
    if (ac.state === 'suspended') {
      ac.resume().then(doPlay)
    } else {
      doPlay()
    }
  }, [])

  return { playBGM, stopBGM, playSFX }
}
