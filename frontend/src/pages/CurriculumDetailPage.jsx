import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'

const EDU_API = 'http://localhost:8000'

export default function CurriculumDetailPage() {
  const { pathId } = useParams()
  const navigate = useNavigate()
  const [path, setPath] = useState(null)
  const [paths, setPaths] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedWeek, setExpandedWeek] = useState(1)

  const isList = !pathId
  const isMatch = pathId === 'match'

  useEffect(() => {
    if (isMatch) {
      setLoading(false)
      return
    }

    if (isList) {
      fetch(`${EDU_API}/api/education/curriculum/paths`)
        .then(r => r.json())
        .then(d => setPaths(d.paths || []))
        .catch(console.error)
        .finally(() => setLoading(false))
      return
    }

    fetch(`${EDU_API}/api/education/curriculum/${pathId}`)
      .then(r => r.json())
      .then(setPath)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [pathId, isList, isMatch])

  if (isList) return <CurriculumListPage navigate={navigate} paths={paths} loading={loading} />
  if (isMatch) return <CurriculumMatchPage navigate={navigate} />

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: 80, color: '#94A3B8' }}>불러오는 중...</div>
    </div>
  )

  if (!path) return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: 80, color: '#EF4444' }}>학습 경로를 찾을 수 없습니다.</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC', fontFamily: "'IBM Plex Sans KR', -apple-system, sans-serif" }}>
      <Navbar />

      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg, #0A3D62, #1E5F8A)', color: 'white', padding: '40px 32px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <button onClick={() => navigate('/education')} style={{ background: 'none', border: 'none', color: '#BFDBFE', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', marginBottom: 16 }}>
            ← 교육센터로
          </button>
          <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 10 }}>{path.name}</h1>
          <p style={{ color: '#BFDBFE', fontSize: 15, marginBottom: 20 }}>{path.subtitle}</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: '기간', value: `${path.duration_weeks}주` },
              { label: '주당', value: `${path.weekly_hours}시간` },
              { label: '콘텐츠', value: `${path.total_contents}개` },
              { label: '레벨', value: path.target_level },
            ].map(item => (
              <div key={item.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 18px', backdropFilter: 'blur(8px)' }}>
                <div style={{ fontSize: 11, color: '#93C5FD', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px' }}>
        {/* 마일스톤 */}
        {path.milestones?.length > 0 && (
          <div style={{ background: 'white', borderRadius: 16, padding: '24px', marginBottom: 24, border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>🏅 마일스톤</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {path.milestones.map((m, i) => {
                // milestones는 문자열 또는 {week, badge} 객체 두 가지 형태 처리
                const badgeText = typeof m === 'string' ? m : m.badge || String(m)
                const weekText  = typeof m === 'object' && m.week ? `${m.week}주차` : null
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: '#EFF6FF', borderRadius: 12, padding: '10px 16px',
                    border: '1px solid #BFDBFE',
                  }}>
                    <span style={{ fontSize: 18 }}>🏅</span>
                    <div>
                      {weekText && (
                        <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 500, marginBottom: 1 }}>
                          {weekText} 달성
                        </div>
                      )}
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8' }}>{badgeText}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 주차별 커리큘럼 */}
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>📅 주차별 커리큘럼</h3>
        {(path.weeks || []).map(week => (
          <div key={week.week_number} style={{ background: 'white', borderRadius: 16, marginBottom: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <button onClick={() => setExpandedWeek(expandedWeek === week.week_number ? null : week.week_number)}
              style={{
                width: '100%', background: 'none', border: 'none', padding: '16px 24px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'inherit',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 32, height: 32, background: '#EFF6FF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1D4ED8', flexShrink: 0 }}>
                  {week.week_number}
                </span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>{week.theme}</div>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>콘텐츠 {week.contents?.length || 0}개</div>
                </div>
              </div>
              <span style={{ fontSize: 18, color: '#94A3B8', transform: expandedWeek === week.week_number ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
            </button>
            {expandedWeek === week.week_number && week.contents?.length > 0 && (
              <div style={{ padding: '0 24px 16px', borderTop: '1px solid #F1F5F9' }}>
                {week.contents.map(c => (
                  <div key={c.contents_slno} onClick={() => navigate(`/education/content/${c.contents_slno}`)}
                    style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid #F8FAFC', cursor: 'pointer', alignItems: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    <div style={{ fontSize: 20, flexShrink: 0 }}>🎬</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', lineHeight: 1.4 }}>{c.title}</div>
                      {c.playtime_minutes && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{c.playtime_minutes}분</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 매칭 설문 페이지 ────────────────────────────────────────────────────────────
function CurriculumListPage({ navigate, paths, loading }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC', fontFamily: "'IBM Plex Sans KR', -apple-system, sans-serif" }}>
      <Navbar />

      <div style={{ background: 'linear-gradient(135deg, #0A3D62, #1E5F8A)', color: 'white', padding: '40px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <button
            onClick={() => navigate('/education')}
            style={{
              background: 'none',
              border: 'none',
              color: '#BFDBFE',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
              marginBottom: 16,
            }}
          >
            ← 교육센터로
          </button>

          <h1 style={{ fontSize: 34, fontWeight: 800, marginBottom: 10, lineHeight: 1.2 }}>
            학습 경로
          </h1>
          <p style={{ color: '#BFDBFE', fontSize: 16, marginBottom: 0 }}>
            나의 상황에 맞는 12개의 체계적인 학습 경로를 선택하세요.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <button
            onClick={() => navigate('/education/curriculum/match')}
            style={{
              background: '#0A3D62',
              color: 'white',
              padding: '12px 24px',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            맞춤 경로 찾기 →
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#94A3B8' }}>불러오는 중...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {paths.map(p => (
              <PathCard key={p.id} path={p} onClick={() => navigate(`/education/curriculum/${p.id}`)} />
            ))}
          </div>
        )}
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
        padding: '20px',
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
          {path.duration_weeks ?? '-'}주
        </span>
        <span style={{ fontSize: 11, background: '#F0FDF4', color: '#16A34A', padding: '3px 10px', borderRadius: 20 }}>
          주 {path.weekly_hours ?? '-'}시간
        </span>
        <span style={{ fontSize: 11, background: '#FFF7ED', color: '#C2410C', padding: '3px 10px', borderRadius: 20 }}>
          {path.total_contents ?? '-'}개 콘텐츠
        </span>
      </div>
    </div>
  )
}

function CurriculumMatchPage({ navigate }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  const questions = [
    {
      key: 'life_stage',
      title: '현재 나의 상황은?',
      options: [
        { value: 'teen', label: '🎒 청소년', desc: '중고등학생' },
        { value: 'college', label: '🎓 대학생', desc: '대학교 재학/휴학' },
        { value: 'rookie', label: '💼 사회초년생', desc: '직장 경험 3년 이하' },
        { value: 'midcareer', label: '🏢 직장인', desc: '자산 형성 중' },
        { value: 'preretire', label: '🏠 50대+', desc: '은퇴 준비 시작' },
        { value: 'retired', label: '🌿 은퇴 후', desc: '자산 관리 중' },
        { value: 'military', label: '🎖️ 군장병', desc: '군 복무 중' },
        { value: 'debt_crisis', label: '💳 빚 관리', desc: '채무 해결 필요' },
      ],
    },
    {
      key: 'primary_concern',
      title: '지금 가장 중요한 목표는?',
      options: [
        { value: 'wealth', label: '💰 자산 형성', desc: '투자·재테크 시작' },
        { value: 'retirement', label: '🏦 노후 준비', desc: '연금·은퇴 설계' },
        { value: 'fraud', label: '🛡️ 사기 예방', desc: '금융 피해 방지' },
        { value: 'debt', label: '📉 빚 탈출', desc: '채무 조정·신용 회복' },
        { value: 'literacy', label: '📚 금융 기초', desc: '기초 지식부터 시작' },
      ],
    },
  ]

  const submit = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${EDU_API}/api/education/curriculum/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...answers, age: 28, weekly_hours: 2 }),
      })
      const data = await res.json()
      setResults(data.matched_paths || [])
    } catch { setResults([]) }
    finally { setLoading(false) }
  }

  if (results) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFBFC', fontFamily: "'IBM Plex Sans KR', -apple-system, sans-serif" }}>
        <Navbar />
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>🎯 추천 학습 경로</h2>
            <p style={{ color: '#64748B' }}>당신에게 맞는 커리큘럼을 찾았습니다.</p>
          </div>
          {results.map((p, i) => (
            <div key={p.id} style={{
              background: 'white', borderRadius: 20, padding: '28px', marginBottom: 16,
              border: i === 0 ? '2px solid #0A3D62' : '1px solid #E2E8F0',
              background: i === 0 ? 'linear-gradient(180deg, #EFF6FF 0%, white 60%)' : 'white',
            }}>
              {i === 0 && <div style={{ display: 'inline-block', background: '#0A3D62', color: 'white', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, marginBottom: 12, letterSpacing: '0.05em' }}>최적 추천</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{p.name}</h3>
                  <p style={{ fontSize: 13, color: '#64748B' }}>{p.subtitle}</p>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0A3D62', flexShrink: 0 }}>{Math.round(p.match_score * 100)}점</div>
              </div>
              {p.why_recommended && <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, background: '#F8FAFC', borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>{p.why_recommended}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {p.match_reasons.map((r, ri) => (
                  <span key={ri} style={{ fontSize: 11, background: '#F1F5F9', color: '#475569', padding: '3px 10px', borderRadius: 20 }}>✓ {r}</span>
                ))}
              </div>
              <button onClick={() => navigate(`/education/curriculum/${p.id}`)} style={{
                background: i === 0 ? '#0A3D62' : '#F1F5F9', color: i === 0 ? 'white' : '#334155',
                border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>커리큘럼 보기 →</button>
            </div>
          ))}
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button onClick={() => { setResults(null); setStep(0); setAnswers({}) }} style={{
              background: 'none', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 20px', fontSize: 13, color: '#475569', cursor: 'pointer', fontFamily: 'inherit',
            }}>다시 설문하기</button>
          </div>
        </div>
      </div>
    )
  }

  const q = questions[step]

  return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC', fontFamily: "'IBM Plex Sans KR', -apple-system, sans-serif" }}>
      <Navbar />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>
        {/* 프로그레스 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 40 }}>
          {questions.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? '#0A3D62' : '#E2E8F0', transition: 'background 0.3s' }} />
          ))}
        </div>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', letterSpacing: '0.1em', marginBottom: 10 }}>질문 {step + 1} / {questions.length}</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A' }}>{q.title}</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10, marginBottom: 32 }}>
          {q.options.map(opt => (
            <button key={opt.value} onClick={() => {
              const newAnswers = { ...answers, [q.key]: opt.value }
              setAnswers(newAnswers)
              if (step < questions.length - 1) {
                setStep(step + 1)
              } else {
                submit()
              }
            }} style={{
              padding: '16px', background: 'white', border: answers[q.key] === opt.value ? '2px solid #0A3D62' : '2px solid #E2E8F0',
              borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s',
              background: answers[q.key] === opt.value ? '#EFF6FF' : 'white',
            }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>{opt.desc}</div>
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign: 'center', color: '#64748B' }}>경로 매칭 중...</div>}
      </div>
    </div>
  )
}
