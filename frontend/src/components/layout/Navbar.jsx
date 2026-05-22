import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useThemeMode } from '../../hooks/useThemeMode'
import { useState, useEffect, useRef } from 'react'

export default function Navbar() {
  const { signOut } = useAuth()
  const location = useLocation()
  const { theme, effective, setTheme } = useThemeMode()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const isActive = (path) => location.pathname.startsWith(path)

  // 홈 화면인지 확인합니다.
  // 홈 화면은 기존 빨간 그라데이션을 그대로 유지하고,
  // 홈이 아닌 페이지에서만 초록색 메뉴바 스타일을 적용합니다.
  const isHomePage = location.pathname.startsWith('/home')

  // 3-상태 순환 토글: light → dark → system → light
  const cycleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
  }
  const themeLabel = effective === 'dark' ? 'Dark Mode' : 'Light Mode'

  const resetChatStorage = () => {
    localStorage.removeItem('judy:aiChatMessages')
    localStorage.removeItem('judy:aiChatInput')
  }

  // 햄버거 메뉴 바깥을 클릭하면 메뉴를 닫습니다.
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <nav className={`navbar ${isHomePage ? '' : 'green-navbar'}`} ref={menuRef}>
      <div className="navbar-left">
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          ☰
        </button>
        <span className="nav-title">Menu</span>
      </div>

      <div className="navbar-right">
        <button
          type="button"
          className="theme-cycle-btn"
          onClick={cycleTheme}
          title={`화면 스타일: ${themeLabel} (클릭하여 변경)`}
          aria-label={`현재 화면 스타일 ${themeLabel}, 클릭하여 변경`}
        >
          {themeLabel}
        </button>

        <button className="btn-logout" onClick={signOut}>
          로그아웃
        </button>
      </div>

      {menuOpen && (
        <div className={`nav-menu ${isHomePage ? '' : 'green-nav-menu'}`}>
          <Link to="/home" onClick={resetChatStorage} className={isActive('/home') ? 'active' : ''}>Home</Link>
          <Link to="/education" onClick={resetChatStorage} className={isActive('/education') ? 'active' : ''}>교육센터</Link>
          <Link to="/market" onClick={resetChatStorage} className={isActive('/market') ? 'active' : ''}>마켓분석</Link>
          <Link to="/trade" onClick={resetChatStorage} className={isActive('/trade') ? 'active' : ''}>주식매매</Link>
          <Link to="/mypage" onClick={resetChatStorage} className={isActive('/mypage') ? 'active' : ''}>계좌연결</Link>
          <Link to="/ai-chat" className={isActive('/ai-chat') ? 'active' : ''}>AI 챗봇</Link>
          <Link to="/study-log" onClick={resetChatStorage} className={isActive('/study-log') ? 'active' : ''}>Study Log</Link>
          <Link to="/notice" onClick={resetChatStorage} className={isActive('/notice') ? 'active' : ''}>공지사항</Link>
          <Link to="/faq" onClick={resetChatStorage} className={isActive('/faq') ? 'active' : ''}>FAQ</Link>
        </div>
      )}
    </nav>
  )
}