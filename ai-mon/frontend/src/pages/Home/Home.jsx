import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { progressApi, userApi, authApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import useHomeSound from '../../hooks/useHomeSound'
import LevelTestModal from '../../components/LevelTestModal/LevelTestModal'
import HomeLanding   from './HomeLanding'
import HomeDashboard from './HomeDashboard'
import './Home.css'

export default function Home() {
  const user       = useAuthStore((s) => s.user)
  const token      = useAuthStore((s) => s.token)
  const updateUser = useAuthStore((s) => s.updateUser)
  const navigate   = useNavigate()
  const { playBGM, stopBGM } = useHomeSound()

  const [stats,         setStats]         = useState(null)
  const [loading,       setLoading]       = useState(!!token)
  const [showLevelTest, setShowLevelTest] = useState(false)

  const handleLevelTestFinish = async (levelKey, updatedUser) => {
    if (token) {
      if (updatedUser) {
        updateUser(updatedUser)
        setShowLevelTest(false)
        navigate('/lesson')
        return
      }
      try {
        const res = await userApi.updateMe({ course_level: levelKey, is_level_tested: true })
        updateUser(res.data)
        navigate('/lesson')
      } catch {
        alert('레벨 설정 변경에 실패했습니다.')
      } finally {
        setShowLevelTest(false)
      }
    } else {
      setShowLevelTest(false)
      navigate(`/register?level=${levelKey}`)
    }
  }

  useEffect(() => {
    playBGM('lounge')
    return () => stopBGM()
  }, [])
  
  useEffect(() => {
    if (!token) { setLoading(false); return }
    // touch() = getMe() + 하루 1회 streak 갱신(KST dedup). getMe() 별도 호출 불필요.
    Promise.all([progressApi.getStats(), authApi.touch()])
      .then(([statsRes, touchRes]) => {
        setStats(statsRes.data)
        updateUser(touchRes.data.user)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [token, updateUser])

  // LevelTestModal은 랜딩/대시보드 양쪽에서 열 수 있어 Home에서 단일 렌더
  const levelTestModal = showLevelTest && (
    <LevelTestModal
      onClose={() => setShowLevelTest(false)}
      onFinish={handleLevelTestFinish}
      isLoggedIn={!!token}
    />
  )

  if (!token) {
    return (
      <>
        {levelTestModal}
        <HomeLanding onOpenLevelTest={() => setShowLevelTest(true)} />
      </>
    )
  }

  if (loading) {
    return (
      <div className="home-loading">
        <div className="spinner" />
        <p>에이몬 로딩 중...</p>
      </div>
    )
  }

  return (
    <>
      {levelTestModal}
      <HomeDashboard
        user={user}
        stats={stats}
        onOpenLevelTest={() => setShowLevelTest(true)}
      />
    </>
  )
}
