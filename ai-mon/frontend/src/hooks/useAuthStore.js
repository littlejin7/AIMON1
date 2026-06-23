import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { userApi } from '../api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      theme: 'dark',
      setAuth: (token, user, refreshToken = null) => {
        localStorage.removeItem('is_train_unlocked')
        if (user) {
          localStorage.removeItem(`is_train_unlocked_${user.id}`)
        }
        set({ 
          token, 
          user, 
          refreshToken: refreshToken !== null ? refreshToken : get().refreshToken 
        })
      },
      updateUser: (user) => set({ user }),
      logout: () => {
        const currentUser = get().user
        if (currentUser) {
          localStorage.removeItem(`is_train_unlocked_${currentUser.id}`)
        }
        localStorage.removeItem('is_train_unlocked')
        set({ token: null, refreshToken: null, user: null })
      },
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme)
        set({ theme })
      },
      purchaseTheme: async (themeId) => {
        try {
          const res = await userApi.purchaseTheme(themeId)
          set({ user: res.data.user })
          return { success: true, xpSpent: res.data.xp_spent }
        } catch (err) {
          const msg = err.response?.data?.detail || '구매에 실패했습니다.'
          return { success: false, error: msg }
        }
      },
      bgmVolume: 0.5,
      sfxVolume: 0.8,
      setBgmVolume: (v) => set({ bgmVolume: v }),
      setSfxVolume: (v) => set({ sfxVolume: v }),
    }),
    {
      name: 'aimon-auth',
    }
  )
)
