import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'

const EDU_API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const MAKE_TYPE_ICONS = {
  '1': '🎬', '2': '📖', '3': '🖼️', '5': '🎮', '6': '📰', '7': '📔', '8': '🎧',
}

export default function TopicDetailPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | playable types

  useEffect(() => {
    setLoading(true)
    fetch(`${EDU_API}/api/education/topics/${code}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [code])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: 80, color: '#94A3B8' }}>불러오는 중...</div>
    </div>
  )

  if (!data) return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: 80, color: '#EF4444' }}>주제를 찾을 수 없습니다.</div>
    </div>
  )

  const { topic, contents } = data
  const safeContents = contents || []
  const playable = safeContents.filter(c => c.is_playable)
  const filtered = filter === 'playable' ? playable : safeContents

  return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC', fontFamily: "'IBM Plex Sans KR', -apple-system, sans-serif" }}>
      <Navbar />

      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', padding: '24px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <button onClick={() => navigate('/education')} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#64748B',
            fontSize: 13, marginBottom: 12, padding: 0, fontFamily: 'inherit',
          }}>← 교육센터로</button>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>{topic.name || '??'}</h1>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#64748B' }}>{topic.category || '-'}</span>
            <span style={{ fontSize: 13, background: '#F0FDF4', color: '#16A34A', padding: '3px 10px', borderRadius: 20 }}>
              콘텐츠 {safeContents.length}건
            </span>
            <span style={{ fontSize: 13, background: '#EFF6FF', color: '#1D4ED8', padding: '3px 10px', borderRadius: 20 }}>
              재생 가능 {playable.length}건
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px' }}>
        {/* 필터 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[{ key: 'all', label: '전체' }, { key: 'playable', label: '재생 가능만' }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              border: filter === f.key ? 'none' : '1px solid #E2E8F0',
              background: filter === f.key ? '#0A3D62' : 'white',
              color: filter === f.key ? 'white' : '#475569',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>{f.label}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>콘텐츠가 없습니다.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {filtered.map(c => (
              <ContentCard key={c.contents_slno} content={c} onClick={() => navigate(`/education/content/${c.contents_slno}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ContentCard({ content, onClick }) {
  const icon = MAKE_TYPE_ICONS[content.make_type_code] || '📄'
  return (
    <div onClick={onClick} style={{
      background: 'white', borderRadius: 16, padding: '20px',
      border: '1px solid #E2E8F0', cursor: 'pointer', transition: 'all 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(10,61,98,0.1)'; e.currentTarget.style.borderColor = '#0A3D62' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#E2E8F0' }}
    >
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 28, flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 11, background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: 20 }}>
              {content.make_type_name || '???'}
            </span>
            {content.is_playable && (
              <span style={{ fontSize: 11, background: '#D1FAE5', color: '#047857', padding: '2px 8px', borderRadius: 20 }}>
                재생 가능
              </span>
            )}
            {(content.playtime || content.playtime_minutes) && (
              <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: 20 }}>
                {content.playtime || (content.playtime_minutes ? `${content.playtime_minutes}?` : '')}
              </span>
            )}
          </div>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', lineHeight: 1.4 }}>
            {content.title || '?? ??'}
          </h4>
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5, marginBottom: 12 }}>
        {content.summary?.slice(0, 100) || '??? ????.'}{content.summary?.length > 100 ? '...' : ''}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>{content.provider_name} · {content.producing_yr}</span>
        <span style={{ fontSize: 12, color: '#0A3D62', fontWeight: 600 }}>
          {content.is_playable ? '바로 학습 →' : 'AI 요약 보기 →'}
        </span>
      </div>
    </div>
  )
}
