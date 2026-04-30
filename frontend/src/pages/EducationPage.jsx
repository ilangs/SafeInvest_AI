import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'

const EDU_API = 'http://localhost:8000'

export default function EducationPage() {
  const navigate = useNavigate()
  const [topics, setTopics] = useState([])
  const [selfContents, setSelfContents] = useState([])
  const [selfCategories, setSelfCategories] = useState([])
  const [selectedCat, setSelectedCat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')

  useEffect(() => {
    Promise.all([
      fetch(`${EDU_API}/api/education/topics`).then(r => r.json()),
      fetch(`${EDU_API}/api/self-contents`).then(r => r.json()),
    ])
      .then(([topicsData, selfData]) => {
        setTopics(topicsData.all_topics || [])
        setSelfContents(selfData.contents || [])
        setSelfCategories(selfData.categories || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filteredSelf = useMemo(() => {
    return selectedCat
      ? selfContents.filter(c => c.category_code === selectedCat)
      : selfContents
  }, [selectedCat, selfContents])

  const topicsByCategory = useMemo(() => {
    return topics.reduce((acc, topic) => {
      const key = topic.category || '기타'
      if (!acc[key]) acc[key] = []
      acc[key].push(topic)
      return acc
    }, {})
  }, [topics])

  return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC', fontFamily: "'IBM Plex Sans KR', -apple-system, sans-serif" }}>
      <Navbar />

      {activeTab === 'home' && (
        <>
          <div
            style={{
              background: 'linear-gradient(135deg, #0A3D62 0%, #1E5F8A 100%)',
              color: 'white',
              padding: '48px 32px',
              textAlign: 'center',
            }}
          >
            <div style={{ maxWidth: 960, margin: '0 auto' }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  color: '#93C5FD',
                  marginBottom: 12,
                  textTransform: 'uppercase',
                }}
              >
                SafeInvest AI 학습 경로 안내
              </div>
              <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16, lineHeight: 1.2 }}>
                기본기부터 학습 경로까지
                <br />
                <span style={{ color: '#34D399' }}>SafeInvest</span>와 함께 시작하세요
              </h1>
              <p style={{ fontSize: 16, color: '#BFDBFE', marginBottom: 32, maxWidth: 560, margin: '0 auto 32px' }}>
                교육 주제와 학습 경로를 한눈에 보고, 필요한 콘텐츠로 바로 이동해 보세요.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[
                  { label: '교육주제', count: `${topics.length}개`, tab: 'topics' },
                  { label: '기본기 영상', count: `${selfContents.length}개`, tab: 'basic' },
                  { label: '학습경로', count: '12개', tab: 'curriculum' },
                ].map(item => (
                  <button
                    key={item.tab}
                    onClick={() => setActiveTab(item.tab)}
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: 12,
                      padding: '12px 24px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 20 }}>{item.count}</div>
                    <div style={{ opacity: 0.85 }}>{item.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 64, zIndex: 40 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'flex', gap: 4 }}>
          {[
            { key: 'home', label: '홈' },
            { key: 'basic', label: '기본기' },
            { key: 'topics', label: '교육주제' },
            { key: 'curriculum', label: '학습경로' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '14px 20px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: 'inherit',
                color: activeTab === tab.key ? '#0A3D62' : '#64748B',
                borderBottom: activeTab === tab.key ? '2px solid #0A3D62' : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>불러오는 중...</div>
        ) : (
          <>
            {activeTab === 'home' && (
              <div>
                <SectionHeader
                  title="SafeInvest 기본기 영상"
                  subtitle="투자 시작 전 꼭 알아야 할 핵심 기본기를 영상으로 학습하세요."
                  onMore={() => setActiveTab('basic')}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 48 }}>
                  {selfContents.slice(0, 4).map(content => (
                    <SelfContentCard
                      key={content.contents_slno}
                      content={content}
                      onClick={() => navigate(`/education/self/${content.contents_slno}`)}
                    />
                  ))}
                </div>

                <SectionHeader
                  title="교육 주제"
                  subtitle="금감원 e-금융교육센터 공식 자료를 주제별로 탐색해 보세요."
                  onMore={() => setActiveTab('topics')}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 48 }}>
                  {topics.filter(topic => topic.has_real_data).slice(0, 8).map(topic => (
                    <TopicCard
                      key={topic.code}
                      topic={topic}
                      onClick={() => navigate(`/education/topic/${topic.code}`)}
                    />
                  ))}
                </div>

                <div
                  style={{
                    background: 'linear-gradient(135deg, #0A3D62, #1E5F8A)',
                    borderRadius: 20,
                    padding: '40px 48px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 24,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <h3 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>학습 경로</h3>
                    <p style={{ color: '#BFDBFE', fontSize: 14 }}>나의 상황에 맞는 12개의 체계적인 학습 경로를 선택해 보세요.</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('curriculum')}
                    style={{
                      background: 'white',
                      color: '#0A3D62',
                      padding: '12px 28px',
                      borderRadius: 12,
                      fontSize: 15,
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontFamily: 'inherit',
                    }}
                  >
                    학습경로 둘러보기 →
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'basic' && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>SafeInvest 기본기 영상</h2>
                  <p style={{ color: '#64748B' }}>투자 시작 전 꼭 알아야 할 핵심 기본기를 먼저 확인해 보세요.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                  <FilterChip label="전체" active={!selectedCat} onClick={() => setSelectedCat(null)} />
                  {selfCategories.map(cat => (
                    <FilterChip
                      key={cat.code}
                      label={`${cat.icon} ${cat.name}`}
                      active={selectedCat === cat.code}
                      onClick={() => setSelectedCat(cat.code)}
                    />
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                  {filteredSelf.map(content => (
                    <SelfContentCard
                      key={content.contents_slno}
                      content={content}
                      onClick={() => navigate(`/education/self/${content.contents_slno}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'topics' && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>교육 주제</h2>
                  <p style={{ color: '#64748B' }}>금감원 e-금융교육센터 공식 자료를 주제별로 탐색해 보세요. 총 {topics.length}개 주제가 준비되어 있습니다.</p>
                </div>
                {Object.entries(topicsByCategory).map(([category, categoryTopics]) => (
                  <div key={category} style={{ marginBottom: 36 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#475569', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #E2E8F0' }}>
                      {category}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                      {categoryTopics.map(topic => (
                        <TopicCard
                          key={topic.code}
                          topic={topic}
                          onClick={() => navigate(`/education/topic/${topic.code}`)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'curriculum' && <CurriculumSection navigate={navigate} />}
          </>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle, onMore }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{title}</h2>
        <p style={{ fontSize: 13, color: '#64748B' }}>{subtitle}</p>
      </div>
      {onMore && (
        <button
          onClick={onMore}
          style={{
            background: 'none',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            color: '#475569',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          더보기 →
        </button>
      )}
    </div>
  )
}

function SelfContentCard({ content, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(10,61,98,0.12)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'none'
      }}
    >
      <div style={{ background: 'linear-gradient(135deg, #0A3D62, #1E5F8A)', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 40 }}>{content.category_icon || '📘'}</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, background: '#D1FAE5', color: '#047857', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
            SafeInvest 기본기
          </span>
          <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: 20 }}>
            {content.playtime_minutes || 0}분
          </span>
        </div>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', lineHeight: 1.4, marginBottom: 8 }}>
          {content.title}
        </h4>
        <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
          {content.summary?.slice(0, 80)}
          {content.summary?.length > 80 ? '...' : ''}
        </p>
      </div>
    </div>
  )
}

function TopicCard({ topic, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'white',
        borderRadius: 12,
        padding: 16,
        border: topic.has_real_data ? '1px solid #E2E8F0' : '1px dashed #E2E8F0',
        cursor: 'pointer',
        transition: 'all 0.15s',
        opacity: topic.has_real_data ? 1 : 0.6,
      }}
      onMouseEnter={e => topic.has_real_data && (e.currentTarget.style.borderColor = '#0A3D62')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = topic.has_real_data ? '#E2E8F0' : '#E2E8F0')}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>{topic.name}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>{topic.category}</span>
        {topic.has_real_data ? (
          <span style={{ fontSize: 11, background: '#F0FDF4', color: '#16A34A', padding: '2px 8px', borderRadius: 20 }}>
            {topic.content_count}개
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#CBD5E1' }}>준비중</span>
        )}
      </div>
    </div>
  )
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 16px',
        borderRadius: 20,
        fontSize: 13,
        fontWeight: 500,
        border: active ? 'none' : '1px solid #E2E8F0',
        background: active ? '#0A3D62' : 'white',
        color: active ? 'white' : '#475569',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function CurriculumSection({ navigate }) {
  const [paths, setPaths] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${EDU_API}/api/education/curriculum/paths`)
      .then(r => r.json())
      .then(d => setPaths(d.paths || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>불러오는 중...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>학습 경로</h2>
          <p style={{ color: '#64748B' }}>금감원 공식 콘텐츠로 구성된 12개 코스를 살펴보세요.</p>
        </div>
        <button
          onClick={() => navigate('/education/curriculum/match')}
          style={{
            background: '#0A3D62',
            color: 'white',
            padding: '10px 20px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          맞춤 경로 찾기 →
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {paths.map(path => (
          <PathCard key={path.id} path={path} onClick={() => navigate(`/education/curriculum/${path.id}`)} />
        ))}
      </div>
    </div>
  )
}

function PathCard({ path, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'white',
        borderRadius: 16,
        padding: 20,
        border: '1px solid #E2E8F0',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(10,61,98,0.1)'
        e.currentTarget.style.borderColor = '#0A3D62'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = '#E2E8F0'
      }}
    >
      <h4 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>{path.name}</h4>
      <p style={{ fontSize: 13, color: '#64748B', marginBottom: 14, lineHeight: 1.5 }}>{path.subtitle}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '3px 10px', borderRadius: 20 }}>
          {path.duration_weeks || 0}주
        </span>
        <span style={{ fontSize: 11, background: '#F0FDF4', color: '#16A34A', padding: '3px 10px', borderRadius: 20 }}>
          주 {path.weekly_hours || 0}시간
        </span>
        <span style={{ fontSize: 11, background: '#FFF7ED', color: '#C2410C', padding: '3px 10px', borderRadius: 20 }}>
          {path.total_contents || 0}개 콘텐츠
        </span>
      </div>
    </div>
  )
}
