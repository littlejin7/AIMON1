import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import SplashLoading from '../../components/loading/SplashLoading'

export default function NaverCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState('')
  const hasRequested = useRef(false)

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    if (!code) {
      setError('인증 코드가 전달되지 않았습니다.')
      return
    }

    if (hasRequested.current) return
    hasRequested.current = true

    const exchangeCode = async () => {
      try {
        const redirectUri = `${window.location.origin}/auth/callback/naver`
        const res = await authApi.socialLoginNaver({
          code,
          redirect_uri: redirectUri,
          state: state || 'naver_state'
        })

        const { access_token, user, streak_reward } = res.data
        setAuth(access_token, user)

        if (streak_reward) {
          alert(`🔥 ${streak_reward.days}일 연속 로그인 달성!!\n\n⭐ +${streak_reward.xp} XP${streak_reward.crowns > 0 ? `\n👑 +${streak_reward.crowns} 왕관` : ''} 보상을 획득했습니다!`)
        }

        navigate('/lesson')
      } catch (err) {
        console.error(err)
        setError(err.response?.data?.detail || '네이버 로그인 중 오류가 발생했습니다.')
      }
    }

    exchangeCode()
  }, [searchParams, navigate, setAuth])

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#ff4d4d', padding: '20px', textAlign: 'center' }}>
        <h2>로그인 실패</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/auth')} style={{ marginTop: '20px', padding: '10px 20px', background: 'var(--clr-primary, #7c3aed)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          로그인 화면으로 돌아가기
        </button>
      </div>
    )
  }

  return <SplashLoading />
}
