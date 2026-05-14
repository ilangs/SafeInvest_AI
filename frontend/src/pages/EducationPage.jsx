import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import BeginnerGuide from '../components/education/BeginnerGuide'
import StockDictionary from '../components/education/StockDictionary'

const EDU_API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const STEP_INFO = {
  '1단계': {
    title: '1단계 · 투자 첫걸음',
    subtitle: '주식 투자를 시작하기 전에 꼭 알아야 할 입문 기본기입니다.',
  },
  '2단계': {
    title: '2단계 · 종목 보는 눈',
    subtitle: '기업과 종목을 판단하기 위한 재무 지표와 기초 분석을 배웁니다.',
  },
  '3단계': {
    title: '3단계 · 시장 흐름 읽기',
    subtitle: '시장 분위기, 지수, 금리, 뉴스 흐름을 이해하는 단계입니다.',
  },
  '4단계': {
    title: '4단계 · 안전한 투자자 되기',
    subtitle: '분산투자, 포트폴리오, 투자 위험을 점검하는 마무리 단계입니다.',
  },
}

export default function EducationPage() {
  const navigate = useNavigate()

  const [selfContents, setSelfContents] = useState([])
  const [selfCategories, setSelfCategories] = useState([])
  const [selectedCat, setSelectedCat] = useState(null)
  const [loading, setLoading] = useState(true)

  const [activeSection, setActiveSection] = useState('ready')
  const [openSteps, setOpenSteps] = useState({
    '1단계': false,
    '2단계': false,
    '3단계': false,
    '4단계': false,
  })

  useEffect(() => {
    fetch(`${EDU_API}/api/self-contents`)
      .then(r => r.json())
      .then(selfData => {
        setSelfContents(selfData.contents || [])
        setSelfCategories(selfData.categories || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filteredSelf = useMemo(() => {
    return selectedCat
      ? selfContents.filter(content => content.category_code === selectedCat)
      : selfContents
  }, [selectedCat, selfContents])

  const groupedByStep = useMemo(() => {
    const groups = {
      '1단계': [],
      '2단계': [],
      '3단계': [],
      '4단계': [],
    }

    filteredSelf.forEach(content => {
      const title = content.title || ''

      if (title.includes('1단계')) groups['1단계'].push(content)
      else if (title.includes('2단계')) groups['2단계'].push(content)
      else if (title.includes('3단계')) groups['3단계'].push(content)
      else if (title.includes('4단계')) groups['4단계'].push(content)
    })

    Object.keys(groups).forEach(step => {
      groups[step].sort((a, b) => getStepOrder(a.title) - getStepOrder(b.title))
    })

    return groups
  }, [filteredSelf])

  const toggleStep = (step) => {
    setOpenSteps(prev => ({
      ...prev,
      [step]: !prev[step],
    }))
  }

  return (
    <div style={styles.layout}>
      <Navbar />

      <main style={styles.page}>
        <section style={styles.header}>
          <h1 style={styles.title}>Education Center</h1>
          <p style={styles.subtitle}>
            Ju-Dy 와 함께 투자 기본기부터 차근차근 학습해 보세요.
          </p>
        </section>

        <section style={styles.sectionTabs}>
          <button
            style={{
              ...styles.sectionTab,
              ...(activeSection === 'ready' ? styles.sectionTabActive : {}),
            }}
            onClick={() => setActiveSection('ready')}
          >
            초보 가이드
          </button>
          
          <button
            style={{
              ...styles.sectionTab,
              ...(activeSection === 'video' ? styles.sectionTabActive : {}),
            }}
            onClick={() => setActiveSection('video')}
          >
            기본기 영상
          </button>

          <button
            style={{
              ...styles.sectionTab,
              ...(activeSection === 'guide' ? styles.sectionTabActive : {}),
            }}
            onClick={() => setActiveSection('guide')}
          >
            주디 백과사전
          </button>
        </section>

        {activeSection === 'video' && (
          <>
            {loading ? (
              <div style={styles.loading}>불러오는 중...</div>
            ) : (
              <>
                <section style={styles.filterBox}>
                  <button
                    style={{
                      ...styles.filterButton,
                      ...(selectedCat === null ? styles.filterButtonActive : {}),
                    }}
                    onClick={() => setSelectedCat(null)}
                  >
                    전체
                  </button>

                  {selfCategories.map(cat => (
                    <button
                      key={cat.code}
                      style={{
                        ...styles.filterButton,
                        ...(selectedCat === cat.code ? styles.filterButtonActive : {}),
                      }}
                      onClick={() => setSelectedCat(cat.code)}
                    >
                      {cat.name === '재무제표' ? '재무 제표' : cat.name}
                    </button>
                  ))}
                </section>

                <section style={styles.roadmap}>
                  {Object.entries(groupedByStep).map(([step, contents]) => {
                    if (contents.length === 0) return null

                    const info = STEP_INFO[step]
                    const isOpen = openSteps[step]

                    return (
                      <div key={step} style={styles.stepBlock}>
                        <button
                          style={styles.stepHeader}
                          onClick={() => toggleStep(step)}
                        >
                          <div style={styles.stepTextLine}>
                            <h2 style={styles.stepTitle}>{info.title}</h2>
                            <span style={styles.stepDivider}>·</span>
                            <p style={styles.stepSubtitle}>{info.subtitle}</p>
                          </div>

                          <div style={styles.stepRight}>
                            <span style={styles.stepCount}>{contents.length}개 영상</span>
                            <span style={styles.arrow}>{isOpen ? '▲' : '▼'}</span>
                          </div>
                        </button>

                        {isOpen && (
                          <div style={styles.lessonList}>
                            {contents.map(content => (
                              <LessonRow
                                key={content.contents_slno}
                                content={content}
                                onClick={() => navigate(`/education/self/${content.contents_slno}`)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </section>
              </>
            )}
          </>
        )}

        {activeSection === 'guide' && <StockDictionary />}

        {activeSection === 'ready' && <BeginnerGuide />}
      </main>
    </div>
  )
}

function LessonRow({ content, onClick }) {
  const cleanTitle = removeBracketPrefix(content.title)

  return (
    <article style={styles.lessonRow} onClick={onClick}>
      <img
        src="/logo-tab.png"
        alt="Ju-Dy"
        style={styles.lessonIcon}
      />

      <div style={styles.lessonMain}>
        <h3 style={styles.lessonTitle}>{cleanTitle}</h3>
        <p style={styles.lessonSummary}>
          {content.summary || '핵심 투자 기본기를 짧게 확인할 수 있습니다.'}
        </p>
      </div>

      <div style={styles.lessonMeta}>
        <span style={styles.categoryBadge}>
          {content.category_name || '기본기'}
        </span>
        <span style={styles.timeBadge}>{content.playtime_minutes || 0}분</span>
      </div>
    </article>
  )
}

function getStepOrder(title = '') {
  const match = title.match(/\[(\d+)단계-(\d+)\]/)
  return match ? Number(match[2]) : 999
}

function removeBracketPrefix(title = '') {
  return title.replace(/^\[\d+단계-\d+\]\s*/, '')
}

const styles = {
  layout: {
    minHeight: '100vh',
    background: '#f5f5f5',
    fontFamily: "'IBM Plex Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  page: {
    maxWidth: 980,
    margin: '0 auto',
    padding: '56px 24px 90px',
  },
  header: {
    textAlign: 'center',
    marginBottom: 26,
  },
  title: {
    fontSize: 40,
    fontWeight: 800,
    color: '#286346',
    marginBottom: 10,
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 16,
    lineHeight: 1.6,
  },
  sectionTabs: {
    display: 'flex',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 34,
  },
  sectionTab: {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#6b7280',
    padding: '8px 2px 10px',
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  sectionTabActive: {
    color: '#2f6f4f',
    borderBottom: '2px solid #2f6f4f',
  },
  loading: {
    textAlign: 'center',
    padding: 60,
    color: '#94a3b8',
  },
  filterBox: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    border: '1px solid #dbe5de',
    borderRadius: 18,
    overflow: 'hidden',
    background: '#ffffff',
    boxShadow: '0 16px 38px rgba(47,111,79,0.08)',
    marginBottom: 34,
  },
  filterButton: {
    height: 50,
    border: 'none',
    borderRight: '1px solid #edf2ef',
    borderBottom: '1px solid #edf2ef',
    background: '#ffffff',
    color: '#64748b',
    fontWeight: 600,
    fontSize: 14.5,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  filterButtonActive: {
    background: 'linear-gradient(135deg, #1f4f3a 0%, #2f6f4f 55%, #3e8e63 100%)',
    color: '#ffffff',
  },
  roadmap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  stepBlock: {
    background: '#ffffff',
    border: '1px solid #dbe5de',
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 18px 44px rgba(47,111,79,0.10)',
  },
  stepHeader: {
    width: '100%',
    background: 'linear-gradient(135deg, #1f4f3a 0%, #2f6f4f 55%, #3e8e63 100%)',
    color: '#ffffff',
    padding: '17px 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  stepTextLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: 600,
    margin: 0,
    whiteSpace: 'nowrap',
  },
  stepDivider: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: 800,
  },
  stepSubtitle: {
    margin: 0,
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stepRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  stepCount: {
    minWidth: 78,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 700,
    background: 'rgba(255,255,255,0.16)',
    border: '1px solid rgba(255,255,255,0.22)',
    padding: '7px 10px',
    borderRadius: 999,
  },
  arrow: {
    fontSize: 14,
    fontWeight: 800,
  },
  lessonList: {
    display: 'flex',
    flexDirection: 'column',
  },
  lessonRow: {
    display: 'grid',
    gridTemplateColumns: '36px 1fr 180px',
    gap: 16,
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '1px solid #edf2ef',
    cursor: 'pointer',
    background: '#ffffff',
  },
  lessonCheck: {
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'center',
    color: '#2f6f4f',
    background: '#eef6f0',
    padding: '5px 0',
    borderRadius: 999,
  },
  lessonMain: {
    minWidth: 0,
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#111827',
    margin: '0 0 6px',
    lineHeight: 1.45,
  },
  lessonSummary: {
    fontSize: 14,
    color: '#64748b',
    margin: 0,
    lineHeight: 1.55,
  },
  lessonMeta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
  },
  categoryBadge: {
    background: '#eef6f0',
    color: '#2f6f4f',
    fontSize: 12,
    fontWeight: 700,
    padding: '5px 10px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  },
  timeBadge: {
    background: '#f8fafc',
    color: '#64748b',
    fontSize: 12,
    fontWeight: 700,
    padding: '5px 10px',
    borderRadius: 999,
  },
  emptyCard: {
    background: '#ffffff',
    border: '1px solid #dbe5de',
    borderRadius: 20,
    padding: 40,
    textAlign: 'center',
    boxShadow: '0 18px 44px rgba(47,111,79,0.10)',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: '#2f6f4f',
    marginBottom: 10,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
  },
  lessonIcon: {
  width: 28,
  height: 28,
  objectFit: 'contain',
  },
}