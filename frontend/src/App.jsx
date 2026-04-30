import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TradePage from './pages/TradePage'
import EducationPage from './pages/EducationPage'
import TopicDetailPage from './pages/TopicDetailPage'
import ContentViewerPage from './pages/ContentViewerPage'
import CurriculumDetailPage from './pages/CurriculumDetailPage'
import MyPage from './pages/MyPage'
import AiChatPage from './pages/AiChatPage'

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
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/trade" element={<PrivateRoute><TradePage /></PrivateRoute>} />

        {/* ── 교육 모듈 (인증 필요) ── */}
        <Route path="/education" element={<PrivateRoute><EducationPage /></PrivateRoute>} />
        <Route path="/education/topic/:code" element={<PrivateRoute><TopicDetailPage /></PrivateRoute>} />
        <Route path="/education/content/:slno" element={<PrivateRoute><ContentViewerPage /></PrivateRoute>} />
        <Route path="/education/self/:slno" element={<PrivateRoute><ContentViewerPage /></PrivateRoute>} />
        <Route path="/education/curriculum" element={<PrivateRoute><CurriculumDetailPage /></PrivateRoute>} />
        <Route path="/education/curriculum/:pathId" element={<PrivateRoute><CurriculumDetailPage /></PrivateRoute>} />
        <Route path="/ai-chat" element={<PrivateRoute><AiChatPage /></PrivateRoute>} />

        {/* ── 마이페이지 (KIS 계좌 연결) ── */}
        <Route path="/mypage" element={<PrivateRoute><MyPage /></PrivateRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
