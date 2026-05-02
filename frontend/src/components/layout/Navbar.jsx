import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const location = useLocation()

  const isActive = (path) => {
    if (path === '/education') return location.pathname.startsWith('/education') || location.pathname.startsWith('/ai-chat')
    if (path === '/market')    return location.pathname.startsWith('/market')
    if (path === '/mypage')    return location.pathname.startsWith('/mypage')
    return location.pathname === path
  }

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <span className="nav-logo">📈</span>
        <span className="nav-title">SafeInvest AI</span>
        <div className="nav-links">
          <Link to="/education" className={`nav-link ${isActive('/education') ? 'active' : ''}`}>
            교육센터
          </Link>
          <Link to="/market" className={`nav-link ${isActive('/market') ? 'active' : ''}`}>
            마켓분석
          </Link>
          <Link to="/trade" className={`nav-link ${isActive('/trade') ? 'active' : ''}`}>
            주식매매
          </Link>
        </div>
      </div>
      <div className="navbar-right">
        <span className="user-email">{user?.email}</span>
        <Link
          to="/mypage"
          className={`nav-link ${isActive('/mypage') ? 'active' : ''}`}
          style={{ fontSize: '0.82rem', padding: '0.25rem 0.65rem' }}
        >
          회원정보
        </Link>
        <button className="btn-logout" onClick={signOut}>로그아웃</button>
      </div>
    </nav>
  )
}
