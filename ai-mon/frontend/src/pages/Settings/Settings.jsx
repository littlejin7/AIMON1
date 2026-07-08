import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../hooks/useAuthStore'
import { useSoundStore } from '../../hooks/useSoundStore'
import { userApi, authApi } from '../../api/index'
import './Settings.css'

// 닉네임 중복확인/저장 에러를 사용자용 메시지로 변환 (Register.jsx와 동일 규칙)
function getNicknameErrorMessage(err) {
  const status = err?.response?.status
  const detail = err?.response?.data?.detail
  if (status === 404) {
    return '닉네임 확인 기능을 찾을 수 없습니다. 서버를 확인해주세요.'
  }
  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }
  return '이미 사용 중인 닉네임입니다.'
}

const CHARACTER_ICON = {
  slime: '/src/assets/character_slime.png',
  robot: '/src/assets/character_robot.png',
  speech_bubble: '/src/assets/character_bubble.png',
  final_ghost: '/src/assets/character_final_ghost.png',
}

const LEVELS = [
  { key: 'beginner', emoji: '🏹', label: 'beginner', desc: 'Python 기초부터 차근차근' },
  { key: 'intermediate', emoji: '⚡', label: 'intermediate', desc: '기초를 알고 심화로 도전' },
  { key: 'advanced', emoji: '🔥', label: 'advanced', desc: 'f-string급 실력자 전용' },
]

