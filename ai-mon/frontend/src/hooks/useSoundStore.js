import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * useSoundStore
 * BGM / SFX 볼륨을 전역으로 관리하고 localStorage에 유지합니다.
 *
 * 사운드 훅(useBossSound, useHomeSound)에서는
 * useSoundStore.getState() 로 값을 읽어 React 외부에서도 사용 가능합니다.
 */
export const useSoundStore = create(
  persist(
    (set) => ({
      bgmVolume: 0.55,   // 배경음악 볼륨 (0.0 ~ 1.0)
      sfxVolume: 0.60,   // 효과음 볼륨   (0.0 ~ 1.0)
      setBgmVolume: (v) => set({ bgmVolume: Math.max(0, Math.min(1, v)) }),
      setSfxVolume: (v) => set({ sfxVolume: Math.max(0, Math.min(1, v)) }),
    }),
    { name: 'aimon-sound' }
  )
)
