import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  // 로그인 상태면 홈 이동
  useEffect(() => {
    if (!authLoading && user) navigate('/home', { replace: true })
  }, [user, authLoading, navigate])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState('login')
  const [signupDone, setSignupDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSignupDone(true)
      }
    } catch (e) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) return null

  return (
    <div className="login-bg">
      <div className="login-card glass">

        <div className="login-logo">
          <img src="/login_logo.png"style={{ width: '200px', height: '200px', objectFit: 'contain' }} />
          <p className="logo-sub">건전한 주식 투자를 위한 AI 가이드</p>
        </div>

        {signupDone ? (
          <div className="signup-done">
            <p>이메일 인증 링크를 전송했습니다.</p>
            <p>받은 메일함을 확인하고 인증 후 로그인해 주세요.</p>
            <button
              className="btn-primary"
              onClick={() => {
                setSignupDone(false)
                setMode('login')
              }}
            >
              로그인으로 이동
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">

            <div className="tab-row">
              <button
                type="button"
                className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
                onClick={() => setMode('login')}
              >
                로그인
              </button>
              <button
                type="button"
                className={`tab-btn ${mode === 'signup' ? 'active' : ''}`}
                onClick={() => setMode('signup')}
              >
                회원가입
              </button>
            </div>

            <div className="form-group">
              <label>이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
              />
            </div>

            <div className="form-group">
              <label>비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자리 이상"
                required
                autoComplete="current-password"
              />
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
            </button>
          </form>
        )}

        <p className="login-footer">
          🔒 모의투자 모드 → 실제 돈이 사용되지 않습니다.
        </p>
      </div>
    </div>
  )
}