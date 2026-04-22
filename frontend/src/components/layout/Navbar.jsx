import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const location = useLocation()

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <span className="nav-logo">📈</span>
        <span className="nav-title">SafeInvest AI</span>
        <div className="nav-links">
          <Link to="/education" className={`nav-link ${location.pathname.startsWith('/education') ? 'active' : ''}`}>교육</Link>
          <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>기업개요</Link>
          <Link to="/trade" className={`nav-link ${location.pathname === '/trade' ? 'active' : ''}`}>주식거래</Link>
        </div>
      </div>
      <div className="navbar-right">
        <span className="mock-badge">🎮 모의투자</span>
        <span className="user-email">{user?.email}</span>
        <button className="btn-logout" onClick={signOut}>로그아웃</button>
      </div>
    </nav>
  )
}
