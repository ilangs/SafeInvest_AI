// frontend/src/components/education/StockDictionary.jsx
// ============================================================
// safeInvest 주식용어 백과사전 모듈
//
// 데이터 소스: Supabase `stock_terms` 테이블
// 의존성: @supabase/supabase-js (이미 설치됨)
//
// 환경변수: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// ============================================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../../services/supabase'

// ── 한글 초성 추출 유틸 ────────────────────────────────────────
const CHO_LIST = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ',
                  'ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']

function toChosung(str) {
  if (!str) return ''
  let out = ''
  for (const ch of str) {
    const code = ch.charCodeAt(0)
    if (code >= 0xAC00 && code <= 0xD7A3) {
      out += CHO_LIST[Math.floor((code - 0xAC00) / (21 * 28))]
    } else {
      out += ch
    }
  }
  return out
}

// 쿼리가 전부 한글 자음(ㄱ~ㅎ 영역)인지 판단 → 초성 검색 모드
function isChosungQuery(q) {
  if (!q) return false
  for (const ch of q) {
    const code = ch.charCodeAt(0)
    if (code < 0x3131 || code > 0x314E) return false
  }
  return true
}

// ── 카테고리 설정 (색상 포함)
const CATEGORIES = [
  { label: '전체',         color: '#64748b' },
  { label: '가치평가',      color: '#6366f1' },
  { label: '재무분석',      color: '#0ea5e9' },
  { label: '시장기초',      color: '#10b981' },
  { label: '시장흐름',      color: '#f59e0b' },
  { label: '거시경제',      color: '#8b5cf6' },
  { label: '실적뉴스',      color: '#ec4899' },
  { label: '투자전략',      color: '#14b8a6' },
  { label: '위험관리',      color: '#ef4444' },
  { label: '투자심리',      color: '#f97316' },
  { label: '매매기초',      color: '#3b82f6' },
  { label: '차트분석',      color: '#84cc16' },
  { label: '계좌기초',      color: '#06b6d4' },
  { label: '투자유의',      color: '#dc2626' },
  { label: '펀드/ETF',     color: '#7c3aed' },
  { label: '채권/금리상품', color: '#0891b2' },
  { label: '파생상품',      color: '#be123c' },
  { label: '연금/은퇴',     color: '#65a30d' },
]

const CAT_COLOR = Object.fromEntries(CATEGORIES.map(c => [c.label, c.color]))

// ── 초성 탭
const KO_TABS = ['전체','ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ','#']
const EN_TABS = ['전체','A','B','C','D','E','F','G','H','I','J','K','L','M',
                 'N','O','P','Q','R','S','T','U','V','W','X','Y','Z']

// ── 별점 렌더
const Stars = ({ n }) => (
  <span style={{ fontSize: 11, letterSpacing: 1 }}>
    {[1,2,3,4,5].map(i => (
      <span key={i} style={{ color: i <= n ? '#f59e0b' : '#d1d5db' }}>★</span>
    ))}
  </span>
)

// ── 태그 칩
const Tag = ({ label }) => (
  <span style={{
    display:'inline-block', fontSize:11, padding:'2px 7px',
    borderRadius:20, background:'#f1f5f9', color:'#475569',
    marginRight:4, marginBottom:4,
  }}>
    #{label}
  </span>
)

// ── 카테고리 배지
const CatBadge = ({ label }) => (
  <span style={{
    display:'inline-block', fontSize:11, padding:'2px 8px',
    borderRadius:20, fontWeight:600,
    background: (CAT_COLOR[label] ?? '#64748b') + '18',
    color: CAT_COLOR[label] ?? '#64748b',
    border: `1px solid ${(CAT_COLOR[label] ?? '#64748b')}40`,
  }}>
    {label}
  </span>
)

// ── 중요도 라벨
const IMP_LABEL = { 5:'핵심필수', 4:'중요', 3:'기본', 2:'심화', 1:'참고' }

