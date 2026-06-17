import { useRef, useEffect, useCallback } from 'react'

/**
 * useBossSound
 *
 * Web Audio API로 모든 사운드를 코드로 생성합니다 (외부 파일 없음).
 *
 * BGM 종류: 'miniboss_intro' | 'unitboss_intro' | 'endboss_intro'
 *           | 'battle' | 'clear' | 'fail'
 * SFX 종류: 'attack' | 'hit'
 *
 * 사용법:
 *   const { playBGM, stopBGM, playSFX, setVolume } = useBossSound()
 */
export default function useBossSound() {
  const ctxRef          = useRef(null)
  const bgmNodesRef     = useRef([])
  const volumeRef       = useRef(0.6)
  // battle BGM lookahead scheduler
  const battlePlayRef   = useRef(false)
  const battleTimerRef  = useRef(null)
  const battleNextRef   = useRef(0)

  const BATTLE_BAR  = 1.2   // 1루프 길이(초)
  const LOOKAHEAD   = 3.0
  const INTERVAL_MS = 1000

  // 컴포넌트 unmount 시 모든 사운드 정리
  useEffect(() => {
    return () => {
      _stopAllBgm()
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
    // battle scheduler 정지
    battlePlayRef.current = false
    clearTimeout(battleTimerRef.current)
    // 일반 노드 정리
    bgmNodesRef.current.forEach(n => { try { n.stop() } catch (_) {} })
    bgmNodesRef.current = []
  }

  /** 오실레이터 하나 생성 후 재생 */
  function _note(ac, type, freq, start, dur, vol, freqEnd) {
    const o = ac.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, start)
    if (freqEnd !== undefined) {
      o.frequency.linearRampToValueAtTime(freqEnd, start + dur)
    }
    const g = ac.createGain()
    g.gain.setValueAtTime(vol * volumeRef.current, start)
    g.gain.linearRampToValueAtTime(0, start + dur)
    o.connect(g)
    g.connect(ac.destination)
    o.start(start)
    o.stop(start + dur + 0.01)
    return o
  }

  /** 화이트노이즈 버퍼 생성 후 재생 */
  function _noise(ac, start, dur, vol, decay) {
    const sr  = ac.sampleRate
    const buf = ac.createBuffer(1, Math.ceil(sr * dur), sr)
    const d   = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * decay))
    }
    const src = ac.createBufferSource()
    src.buffer = buf
    const g = ac.createGain()
    g.gain.value = vol * volumeRef.current
    src.connect(g)
    g.connect(ac.destination)
    src.start(start)
    return src
  }

  // ─── BGM 생성 함수들 ─────────────────────────────────────────

  function _playMiniBossIntro(ac) {
    const t   = ac.currentTime
    const seq = [220, 196, 165, 146, 110, 98, 82, 73]
    const nodes = []
    seq.forEach((f, i) => {
      nodes.push(_note(ac, 'sawtooth', f,     t + i * 0.22, 0.25, 0.22))
      nodes.push(_note(ac, 'square',   f * 2, t + i * 0.22, 0.12, 0.10))
    })
    ;[0, 0.44, 0.88, 1.32, 1.76].forEach(dt => {
      nodes.push(_noise(ac, t + dt, 0.1, 0.4, 0.04))
    })
    return nodes
  }

  function _playUnitBossIntro(ac) {
    const t     = ac.currentTime
    const brass = [87, 110, 131, 175, 131, 110, 87, 73]
    const nodes = []

    brass.forEach((f, i) => {
      nodes.push(_note(ac, 'sawtooth', f,       t + i * 0.28, 0.40, 0.28))
      nodes.push(_note(ac, 'sawtooth', f * 2,   t + i * 0.28, 0.35, 0.18))
      nodes.push(_note(ac, 'square',   f * 3,   t + i * 0.28, 0.20, 0.08))
      nodes.push(_note(ac, 'sine',     f * 0.5, t + i * 0.28, 0.40, 0.12))
    })

    ;[0, 0.56, 1.12, 1.68, 2.24].forEach(dt => {
      nodes.push(_noise(ac, t + dt,        0.15, 0.7, 0.030))
      nodes.push(_noise(ac, t + dt + 0.28, 0.10, 0.4, 0.060))
    })

    const choir = [131, 165, 196, 220]
    choir.forEach((f, i) => {
      nodes.push(_note(ac, 'sine', f,     t + i * 0.18, 1.5, 0.15))
      nodes.push(_note(ac, 'sine', f * 2, t + i * 0.18, 1.2, 0.08))
    })

    // 저음 베이스 드론
    const o = ac.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(55, t)
    o.frequency.linearRampToValueAtTime(41, t + 2.8)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.30 * volumeRef.current, t)
    g.gain.linearRampToValueAtTime(0, t + 2.8)
    o.connect(g)
    g.connect(ac.destination)
    o.start(t)
    o.stop(t + 2.9)
    nodes.push(o)

    return nodes
  }

  function _playFinalBossIntro(ac) {
    const t     = ac.currentTime
    const nodes = []

    // 저음 드론
    const o0 = ac.createOscillator()
    o0.type = 'sine'
    o0.frequency.setValueAtTime(40, t)
    const g0 = ac.createGain()
    g0.gain.setValueAtTime(0,                    t)
    g0.gain.linearRampToValueAtTime(0.45 * volumeRef.current, t + 1.0)
    g0.gain.linearRampToValueAtTime(0.35 * volumeRef.current, t + 4.0)
    g0.gain.linearRampToValueAtTime(0,            t + 5.0)
    o0.connect(g0)
    g0.connect(ac.destination)
    o0.start(t)
    o0.stop(t + 5.1)
    nodes.push(o0)

    // 저음 브라스 선율
    const rumble = [55, 58, 52, 49]
    rumble.forEach((f, i) => {
      nodes.push(_note(ac, 'sawtooth', f,     t + i * 0.9, 1.2, 0.25))
      nodes.push(_note(ac, 'square',   f * 2, t + i * 0.9, 0.8, 0.10))
    })

    // 합창 코드 진행
    const chords = [
      [131, 165, 196],
      [123, 155, 185],
      [116, 146, 174],
      [110, 138, 165],
    ]
    chords.forEach((chord, ci) => {
      chord.forEach(f => {
        nodes.push(_note(ac, 'sine',     f,       t + 1.0 + ci * 0.75, 0.9, 0.18))
        nodes.push(_note(ac, 'triangle', f * 2,   t + 1.0 + ci * 0.75, 0.7, 0.08))
        nodes.push(_note(ac, 'sine',     f * 0.5, t + 1.0 + ci * 0.75, 1.0, 0.06))
      })
    })

    // 강한 드럼 히트
    ;[0.8, 1.6, 2.4, 3.2, 4.0].forEach(dt => {
      nodes.push(_noise(ac, t + dt, 0.2, 0.6, 0.025))
    })
    ;[1.4, 2.2, 3.0, 3.8].forEach(dt => {
      nodes.push(_noise(ac, t + dt, 0.12, 0.3, 0.06))
    })

    // 마지막 사이렌 스윕 하강
    const sweep = ac.createOscillator()
    sweep.type = 'sawtooth'
    sweep.frequency.setValueAtTime(800, t + 3.5)
    sweep.frequency.linearRampToValueAtTime(60,  t + 5.0)
    const sg = ac.createGain()
    sg.gain.setValueAtTime(0.12 * volumeRef.current, t + 3.5)
    sg.gain.linearRampToValueAtTime(0, t + 5.0)
    sweep.connect(sg)
    sg.connect(ac.destination)
    sweep.start(t + 3.5)
    sweep.stop(t + 5.1)
    nodes.push(sweep)

    // 마지막 낮은 화음 착지
    nodes.push(_note(ac, 'sine', 65, t + 4.5, 0.6, 0.30))
    nodes.push(_note(ac, 'sine', 55, t + 4.8, 0.5, 0.25))
    nodes.push(_note(ac, 'sine', 41, t + 5.0, 0.8, 0.20))

    return nodes
  }

  function _scheduleBattleBar(ac, t) {
    const bassSeq = [55, 55, 65, 55, 0, 55, 65, 82]
    const melSeq  = [220, 0, 196, 0, 220, 0, 247, 220]
    const noteLen = 0.15

    bassSeq.forEach((f, i) => {
      if (f === 0) return
      const st = t + i * noteLen
      if (st + noteLen < ac.currentTime) return
      const o = ac.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      const g = ac.createGain()
      g.gain.setValueAtTime(0.18 * volumeRef.current, Math.max(st, ac.currentTime))
      g.gain.linearRampToValueAtTime(0, st + noteLen * 0.8)
      o.connect(g); g.connect(ac.destination)
      o.start(Math.max(st, ac.currentTime)); o.stop(st + noteLen)
    })
    melSeq.forEach((f, i) => {
      if (f === 0) return
      const st = t + i * noteLen
      if (st + noteLen < ac.currentTime) return
      const o = ac.createOscillator()
      o.type = 'square'
      o.frequency.value = f
      const g = ac.createGain()
      g.gain.setValueAtTime(0.10 * volumeRef.current, Math.max(st, ac.currentTime))
      g.gain.linearRampToValueAtTime(0, st + noteLen * 0.8)
      o.connect(g); g.connect(ac.destination)
      o.start(Math.max(st, ac.currentTime)); o.stop(st + noteLen)
    })
  }

  function _runBattleScheduler() {
    clearTimeout(battleTimerRef.current)
    if (!battlePlayRef.current) return
    const ac = ctxRef.current
    const until = ac.currentTime + LOOKAHEAD
    while (battleNextRef.current < until) {
      _scheduleBattleBar(ac, battleNextRef.current)
      battleNextRef.current += BATTLE_BAR
    }
    battleTimerRef.current = setTimeout(_runBattleScheduler, INTERVAL_MS)
  }

  function _playBattle(ac) {
    battlePlayRef.current  = true
    battleNextRef.current  = ac.currentTime + 0.05
    _runBattleScheduler()
    return []  // scheduler 방식이므로 노드 배열 불필요
  }

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
    _note(ac, 'square', 440,  t,        0.05, 0.30)
    _note(ac, 'square', 660,  t + 0.05, 0.05, 0.30)
    _note(ac, 'square', 880,  t + 0.10, 0.10, 0.40)
    _note(ac, 'sine',   1320, t + 0.15, 0.20, 0.25, 880)
  }

  function _playHit(ac) {
    const t = ac.currentTime
    _noise(ac, t, 0.3, 0.6, 0.08)
    _note(ac, 'sawtooth', 150, t,        0.05, 0.30, 60)
    _note(ac, 'sawtooth', 80,  t + 0.05, 0.20, 0.25, 30)
  }

  // ─── 공개 API ────────────────────────────────────────────────

  /** BGM 재생. 기존 BGM은 자동으로 정지됩니다. */
  const playBGM = useCallback((type) => {
    const ac = _getCtx()
    _stopAllBgm()

    const doPlay = () => {
      let nodes = []
      switch (type) {
        case 'miniboss_intro':   nodes = _playMiniBossIntro(ac);  break
        case 'unitboss_intro':   nodes = _playUnitBossIntro(ac);  break
        case 'endboss_intro':  nodes = _playFinalBossIntro(ac); break
        case 'battle':           nodes = _playBattle(ac);         break
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

  /** 볼륨 설정 (0.0 ~ 1.0) */
  const setVolume = useCallback((v) => {
    volumeRef.current = Math.max(0, Math.min(1, v))
  }, [])

  return { playBGM, stopBGM, playSFX, setVolume }
}
