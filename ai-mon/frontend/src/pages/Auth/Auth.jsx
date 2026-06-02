import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import './Auth.css'

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ username: '', password: '', nickname: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const fn = mode === 'login' ? authApi.login : authApi.register
      const res = await fn(form)
      setAuth(res.data.access_token, res.data.user)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || '오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-orb orb-1" />
      <div className="auth-bg-orb orb-2" />

      <div className="auth-container animate-fade-in-up">
        <div className="auth-logo">
          <span className="auth-logo-emoji animate-float">🤖</span>
          <h1 className="auth-title">에이몬</h1>
          <p className="auth-subtitle">코딩을 게임처럼, AI와 함께!</p>
        </div>

        <div className="auth-tabs">
          <button
            id="tab-login"
            className={`auth-tab${mode === 'login' ? ' active' : ''}`}
            onClick={() => { setMode('login'); setError('') }}
          >
            로그인
          </button>
          <button
            id="tab-register"
            className={`auth-tab${mode === 'register' ? ' active' : ''}`}
            onClick={() => { setMode('register'); setError('') }}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">아이디</label>
            <input
              id="username"
              name="username"
              type="text"
              className="input"
              placeholder="아이디를 입력하세요"
              value={form.username}
              onChange={handleChange}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              placeholder="비밀번호를 입력하세요"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'register' && (
            <div className="form-group animate-fade-in">
              <label htmlFor="nickname">닉네임</label>
              <input
                id="nickname"
                name="nickname"
                type="text"
                className="input"
                placeholder="닉네임 (선택)"
                value={form.nickname}
                onChange={handleChange}
                autoComplete="nickname"
              />
            </div>
          )}

          {error && (
            <div className="auth-error animate-fade-in">
              ⚠️ {error}
            </div>
          )}

          <button
            id="btn-auth-submit"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading
              ? <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> 처리 중...</>
              : mode === 'login' ? '🚀 로그인' : '✨ 시작하기'
            }
          </button>
        </form>

        <p className="auth-footer">
          코딩 학습의 새로운 경험을 시작하세요 🎮
        </p>
      </div>
    </div>
  )
}