// ── 용어 상세 모달
function TermModal({ term, allTerms, onClose, onRelated }) {
  const related = useMemo(
    () => (term.related_ids ?? [])
      .map(id => allTerms.find(t => t.id === id))
      .filter(Boolean),
    [term, allTerms]
  )
  const accentColor = CAT_COLOR[term.category] ?? '#2563eb'

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.45)',
        display:'flex', alignItems:'center', justifyContent:'center',
        zIndex:1000, padding:16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:'#fff', borderRadius:16, width:'100%', maxWidth:540,
          maxHeight:'85vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{
          padding:'20px 24px 16px',
          borderBottom:`3px solid ${accentColor}`,
          position:'sticky', top:0, background:'#fff', zIndex:1,
          borderRadius:'16px 16px 0 0',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <CatBadge label={term.category} />
                <Stars n={term.importance} />
                <span style={{ fontSize:11, color:'#94a3b8' }}>
                  {IMP_LABEL[term.importance]}
                </span>
              </div>
              <h2 style={{ margin:0, fontSize:22, fontWeight:700, color:'#0f172a' }}>
                {term.term}
              </h2>
              {term.term_ko && (
                <p style={{ margin:'4px 0 0', fontSize:13, color:'#64748b' }}>
                  {term.term_ko}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background:'none', border:'none', cursor:'pointer',
                fontSize:22, color:'#94a3b8', padding:4, lineHeight:1,
              }}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ padding:'20px 24px' }}>

          <Section title="정의">
            <p style={{ margin:0, fontSize:15, color:'#1e293b', lineHeight:1.7 }}>
              {term.description}
            </p>
          </Section>

          {term.easy_desc && (
            <Section title="💡 쉽게 이해하기">
              <div style={{
                background:'#f8fafc', borderLeft:`3px solid ${accentColor}`,
                borderRadius:'0 8px 8px 0', padding:'10px 14px',
                fontSize:14, color:'#334155', lineHeight:1.7,
              }}>
                {term.easy_desc}
              </div>
            </Section>
          )}

          {term.formula && (
            <Section title="📐 계산식">
              <div style={{
                background:'#0f172a', borderRadius:8, padding:'10px 14px',
                fontFamily:'monospace', fontSize:13, color:'#e2e8f0',
              }}>
                {term.formula}
              </div>
            </Section>
          )}

          {term.caution && (
            <Section title="⚠️ 주의사항">
              <div style={{
                background:'#fff7ed', border:'1px solid #fed7aa',
                borderRadius:8, padding:'10px 14px',
                fontSize:13, color:'#9a3412', lineHeight:1.7,
              }}>
                {term.caution}
              </div>
            </Section>
          )}

          {term.tags?.length > 0 && (
            <Section title="태그">
              <div>{term.tags.map(t => <Tag key={t} label={t} />)}</div>
            </Section>
          )}

          {related.length > 0 && (
            <Section title="🔗 연관 용어">
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {related.map(r => (
                  <button
                    key={r.id}
                    onClick={() => onRelated(r)}
                    style={{
                      padding:'6px 12px', borderRadius:8, cursor:'pointer',
                      fontSize:13, fontWeight:600,
                      background:(CAT_COLOR[r.category] ?? '#64748b') + '12',
                      color: CAT_COLOR[r.category] ?? '#334155',
                      border:`1px solid ${(CAT_COLOR[r.category] ?? '#64748b')}30`,
                      transition:'all .15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = CAT_COLOR[r.category] ?? '#64748b'
                      e.currentTarget.style.color = '#fff'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = (CAT_COLOR[r.category] ?? '#64748b') + '12'
                      e.currentTarget.style.color = CAT_COLOR[r.category] ?? '#334155'
                    }}
                  >
                    {r.term}
                  </button>
                ))}
              </div>
            </Section>
          )}

        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:18 }}>
      <p style={{ margin:'0 0 6px', fontSize:11, fontWeight:700,
                  color:'#94a3b8', textTransform:'uppercase', letterSpacing:1 }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function TermCard({ term, onClick }) {
  const [hovered, setHovered] = useState(false)
  const accentColor = CAT_COLOR[term.category] ?? '#64748b'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#f8fafc' : '#fff',
        borderTop:    hovered ? `1px solid ${accentColor}60` : '1px solid #e2e8f0',
        borderRight:  hovered ? `1px solid ${accentColor}60` : '1px solid #e2e8f0',
        borderBottom: hovered ? `1px solid ${accentColor}60` : '1px solid #e2e8f0',
        borderLeft:   `3px solid ${accentColor}`,
        borderRadius:12, padding:'14px 16px',
        cursor:'pointer',
        transition:'all .15s',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? `0 4px 12px ${accentColor}18` : 'none',
      }}
    >
      <div style={{ display:'flex', justifyContent:'space-between',
                    alignItems:'flex-start', marginBottom:6 }}>
        <div>
          <span style={{ fontSize:15, fontWeight:700, color:'#0f172a' }}>
            {term.term}
          </span>
          {term.term_ko && (
            <span style={{ fontSize:11, color:'#94a3b8', marginLeft:6 }}>
              {term.term_ko}
            </span>
          )}
        </div>
        <CatBadge label={term.category} />
      </div>

      <p style={{
        margin:'0 0 8px', fontSize:13, color:'#475569',
        lineHeight:1.6, display:'-webkit-box',
        WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
      }}>
        {term.description}
      </p>

      <div style={{ display:'flex', justifyContent:'space-between',
                    alignItems:'center' }}>
        <div>
          {(term.tags ?? []).slice(0, 2).map(t => <Tag key={t} label={t} />)}
        </div>
        <Stars n={term.importance} />
      </div>
    </div>
  )
}

