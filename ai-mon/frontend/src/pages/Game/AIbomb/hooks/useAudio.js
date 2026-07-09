// ═══════════════════════════════════════════════════════════════
//  hooks/useAudio.js — 효과음(SFX) 전용 AudioContext 관리
//  · BGM 은 useGameBgm(전역 bgmVolume 연동)이 담당한다.
//  · 효과음 볼륨은 전역 useSoundStore.sfxVolume 에 실시간 연동된다.
//    → 게임 내 볼륨 UI 없이 설정 페이지 슬라이더가 BGM·SFX 를 모두 지배.
// ═══════════════════════════════════════════════════════════════

import { useRef, useCallback, useEffect } from 'react';
import { createAudioCtx } from '../audio';
import { useSoundStore } from '../../../../hooks/useSoundStore';

export function useAudio() {
  const audioCtxRef = useRef(null);
  const sfxGainRef  = useRef(null);
  const unsubRef    = useRef(null);

  // 첫 사용자 제스처 시 AudioContext 생성 (브라우저 자동재생 정책 대응).
  // 효과음 gain 을 전역 sfxVolume 으로 초기화하고, 이후 설정 변경을 실시간 반영한다.
  const ensureAudio = useCallback(() => {
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    }
    const ctx = createAudioCtx();
    const sfxGain = ctx.createGain();
    sfxGain.gain.value = useSoundStore.getState().sfxVolume;
    sfxGain.connect(ctx.destination);

    // 전역 효과음 볼륨(설정 슬라이더) 실시간 반영
    unsubRef.current = useSoundStore.subscribe((state) => {
      if (sfxGainRef.current) sfxGainRef.current.gain.value = state.sfxVolume;
    });

    sfxGainRef.current = sfxGain;
    audioCtxRef.current = ctx;
    return ctx;
  }, []);

  // 재시작 시에도 동일 컨텍스트 재사용 (BGM 은 useGameBgm 이 관리하므로 별도 처리 불필요)
  const restartAudio = ensureAudio;

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      unsubRef.current?.();
      try { audioCtxRef.current?.close(); } catch (e) {}
    };
  }, []);

  return { audioCtxRef, sfxGainRef, ensureAudio, restartAudio };
}
