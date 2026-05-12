import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'

import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import TradePage from './pages/TradePage'
import EducationPage from './pages/EducationPage'
import ContentViewerPage from './pages/ContentViewerPage'
import MyPage from './pages/MyPage'
import AiChatPage from './pages/AiChatPage'
import MarketAnalysisPage from './pages/MarketAnalysisPage'
import NoticePage from './pages/NoticePage'
import FaqPage from './pages/FaqPage'
import StudyLogPage from './pages/StudyLogPage'
import ScrollToTop from './components/common/ScrollToTop'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', background: '#f4f7fb', color: '#334155', fontSize: '18px'
      }}>
        Loading...
      </div>
    )
  }

  return user ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LoginPage />} />

        <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/trade" element={<PrivateRoute><TradePage /></PrivateRoute>} />

        <Route path="/education" element={<PrivateRoute><EducationPage /></PrivateRoute>} />
        <Route path="/education/content/:slno" element={<PrivateRoute><ContentViewerPage /></PrivateRoute>} />
        <Route path="/education/self/:slno" element={<PrivateRoute><ContentViewerPage /></PrivateRoute>} />

        <Route path="/ai-chat" element={<PrivateRoute><AiChatPage /></PrivateRoute>} />
        <Route path="/market" element={<PrivateRoute><MarketAnalysisPage /></PrivateRoute>} />
        <Route path="/mypage" element={<PrivateRoute><MyPage /></PrivateRoute>} />
        <Route path="/study-log" element={<PrivateRoute><StudyLogPage /></PrivateRoute>} />
        <Route path="/notice" element={<PrivateRoute><NoticePage /></PrivateRoute>} />
        <Route path="/faq" element={<PrivateRoute><FaqPage /></PrivateRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}