export default function StockDictionary() {
  const [allTerms,       setAllTerms]       = useState([])
  const [isLoading,      setIsLoading]      = useState(true)
  const [error,          setError]          = useState(null)
  const [searchQuery,    setSearchQuery]    = useState('')
  const [debouncedQ,     setDebouncedQ]     = useState('')
  const [selectedCat,    setSelectedCat]    = useState('전체')
  const [indexLang,      setIndexLang]      = useState('ko')
  const [selectedInit,   setSelectedInit]   = useState('전체')
  const [selectedTerm,   setSelectedTerm]   = useState(null)
  const debounceRef = useRef(null)

  // ── 데이터 로드 (Supabase)
  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { data, error: sbErr } = await supabase
          .from('stock_terms')
          .select('*')
          .order('importance', { ascending: false })
        if (sbErr) throw sbErr
        setAllTerms(data ?? [])
      } catch (e) {
        setError(e.message)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQ(searchQuery), 300)
    return () => clearTimeout(debounceRef.current)
  }, [searchQuery])

  const handleLangToggle = useCallback((lang) => {
    setIndexLang(lang)
    setSelectedInit('전체')
  }, [])

  const filtered = useMemo(() => {
    let result = allTerms

    if (debouncedQ.trim()) {
      const qRaw = debouncedQ.trim()
      const q    = qRaw.toLowerCase()
      const chosungMode = isChosungQuery(qRaw)

      result = result.filter(t => {
        if (chosungMode) {
          // 초성 검색: 'ㄱㄹ' → '금리' 매칭
          return (
            toChosung(t.term).includes(qRaw) ||
            toChosung(t.term_ko ?? '').includes(qRaw)
          )
        }
        return (
          t.term.toLowerCase().includes(q) ||
          (t.term_ko ?? '').toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.easy_desc ?? '').toLowerCase().includes(q) ||
          (t.tags ?? []).some(tag => tag.toLowerCase().includes(q))
        )
      })
    }

    if (selectedCat !== '전체') {
      result = result.filter(t => t.category === selectedCat)
    }

    if (selectedInit !== '전체') {
      if (indexLang === 'ko') {
        result = result.filter(t => t.initial_ko === selectedInit)
      } else {
        result = result.filter(t => t.initial_en === selectedInit)
      }
    }

    return [...result].sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance
      return a.term.localeCompare(b.term, 'ko')
    })
  }, [allTerms, debouncedQ, selectedCat, selectedInit, indexLang])

  const activeInitials = useMemo(() => {
    const set = new Set()
    allTerms.forEach(t => {
      if (indexLang === 'ko' && t.initial_ko) set.add(t.initial_ko)
      if (indexLang === 'en' && t.initial_en) set.add(t.initial_en)
    })
    return set
  }, [allTerms, indexLang])

  const tabs = indexLang === 'ko' ? KO_TABS : EN_TABS

  const handleRelated = useCallback((relTerm) => {
    setSelectedTerm(relTerm)
  }, [])

  return (
    <div style={{
      fontFamily: "'IBM Plex Sans KR', 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
      background: '#ffffff', borderRadius: 20, overflow: 'hidden',
      border: '1px solid #dbe5de',
      boxShadow: '0 18px 44px rgba(47,111,79,0.10)',
    }}>

      <div style={{
        background: 'linear-gradient(135deg, #1f4f3a 0%, #2f6f4f 55%, #3e8e63 100%)',
        padding: '28px 20px 24px', color: '#fff',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <p style={{ margin:'0 0 4px', fontSize:12, color:'rgba(255,255,255,0.78)',
                      textTransform:'uppercase', letterSpacing:2 }}>
            safeInvest 교육센터
          </p>
          <h1 style={{ margin:'0 0 16px', fontSize:22, fontWeight:800, letterSpacing:-0.5 }}>
            📖 주식용어 백과사전
          </h1>

          <div style={{ position:'relative' }}>
            <style>{`
              .sd-search::placeholder { color: #cbd5e1; opacity: 1; }
              .sd-search:focus { background: #ffffff !important; color: #0f172a !important; }
              .sd-search:focus::placeholder { color: #94a3b8; }
            `}</style>
            <span style={{
              position:'absolute', left:14, top:'50%', transform:'translateY(-50%)',
              fontSize:16, color:'#0f172a', pointerEvents:'none', zIndex:1,
            }}>
              🔍
            </span>
            <input
              type="text"
              className="sd-search"
              placeholder="용어, 설명, 태그, 초성으로 검색... (예: PER, 배당, ㄱㄹ)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width:'100%', boxSizing:'border-box',
                padding:'12px 40px 12px 40px',
                border:'1px solid rgba(255,255,255,0.25)', borderRadius:10,
                fontSize:14, fontWeight:500,
                background:'rgba(255,255,255,0.95)',
                color:'#0f172a', outline:'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position:'absolute', right:12, top:'50%',
                  transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer',
                  fontSize:16, color:'#94a3b8', padding:4,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {!isLoading && (
            <p style={{ margin:'10px 0 0', fontSize:12, color:'rgba(255,255,255,0.82)' }}>
              전체 <strong style={{ color:'#fff' }}>{allTerms.length}</strong>개 용어
              {debouncedQ && ` · 검색결과 `}
              {debouncedQ && <strong style={{ color:'#bbf7d0' }}>{filtered.length}</strong>}
              {debouncedQ && '개'}
            </p>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 24px' }}>

        <div style={{
          display:'flex', flexWrap:'wrap', gap:6,
          padding:'14px 0 10px',
        }}>
          {CATEGORIES.map(cat => {
            const active = selectedCat === cat.label
            return (
              <button
                key={cat.label}
                onClick={() => setSelectedCat(cat.label)}
                style={{
                  padding:'5px 12px', borderRadius:20, fontSize:12,
                  fontWeight: active ? 700 : 400, cursor:'pointer',
                  border: active ? 'none' : '1px solid #e2e8f0',
                  background: active ? cat.color : '#fff',
                  color: active ? '#fff' : '#64748b',
                  transition:'all .15s',
                  boxShadow: active ? `0 2px 8px ${cat.color}40` : 'none',
                }}
              >
                {cat.label}
              </button>
            )
          })}
        </div>

        <div style={{
          background:'#fff', borderRadius:12, border:'1px solid #e2e8f0',
          padding:'12px 14px', marginBottom:16,
        }}>
          <div style={{ display:'flex', gap:6, marginBottom:10 }}>
            {[['ko','한글 ㄱㄴㄷ'],['en','영문 ABC']].map(([lang, label]) => (
              <button
                key={lang}
                onClick={() => handleLangToggle(lang)}
                style={{
                  padding:'4px 12px', borderRadius:6, fontSize:12,
                  fontWeight: indexLang === lang ? 700 : 400,
                  cursor:'pointer',
                  background: indexLang === lang ? '#0f172a' : 'transparent',
                  color: indexLang === lang ? '#fff' : '#64748b',
                  border: indexLang === lang ? 'none' : '1px solid #e2e8f0',
                  transition:'all .15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {tabs.map(tab => {
              const isActive  = selectedInit === tab
              const hasData   = tab === '전체' || activeInitials.has(tab)
              return (
                <button
                  key={tab}
                  onClick={() => hasData && setSelectedInit(tab)}
                  style={{
                    minWidth:32, height:30, padding:'0 6px',
                    borderRadius:6, fontSize:12, fontWeight: isActive ? 700 : 400,
                    cursor: hasData ? 'pointer' : 'default',
                    border: isActive ? 'none' : '1px solid #e2e8f0',
                    background: isActive ? '#2563eb'
                      : hasData ? '#fff' : '#f8fafc',
                    color: isActive ? '#fff'
                      : hasData ? '#334155' : '#cbd5e1',
                    transition:'all .12s',
                    boxShadow: isActive ? '0 2px 6px #2563eb40' : 'none',
                  }}
                >
                  {tab}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between',
                      alignItems:'center', marginBottom:12 }}>
          <p style={{ margin:0, fontSize:13, color:'#64748b' }}>
            {isLoading ? '로딩 중...' : `${filtered.length}개 용어`}
            {selectedCat !== '전체' && (
              <span style={{ marginLeft:6, color: CAT_COLOR[selectedCat] }}>
                · {selectedCat}
              </span>
            )}
            {selectedInit !== '전체' && (
              <span style={{ marginLeft:6, color:'#2563eb' }}>
                · {indexLang === 'ko' ? selectedInit + '으로 시작' : selectedInit}
              </span>
            )}
          </p>
          {(selectedCat !== '전체' || selectedInit !== '전체' || debouncedQ) && (
            <button
              onClick={() => {
                setSelectedCat('전체')
                setSelectedInit('전체')
                setSearchQuery('')
              }}
              style={{
                fontSize:11, color:'#ef4444', background:'none',
                border:'none', cursor:'pointer', padding:'2px 6px',
              }}
            >
              ✕ 필터 초기화
            </button>
          )}
        </div>

        {isLoading && (
          <div style={{ textAlign:'center', padding:'60px 0', color:'#94a3b8' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>📖</div>
            <p style={{ margin:0 }}>용어를 불러오는 중입니다...</p>
          </div>
        )}

        {error && (
          <div style={{
            background:'#fef2f2', border:'1px solid #fecaca',
            borderRadius:10, padding:20, color:'#991b1b',
            textAlign:'center',
          }}>
            <p style={{ margin:0, fontWeight:600 }}>⚠️ 데이터 로드 실패</p>
            <p style={{ margin:'6px 0 0', fontSize:13 }}>{error}</p>
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 0', color:'#94a3b8' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
            <p style={{ margin:0, fontWeight:600, color:'#475569' }}>
              검색 결과가 없습니다
            </p>
            <p style={{ margin:'6px 0 0', fontSize:13 }}>
              다른 검색어나 필터를 사용해보세요.
            </p>
          </div>
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))',
            gap:10,
          }}>
            {filtered.map(term => (
              <TermCard
                key={term.id}
                term={term}
                onClick={() => setSelectedTerm(term)}
              />
            ))}
          </div>
        )}

      </div>

      {selectedTerm && (
        <TermModal
          term={selectedTerm}
          allTerms={allTerms}
          onClose={() => setSelectedTerm(null)}
          onRelated={handleRelated}
        />
      )}
    </div>
  )
}
