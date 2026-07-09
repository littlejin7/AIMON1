import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { progressApi, userApi, authApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import useHomeSound from '../../hooks/useHomeSound'
import LevelTestModal from '../../components/LevelTestModal/LevelTestModal'
import InfoModal from '../../components/InfoModal/InfoModal'
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
  const [levelTestErrorMsg, setLevelTestErrorMsg] = useState(null)

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
        setLevelTestErrorMsg('레벨 설정 변경에 실패했습니다.')
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
    // touch()는 출석 갱신 보조 요청이므로 실패해도 홈 통계 로딩을 막지 않는다.
    let cancelled = false

    const loadHome = async () => {
      try {
        const statsRes = await progressApi.getStats()
        if (!cancelled) setStats(statsRes.data)
      } catch (err) {
        console.error(err)
      }

      try {
        const touchRes = await authApi.touch()
        if (!cancelled && touchRes.data?.user) {
          updateUser(touchRes.data.user)
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadHome()
    return () => { cancelled = true }
  }, [token, updateUser])

  // LevelTestModal은 랜딩/대시보드 양쪽에서 열 수 있어 Home에서 단일 렌더
  const levelTestModal = showLevelTest && (
    <LevelTestModal
      onClose={() => setShowLevelTest(false)}
      onFinish={handleLevelTestFinish}
      isLoggedIn={!!token}
    />
  )
  const levelTestErrorModal = (
    <InfoModal
      icon="⚠️"
      message={levelTestErrorMsg}
      onConfirm={() => setLevelTestErrorMsg(null)}
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
      {levelTestErrorModal}
      <HomeDashboard
        user={user}
        stats={stats}
        onOpenLevelTest={() => setShowLevelTest(true)}
      />
    </>
  )
}
