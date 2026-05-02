import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  // 이미 로그인된 상태면 대시보드로
  useEffect(() => {
    if (!authLoading && user) navigate('/education', { replace: true })
  }, [user, authLoading, navigate])

  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode]           = useState('login')
  const [signupDone, setSignupDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          // Supabase 에러 메시지 한국어 변환
          if (error.message.includes('Invalid login credentials'))
            throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.')
          if (error.message.includes('Email not confirmed'))
            throw new Error('이메일 인증이 필요합니다. 받은 편지함을 확인해 주세요.')
          throw error
        }
        // onAuthStateChange → useAuth → LoginPage useEffect가 /education으로 이동
      } else {
        // 비밀번호 최소 길이 확인
        if (password.length < 6) throw new Error('비밀번호는 6자리 이상이어야 합니다.')

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // 이메일 인증 후 리다이렉트 URL (배포 URL 자동 감지)
            emailRedirectTo: `${window.location.origin}/`,
          },
        })
        if (error) throw error

        // Supabase v2: 이미 가입된 이메일은 error 없이 identities:[] 반환 (보안 정책)
        if (data.user && data.user.identities?.length === 0) {
          throw new Error('이미 가입된 이메일입니다. 로그인을 시도해 주세요.')
        }

        setSignupDone(true)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) return null

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-icon">📈</span>
          <h1>SafeInvest AI</h1>
          <p className="logo-sub">건전한 투자를 위한 AI 가이드</p>
        </div>

        {signupDone ? (
          <div className="signup-done">
            <p>이메일 인증 링크를 전송했습니다.</p>
            <p>받은 메일함을 확인하고 인증 후 로그인해 주세요.</p>
            <button className="btn-primary" onClick={() => { setSignupDone(false); setMode('login') }}>
              로그인으로 이동
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="tab-row">
              <button type="button" className={`tab-btn ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>로그인</button>
              <button type="button" className={`tab-btn ${mode === 'signup' ? 'active' : ''}`} onClick={() => setMode('signup')}>회원가입</button>
            </div>

            <div className="form-group">
              <label>이메일</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com" required />
            </div>
            <div className="form-group">
              <label>비밀번호</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="6자리 이상" required autoComplete="current-password" />
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
            </button>
          </form>
        )}

        <p className="login-footer">
          🔒 모의투자 모드 | 실제 돈이 사용되지 않습니다
        </p>
      </div>
    </div>
  )
}
