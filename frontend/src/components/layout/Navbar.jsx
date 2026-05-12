import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useState, useEffect, useRef } from 'react'

export default function Navbar() {
  const { signOut } = useAuth()
  const location = useLocation()

  const [menuOpen, setMenuOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const menuRef = useRef(null)

  const isActive = (path) => location.pathname.startsWith(path)

  // 홈 화면인지 확인합니다.
  // 홈 화면은 기존 빨간 그라데이션을 그대로 유지하고,
  // 홈이 아닌 페이지에서만 초록색 메뉴바 스타일을 적용합니다.
  const isHomePage = location.pathname.startsWith('/home')

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

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
        <div
          onClick={() => setIsDark(prev => !prev)}
          style={{
            width: 44,
            height: 24,
            borderRadius: 20,
            background: isDark ? '#E2E8F0' : '#334155',
            display: 'flex',
            alignItems: 'center',
            padding: '2px',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'white',
              transform: isDark ? 'translateX(20px)' : 'translateX(0)',
              transition: 'all 0.2s',
            }}
          />
        </div>

        <button className="btn-logout" onClick={signOut}>
          로그아웃
        </button>
      </div>

      {menuOpen && (
        <div className={`nav-menu ${isHomePage ? '' : 'green-nav-menu'}`}>
          <Link to="/home" className={isActive('/home') ? 'active' : ''}>홈</Link>
          <Link to="/education" className={isActive('/education') ? 'active' : ''}>교육센터</Link>
          <Link to="/market" className={isActive('/market') ? 'active' : ''}>마켓분석</Link>
          <Link to="/trade" className={isActive('/trade') ? 'active' : ''}>주식매매</Link>
          <Link to="/mypage" className={isActive('/mypage') ? 'active' : ''}>계좌 연결</Link>
          <Link to="/ai-chat" className={isActive('/ai-chat') ? 'active' : ''}>AI 챗봇</Link>
          <Link to="/study-log" className={isActive('/study-log') ? 'active' : ''}>Study Log</Link>
          <Link to="/notice" className={isActive('/notice') ? 'active' : ''}>공지사항</Link>
          <Link to="/faq" className={isActive('/faq') ? 'active' : ''}>FAQ</Link>
        </div>
      )}
    </nav>
  )
}