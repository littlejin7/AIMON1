// ═══════════════════════════════════════════════════════════════
//  hooks/useAudio.js — AudioContext, BGM, 볼륨 관리
// ═══════════════════════════════════════════════════════════════

import { useRef, useState, useCallback, useEffect } from 'react';
import { createAudioCtx, startBgm } from '../audio';

export function useAudio() {
  const audioCtxRef   = useRef(null);
  const masterGainRef = useRef(null);
  const stopBgmRef    = useRef(null);
  const volumeRef     = useRef(70);  // ref로 최신 볼륨 유지 (클로저 문제 방지)

  const [volume, setVolumeState] = useState(70);

  // 볼륨 설정 (state + GainNode + ref 동기화)
  const setVolumeTo = useCallback((val) => {
    volumeRef.current = val;
    setVolumeState(val);
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = val / 100;
    }
  }, []);

  const handleVolume = useCallback((e) => {
    setVolumeTo(Number(e.target.value));
  }, [setVolumeTo]);

  const toggleMute = useCallback(() => {
    setVolumeTo(volumeRef.current === 0 ? 70 : 0);
  }, [setVolumeTo]);

  // 첫 사용자 인터랙션 시 AudioContext + BGM 초기화
  const ensureAudio = useCallback(() => {
    if (audioCtxRef.current) return audioCtxRef.current;
    const ctx = createAudioCtx();
    const masterGain = ctx.createGain();
    masterGain.gain.value = volumeRef.current / 100;
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;
    audioCtxRef.current = ctx;
    stopBgmRef.current = startBgm(ctx, masterGain);
    return ctx;
  }, []);

  // 재시작 시 오디오 컨텍스트 재생성
  const restartAudio = useCallback(() => {
    stopBgmRef.current?.();
    try { audioCtxRef.current?.close(); } catch(e) {}
    const ctx = createAudioCtx();
    const masterGain = ctx.createGain();
    masterGain.gain.value = volumeRef.current / 100;
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;
    audioCtxRef.current = ctx;
    stopBgmRef.current = startBgm(ctx, masterGain);
  }, []);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      stopBgmRef.current?.();
      try { audioCtxRef.current?.close(); } catch(e) {}
    };
  }, []);

  return {
    audioCtxRef,
    masterGainRef,
    stopBgmRef,
    ensureAudio,
    restartAudio,
    volume,
    handleVolume,
    toggleMute,
  };
}
