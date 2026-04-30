import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Navbar from '../components/layout/Navbar'

const EDU_API = 'http://localhost:8000'

export default function SelfContentPage() {
  const { slno } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${EDU_API}/api/self-contents/${slno}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [slno])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: 80, color: '#94A3B8' }}>불러오는 중...</div>
    </div>
  )

  if (!data?.content) return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: 80, color: '#EF4444' }}>콘텐츠를 찾을 수 없습니다.</div>
    </div>
  )

  // SelfContent는 ContentViewerPage로 리다이렉트 (통합 뷰어 사용)
  // 단, 직접 접근 시 ContentViewerPage 내용을 여기서도 표시
  navigate(`/education/content/${slno}`, { replace: true })
  return null
}
