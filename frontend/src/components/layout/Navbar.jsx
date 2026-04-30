import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const location = useLocation()

  const isActive = (path) => {
    if (path === '/ai-chat') return location.pathname.startsWith('/ai-chat')
    if (path === '/education') return location.pathname.startsWith('/education')
    return location.pathname === path
  }

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <span className="nav-logo">📈</span>
        <span className="nav-title">SafeInvest AI</span>
        <div className="nav-links">
          <Link
            to="/education"
            className={`nav-link ${isActive('/education') ? 'active' : ''}`}
          >
            교육센터
          </Link>
          <Link
            to="/ai-chat"
            className={`nav-link ${isActive('/ai-chat') ? 'active' : ''}`}
          >
            AI 챗봇
          </Link>
          <Link
            to="/trade"
            className={`nav-link ${isActive('/trade') ? 'active' : ''}`}
          >
            주식거래
          </Link>
        </div>
      </div>
      <div className="navbar-right">
        <span className="mock-badge">비공개 학생 프로젝트</span>
        <span className="user-email">{user?.email}</span>
        <button className="btn-logout" onClick={signOut}>로그아웃</button>
      </div>
    </nav>
  )
}