export default function Settings() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const logout = useAuthStore((s) => s.logout)
  const bgmVolume = useSoundStore((s) => s.bgmVolume)
  const sfxVolume = useSoundStore((s) => s.sfxVolume)
  const setBgmVolume = useSoundStore((s) => s.setBgmVolume)
  const setSfxVolume = useSoundStore((s) => s.setSfxVolume)

  const [nickname, setNickname] = useState(user?.nickname || '')
  const [nickSaving, setNickSaving] = useState(false)
  const [nickSaved, setNickSaved] = useState(false)
  const [nickChecking, setNickChecking] = useState(false)
  const [nickChecked, setNickChecked] = useState(false)
  const [nickMsg, setNickMsg] = useState(null) // { type: 'ok' | 'err', text: string } | null
  const [courseLevel, setCourseLevel] = useState(user?.course_level || 'beginner')
  const [levelSaving, setLevelSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteNotice, setDeleteNotice] = useState(null)
  const deleteRedirectTimerRef = useRef(null)

  const [notifs, setNotifs] = useState({
    streak: true,
    boss: true,
    daily: true,
    updates: false,
  })

  useEffect(() => {
    return () => {
      if (deleteRedirectTimerRef.current) {
        clearTimeout(deleteRedirectTimerRef.current)
      }
    }
  }, [])

  const handleNickChange = (e) => {
    setNickname(e.target.value)
    // 입력이 바뀌면 이전 중복확인 결과를 무효화 — 다시 확인해야 저장 가능
    setNickChecked(false)
    setNickMsg(null)
  }

  const handleNickCheck = async () => {
    const trimmed = nickname.trim()
    if (trimmed.length < 2) {
      setNickChecked(false)
      setNickMsg({ type: 'err', text: '닉네임은 2자 이상 입력해주세요.' })
      return
    }
    if (trimmed === user?.nickname) {
      // 현재 닉네임 그대로면 확인 불필요 (저장 버튼은 어차피 비활성)
      setNickChecked(true)
      setNickMsg({ type: 'ok', text: '현재 사용 중인 닉네임입니다.' })
      return
    }
    setNickChecking(true)
    setNickMsg(null)
    try {
      await authApi.checkNickname(trimmed)
      setNickChecked(true)
      setNickMsg({ type: 'ok', text: '사용 가능한 닉네임입니다.' })
    } catch (err) {
      setNickChecked(false)
      setNickMsg({ type: 'err', text: getNicknameErrorMessage(err) })
    } finally {
      setNickChecking(false)
    }
  }

  const handleNickSave = async (e) => {
    e.preventDefault()
    if (!nickChecked) {
      setNickMsg({ type: 'err', text: '닉네임 중복확인을 먼저 해주세요.' })
      return
    }
    setNickSaving(true)
    try {
      const res = await userApi.updateMe({ nickname })
      updateUser(res.data)
      setNickChecked(false)
      setNickMsg(null)
      setNickSaved(true)
      setTimeout(() => setNickSaved(false), 2000)
    } catch (err) {
      // 확인 후 저장 사이에 선점됐을 수 있으므로 서버 에러도 노출
      setNickChecked(false)
      setNickMsg({ type: 'err', text: getNicknameErrorMessage(err) })
    } finally {
      setNickSaving(false)
    }
  }

  const handleLevelChange = async (key) => {
    if (key === courseLevel || levelSaving) return
    setLevelSaving(true)
    const prevLevel = courseLevel
    setCourseLevel(key)
    try {
      const res = await userApi.updateMe({ course_level: key })
      updateUser(res.data)
      setCourseLevel(res.data?.course_level || key)
    } catch (err) {
      setCourseLevel(prevLevel)
      console.error(err)
    } finally {
      setLevelSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  const handleDeleteAccount = () => {
    if (deleting) return
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false)
    setDeleting(true)
    try {
      await userApi.deleteMe()
      setDeleteNotice({ type: 'success', message: '계정이 삭제되었습니다.' })
      deleteRedirectTimerRef.current = setTimeout(() => {
        logout()
        navigate('/')
      }, 1200)
    } catch {
      setDeleteNotice({ type: 'error', message: '탈퇴 처리에 실패했습니다. 다시 시도해주세요.' })
    } finally {
      setDeleting(false)
    }
  }

  const toggleNotif = (key) => setNotifs((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="st-page">
      {showDeleteConfirm && (
        <div className="st-modal-overlay" onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div className="st-modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="st-modal-title">정말 탈퇴하시겠습니까?</h2>
            <p className="st-modal-desc">탈퇴 시 계정 정보와 진행 데이터가 삭제될 수 있습니다.</p>
            <div className="st-modal-actions">
              <button
                type="button"
                className="st-modal-btn st-modal-btn-ghost"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                취소
              </button>
              <button
                type="button"
                className="st-modal-btn st-modal-btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? '처리 중...' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteNotice && (
        <div className={`st-toast st-toast-${deleteNotice.type}`}>
          {deleteNotice.message}
        </div>
      )}

      <div className="st-topbar">
        <button className="st-back-btn" onClick={() => navigate(-1)} aria-label="뒤로">
          ✕
        </button>
        <span className="st-topbar-title">설정</span>
      </div>

      <div className="st-scroll">
        <p className="st-section-label">프로필</p>
        <div className="st-group">
          <div className="st-profile-top">
            <div className="st-avatar">
              <img
                src={CHARACTER_ICON[user?.character] || CHARACTER_ICON.slime}
                alt="캐릭터"
              />
            </div>
            <div>
              <div className="st-p-id">@{user?.username || user?.email?.split('@')[0]}</div>
              <div className="st-p-sub">내 프로필</div>
            </div>
          </div>
          <form className="st-nickname-wrap" onSubmit={handleNickSave}>
            <div className="st-nick-label">닉네임</div>
            <div className="st-nick-row">
              <input
                className="st-nick-input"
                type="text"
                value={nickname}
                onChange={handleNickChange}
                placeholder="닉네임을 입력하세요"
                maxLength={10}
              />
              <button
                type="button"
                className="st-nick-check-btn"
                onClick={handleNickCheck}
                disabled={nickChecking || nickname.trim() === user?.nickname}
              >
                {nickChecking ? '확인 중...' : '중복확인'}
              </button>
            </div>
            {nickMsg && (
              <div className={`st-nick-msg ${nickMsg.type}`}>
                {nickMsg.type === 'ok' ? '✅ ' : '❌ '}{nickMsg.text}
              </div>
            )}
            <button
              type="submit"
              className="st-save-btn"
              disabled={nickSaving || nickname === user?.nickname || !nickChecked}
            >
              {nickSaved ? '저장 완료' : nickSaving ? '저장 중...' : '저장하기'}
            </button>
          </form>
        </div>

        <p className="st-section-label">계정</p>
        <div className="st-group">
          <div className="st-srow">
            <div className="st-srow-icon" style={{ background: 'rgba(24,95,165,0.18)' }}>@</div>
            <div className="st-srow-text"><div className="st-srow-label">이메일 변경</div></div>
            <span className="st-chevron">›</span>
          </div>
          <div className="st-srow">
            <div className="st-srow-icon" style={{ background: 'rgba(15,110,86,0.18)' }}>PW</div>
            <div className="st-srow-text"><div className="st-srow-label">비밀번호 변경</div></div>
            <span className="st-chevron">›</span>
          </div>
          <div className="st-srow">
            <div className="st-srow-icon" style={{ background: 'rgba(95,94,90,0.12)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-text-muted)' }}>S</span>
            </div>
            <div className="st-srow-text">
              <div className="st-srow-label">소셜 계정 연결</div>
              <div className="st-srow-sub">Google / Naver / Kakao</div>
            </div>
            <span className="st-chevron">›</span>
          </div>
        </div>

        <p className="st-section-label">알림</p>
        <div className="st-group">
          {[
            { key: 'streak', icon: '🔥', bg: 'rgba(133,79,11,0.18)', label: '스트릭 알림', sub: '오늘 학습을 안 했을 때' },
            { key: 'boss', icon: '⚔️', bg: 'rgba(163,45,45,0.18)', label: '보스 도전 알림' },
            { key: 'daily', icon: '📅', bg: 'rgba(83,74,183,0.18)', label: '데일리 미션 알림' },
            { key: 'updates', icon: '🔔', bg: 'rgba(95,94,90,0.12)', label: '업데이트 및 공지' },
          ].map(({ key, icon, bg, label, sub }) => (
            <div
              key={key}
              className="st-srow"
              onClick={() => toggleNotif(key)}
              style={{ cursor: 'pointer' }}
            >
              <div className="st-srow-icon" style={{ background: bg }}>{icon}</div>
              <div className="st-srow-text">
                <div className="st-srow-label">{label}</div>
                {sub && <div className="st-srow-sub">{sub}</div>}
              </div>
              <div className={`st-toggle ${notifs[key] ? 'on' : 'off'}`}>
                <div className="st-toggle-knob" />
              </div>
            </div>
          ))}
        </div>

        <p className="st-section-label">사운드</p>
        <div className="st-group">
          <div className="st-sound-wrap">
            <div className="st-sound-row">
              <div className="st-sound-top">
                <span className="st-sound-name">배경음악</span>
                <span className="st-sound-pct">{Math.round(bgmVolume * 100)}%</span>
              </div>
              <div className="st-sound-controls">
                <button className="st-mute-btn" onClick={() => setBgmVolume(0)} aria-label="배경음악 음소거">M</button>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={bgmVolume}
                  onChange={(e) => setBgmVolume(Number(e.target.value))}
                  className="st-slider"
                />
                <button className="st-vol-btn" onClick={() => setBgmVolume(Math.min(1, bgmVolume + 0.1))} aria-label="배경음악 볼륨 올리기">+</button>
              </div>
            </div>
            <div className="st-divider" />
            <div className="st-sound-row">
              <div className="st-sound-top">
                <span className="st-sound-name">효과음</span>
                <span className="st-sound-pct">{Math.round(sfxVolume * 100)}%</span>
              </div>
              <div className="st-sound-controls">
                <button className="st-mute-btn" onClick={() => setSfxVolume(0)} aria-label="효과음 음소거">M</button>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={sfxVolume}
                  onChange={(e) => setSfxVolume(Number(e.target.value))}
                  className="st-slider"
                />
                <button className="st-vol-btn" onClick={() => setSfxVolume(Math.min(1, sfxVolume + 0.1))} aria-label="효과음 볼륨 올리기">+</button>
              </div>
            </div>
          </div>
        </div>

        <p className="st-section-label">학습 레벨</p>
        <div className="st-group">
          <div className="st-level-hint">학습 난이도와 AI 설명 기준을 바꿀 수 있습니다.</div>
          {LEVELS.map(({ key, emoji, label, desc }) => {
            const unlockedLevels = user?.unlocked_course_levels || ['beginner']
            const isCurrent = courseLevel === key
            const isLocked = !unlockedLevels.includes(key)
            return (
              <div
                key={key}
                className={`st-level-row${isCurrent ? ' current' : ''}${isLocked ? ' locked' : ''}`}
                onClick={() => !isLocked && handleLevelChange(key)}
              >
                <span className="st-level-icon">{emoji}</span>
                <div className="st-level-info">
                  <div className={`st-level-name${isCurrent ? ' current' : isLocked ? ' locked' : ''}`}>{label}</div>
                  <div className="st-level-desc">{desc}</div>
                </div>
                {isCurrent ? (
                  <span className="st-current-tag">현재</span>
                ) : isLocked ? (
                  <span className="st-lock-tag">🔒 잠금</span>
                ) : (
                  <span className="st-current-tag">선택 가능</span>
                )}
              </div>
            )
          })}
        </div>

        <p className="st-section-label">앱 정보</p>
        <div className="st-group">
          <div className="st-info-row">
            <span className="st-info-label">버전</span>
            <span className="st-info-val accent">v1.0.0 MVP</span>
          </div>
          <div className="st-info-row">
            <span className="st-info-label">개발</span>
            <span className="st-info-val">AI MON Team</span>
          </div>
          <div className="st-info-row">
            <span className="st-info-label">문의</span>
            <span className="st-info-val" style={{ color: 'var(--clr-primary)' }}>support@aimon.app</span>
          </div>
          <div className="st-info-row" style={{ cursor: 'pointer' }}>
            <span className="st-info-label">이용약관</span>
            <span className="st-chevron">›</span>
          </div>
          <div className="st-info-row" style={{ cursor: 'pointer' }}>
            <span className="st-info-label">개인정보처리방침</span>
            <span className="st-chevron">›</span>
          </div>
        </div>

        <p className="st-section-label">계정 관리</p>
        <button id="btn-logout" className="st-logout-btn" onClick={handleLogout}>
          로그아웃
        </button>
        <button className="st-delete-btn" onClick={handleDeleteAccount} disabled={deleting}>
          {deleting ? '탈퇴 처리 중...' : '계정 탈퇴'}
        </button>

        <p className="st-footer">AI MON made with care</p>
      </div>
    </div>
  )
}
