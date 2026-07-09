import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * useSoundStore
 * BGM / SFX 볼륨을 전역으로 관리하고 localStorage에 유지합니다.
 *
 * 사운드 훅(useBossSound, useGameBgm)과 GlobalBGM 컴포넌트에서는
 * useSoundStore.getState() 로 값을 읽어 React 외부에서도 사용 가능합니다.
 */
export const useSoundStore = create(
  persist(
    (set) => ({
      bgmVolume: 0.5,    // 배경음악 볼륨 (0.0 ~ 1.0) — 신규 유저 기본값 50%
      sfxVolume: 0.60,   // 효과음 볼륨   (0.0 ~ 1.0)
      setBgmVolume: (v) => set({ bgmVolume: Math.max(0, Math.min(1, v)) }),
      setSfxVolume: (v) => set({ sfxVolume: Math.max(0, Math.min(1, v)) }),

      // ─── 전역 BGM 조율 ───────────────────────────────────────────
      // 보스/미니보스/게임 등 "자체 BGM"을 재생하는 화면이 켜지면 true 로 세팅.
      // GlobalBGM(전역 홈 BGM)은 이 값이 true 이면 재생을 멈춰 겹침을 방지한다.
      // (런타임 상태이므로 persist 대상에서 제외 — 아래 partialize 참고)
      bgmOwned: false,
      setBgmOwned: (v) => set({ bgmOwned: !!v }),
    }),
    {
      name: 'aimon-sound',
      // 볼륨만 localStorage 에 유지. bgmOwned 같은 런타임 플래그는 저장하지 않는다
      // (저장 시 새로고침에서 stale true 가 로드돼 전역 BGM 이 영구 정지되는 버그 방지).
      partialize: (state) => ({
        bgmVolume: state.bgmVolume,
        sfxVolume: state.sfxVolume,
      }),
    }
  )
)
