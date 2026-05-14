// ════════════════════════════════════════════════════════════════════
// StockDictionary.jsx — 주디 백과사전 (총 230개 주식·투자 용어)
// ════════════════════════════════════════════════════════════════════
// [이 컴포넌트가 하는 일]
//   교육센터의 한 탭에 들어가는 주식·투자 용어 사전.
//   Supabase stock_terms 테이블에서 직접 조회 (1회 fetch 후 클라이언트
//   필터링) → 검색·카테고리·초성탭이 즉각 반응.
//
// [핵심 기능]
//   ① 17개 카테고리 색상 칩 필터
//      (가치평가/재무분석/시장기초/시장흐름/거시경제/실적뉴스/투자전략/
//       위험관리/투자심리/매매기초/차트분석/계좌기초/투자유의/펀드ETF/
//       채권금리상품/파생상품/연금은퇴)
//   ② 한글 초성탭 (ㄱ~ㅎ, #) + 영문 알파벳탭 (A~Z) 토글
//   ③ 통합 검색:
//      - 일반: term, term_ko, description, easy_desc, tags 부분일치
//      - 초성: "ㄱㄹ" → "금리" 매칭 (toChosung 유틸로 음절→초성 변환)
//   ④ 카드 클릭 → 상세 모달 (정의·쉬운설명·계산식·주의사항·태그·연관용어)
//
// [데이터]
//   - Supabase 'stock_terms' 테이블 (RLS: public_read 정책으로 누구나 조회)
//   - 230개: 원본 95개 + LLM 큐레이션 135개 (gpt-4o + 카테고리 타깃 방식)
//   - 백업: backend/scripts/stock_terms.json (Supabase 미러)
//
// [생성 파이프라인 참고]
//   - extract_terms_by_category.py: 카테고리별 LLM 일괄 생성
//   - upsert_new_terms.py         : dryrun JSON → Supabase 반영
//   - export_stock_terms.py       : Supabase → JSON 백업
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../../services/supabase'

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

function isChosungQuery(q) {
  if (!q) return false
  for (const ch of q) {
    const code = ch.charCodeAt(0)
    if (code < 0x3131 || code > 0x314E) return false
  }
  return true
}

const CATEGORIES = [
  { label: '전체', color: '#2f6f4f' },
  { label: '가치평가', color: '#6f7ee8' },
  { label: '재무분석', color: '#4aa9df' },
  { label: '시장기초', color: '#47b881' },
  { label: '시장흐름', color: '#e8b64f' },
  { label: '거시경제', color: '#9b7ae6' },
  { label: '실적뉴스', color: '#df6fa4' },
  { label: '투자전략', color: '#42b7a5' },
  { label: '위험관리', color: '#df6b63' },
  { label: '투자심리', color: '#e28b55' },
  { label: '매매기초', color: '#5f8fe8' },
  { label: '차트분석', color: '#8dbf4f' },
  { label: '계좌기초', color: '#4db9c8' },
  { label: '투자유의', color: '#d85b66' },
  { label: '펀드/ETF', color: '#9271e8' },
  { label: '채권/금리상품', color: '#4b9fb5' },
  { label: '파생상품', color: '#c75b78' },
  { label: '연금/은퇴', color: '#82ad4e' },
]

const CAT_COLOR = Object.fromEntries(CATEGORIES.map(c => [c.label, c.color]))

const KO_TABS = ['전체','ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ','#']
const EN_TABS = ['전체','A','B','C','D','E','F','G','H','I','J','K','L','M',
                 'N','O','P','Q','R','S','T','U','V','W','X','Y','Z']

const Stars = ({ n }) => (
  <span style={{ fontSize: 11, letterSpacing: 1 }}>
    {[1,2,3,4,5].map(i => (
      <span key={i} style={{ color: i <= n ? '#e8b64f' : '#d1d5db' }}>★</span>
    ))}
  </span>
)

const Tag = ({ label }) => (
  <span style={{
    display:'inline-block', fontSize:11, padding:'4px 8px',
    borderRadius:20, background:'#eef6f0', color:'#475569',
    marginRight:4, marginBottom:4,
  }}>
    #{label}
  </span>
)

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

const IMP_LABEL = { 5:'핵심필수', 4:'중요', 3:'기본', 2:'심화', 1:'참고' }

function TermModal({ term, allTerms, onClose, onRelated }) {
  const related = useMemo(
    () => (term.related_ids ?? [])
      .map(id => allTerms.find(t => t.id === id))
      .filter(Boolean),
    [term, allTerms]
  )

  const accentColor = CAT_COLOR[term.category] ?? '#2f6f4f'

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
        className="stock-dict-modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          background:'#fff', borderRadius:16, width:'100%', maxWidth:600,
          maxHeight:'85vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div className="sd-modal-head" style={{
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

        <div className="sd-modal-body" style={{ padding:'20px 24px' }}>
          <Section title="📘 정의">
            <p style={{ margin:0, fontSize:15, color:'#1e293b', lineHeight:1.7 }}>
              {term.description}
            </p>
          </Section>

          {term.easy_desc && (
            <Section title="💡 쉽게 이해하기">
              <div style={{
                background:'#f8faf9', borderLeft:`3px solid ${accentColor}`,
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
                background:'#eef6f0',
                border:'1px solid #dbe5de',
                borderRadius:8,
                padding:'10px 14px',
                fontSize:14,
                fontWeight:600,
                color:'#1e593c',
                width:'100%',
              }}>
                {term.formula}
              </div>
            </Section>
          )}

          {term.caution && (
            <Section title="⚠️ 주의사항">
              <div style={{
                background:'#fff8ef', border:'1px solid #f2d1a6',
                borderRadius:8, padding:'10px 14px',
                fontSize:13, color:'#374151', lineHeight:1.7,
              }}>
                {term.caution}
              </div>
            </Section>
          )}

          {term.tags?.length > 0 && (
            <Section title="🏷️ 태그">
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
      <p style={{
        margin:'0 0 6px',
        fontSize:13,
        fontWeight:600,
        color:'#000000',
        textTransform:'uppercase',
        letterSpacing:1,
      }}>
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
        background: hovered ? '#f8faf9' : '#fff',
        borderTop: hovered ? `1px solid ${accentColor}60` : '1px solid #e2e8f0',
        borderRight: hovered ? `1px solid ${accentColor}60` : '1px solid #e2e8f0',
        borderBottom: hovered ? `1px solid ${accentColor}60` : '1px solid #e2e8f0',
        borderLeft: `3px solid ${accentColor}`,
        borderRadius:12,
        padding:'14px 16px',
        cursor:'pointer',
        transition:'all .15s',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? `0 4px 12px ${accentColor}18` : 'none',
      }}
    >
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
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
        margin:'0 0 8px',
        fontSize:13,
        color:'#475569',
        lineHeight:1.6,
        display:'-webkit-box',
        WebkitLineClamp:2,
        WebkitBoxOrient:'vertical',
        overflow:'hidden',
      }}>
        {term.description}
      </p>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          {(term.tags ?? []).slice(0, 2).map(t => <Tag key={t} label={t} />)}
        </div>
        <Stars n={term.importance} />
      </div>
    </div>
  )
}

export default function StockDictionary() {
  const [allTerms, setAllTerms] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [selectedCat, setSelectedCat] = useState('전체')
  const [indexLang, setIndexLang] = useState('ko')
  const [selectedInit, setSelectedInit] = useState('전체')
  const [selectedTerm, setSelectedTerm] = useState(null)
  const debounceRef = useRef(null)

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
      const q = qRaw.toLowerCase()
      const chosungMode = isChosungQuery(qRaw)

      result = result.filter(t => {
        if (chosungMode) {
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

  const resetFilters = () => {
    setSelectedCat('전체')
    setSelectedInit('전체')
    setSearchQuery('')
  }

  return (
    <div className="stock-dict" style={{
      fontFamily: "'IBM Plex Sans KR', 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
      background: '#f8faf9',
      borderRadius: 20,
      overflow: 'hidden',
      border: '1px solid #dbe5de',
      boxShadow: '0 18px 44px rgba(47,111,79,0.10)',
    }}>
      <style>{`
        /* ── StockDictionary 반응형 ── */
        @media (max-width: 768px) {
          .stock-dict .sd-inner { width: 94% !important; }
          .stock-dict .sd-header { padding: 22px 16px 18px !important; }
          .stock-dict .sd-title { font-size: 18px !important; gap: 6px !important; }
          .stock-dict .sd-title img { width: 24px !important; height: 24px !important; }
          .stock-dict .sd-body { padding-bottom: 20px !important; }
          .stock-dict .sd-cat-row { padding: 18px 0 16px !important; gap: 5px !important; }
          .stock-dict .sd-cat-row button { padding: 5px 10px !important; font-size: 11px !important; }
          .stock-dict .sd-grid {
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)) !important;
          }
        }
        @media (max-width: 480px) {
          .stock-dict { border-radius: 14px !important; box-shadow: 0 6px 18px rgba(47,111,79,0.10) !important; }
          .stock-dict .sd-inner { width: 100% !important; padding: 0 12px !important; }
          .stock-dict .sd-header { padding: 18px 12px 16px !important; }
          .stock-dict .sd-header .sd-inner { padding: 0 !important; }
          .stock-dict .sd-title { font-size: 16px !important; }
          .stock-dict .sd-search { font-size: 13px !important; padding: 11px 36px 11px 36px !important; }
          .stock-dict .sd-tab-langs button { padding: 4px 10px !important; font-size: 11px !important; }
          .stock-dict .sd-init-row button {
            min-width: 28px !important; height: 28px !important;
            font-size: 11px !important; padding: 0 4px !important;
          }
          .stock-dict .sd-grid {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
          /* 모달 */
          .stock-dict-modal-card { max-width: 100% !important; max-height: 92vh !important; border-radius: 14px !important; }
          .stock-dict-modal-card .sd-modal-head { padding: 16px 16px 12px !important; }
          .stock-dict-modal-card .sd-modal-body { padding: 16px !important; }
          .stock-dict-modal-card h2 { font-size: 18px !important; }
        }
      `}</style>
      <div className="sd-header" style={{
        background: 'linear-gradient(135deg, #1f4f3a 0%, #2f6f4f 55%, #3e8e63 100%)',
        padding: '28px 20px 24px',
        color: '#fff',
      }}>
        <div className="sd-inner" style={{ width: '90%', margin: '0 auto' }}>
          <h1 className="sd-title" style={{
            margin:'0 0 16px',
            fontSize:22,
            fontWeight:800,
            letterSpacing:-0.5,
            display:'flex',
            alignItems:'center',
            gap:8,
          }}>
            <img
              src="/logo-tab.png"
              alt="Ju-Dy"
              style={{
                width:28,
                height:28,
                objectFit:'contain',
              }}
            />
            주식용어 백과사전
          </h1>

          <div style={{ position:'relative' }}>
            <style>{`
              .sd-search::placeholder {
                color: #64748b;
                opacity: 1;
                font-weight: 400;
              }
              .sd-search:focus {
                background: #ffffff !important;
                color: #0f172a !important;
              }
              .sd-search:focus::placeholder {
                color: #64748b;
              }
            `}</style>
            <span style={{
              position:'absolute',
              left:14,
              top:'50%',
              transform:'translateY(-50%)',
              fontSize:16,
              color:'#0f172a',
              pointerEvents:'none',
              zIndex:1,
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
                width:'100%',
                boxSizing:'border-box',
                padding:'12px 40px 12px 40px',
                border:'1px solid rgba(255,255,255,0.25)',
                borderRadius:10,
                fontSize:14,
                fontWeight:400,
                background:'rgba(255,255,255,0.95)',
                color:'#0f172a',
                outline:'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position:'absolute',
                  right:12,
                  top:'50%',
                  transform:'translateY(-50%)',
                  background:'none',
                  border:'none',
                  cursor:'pointer',
                  fontSize:16,
                  color:'#94a3b8',
                  padding:4,
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

      <div className="sd-inner sd-body" style={{ width: '90%', margin: '0 auto', padding: '0 0 24px' }}>
        <div className="sd-cat-row" style={{
          display:'flex',
          flexWrap:'wrap',
          gap:6,
          padding:'24px 0 22px',
        }}>
          {CATEGORIES.map(cat => {
            const active = selectedCat === cat.label
            const activeColor = cat.label === '전체' ? '#2f6f4f' : cat.color

            return (
              <button
                key={cat.label}
                onClick={() => setSelectedCat(cat.label)}
                style={{
                  padding:'5px 12px',
                  borderRadius:20,
                  fontSize:12,
                  fontWeight: active ? 700 : 400,
                  cursor:'pointer',
                  border: active ? 'none' : '1px solid #e2e8f0',
                  background: active ? activeColor : '#fff',
                  color: active ? '#fff' : '#64748b',
                  transition:'all .15s',
                  boxShadow: active ? `0 2px 8px ${activeColor}40` : 'none',
                }}
              >
                {cat.label}
              </button>
            )
          })}
        </div>

        <div style={{
          background:'#ffffff',
          borderRadius:12,
          border:'1px solid #e2e8f0',
          padding:'12px 14px',
          marginBottom:16,
        }}>
          <div style={{
            display:'flex',
            justifyContent:'space-between',
            alignItems:'center',
            gap:8,
            marginBottom:10,
          }}>
            <div className="sd-tab-langs" style={{ display:'flex', gap:6 }}>
              {[['ko','한글 ㄱㄴㄷ'],['en','영문 ABC']].map(([lang, label]) => (
                <button
                  key={lang}
                  onClick={() => handleLangToggle(lang)}
                  style={{
                    padding:'4px 12px',
                    borderRadius:6,
                    fontSize:12,
                    fontWeight: indexLang === lang ? 700 : 400,
                    cursor:'pointer',
                    background: indexLang === lang ? '#2f6f4f' : 'transparent',
                    color: indexLang === lang ? '#fff' : '#64748b',
                    border: indexLang === lang ? 'none' : '1px solid #e2e8f0',
                    transition:'all .15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {(selectedCat !== '전체' || selectedInit !== '전체' || debouncedQ) && (
              <button
                onClick={resetFilters}
                style={{
                  fontSize:11,
                  color:'#64748b',
                  background:'#f8faf9',
                  border:'1px solid #dbe5de',
                  borderRadius:6,
                  cursor:'pointer',
                  padding:'4px 8px',
                }}
              >
                필터 초기화
              </button>
            )}
          </div>

          <div className="sd-init-row" style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {tabs.map(tab => {
              const isActive = selectedInit === tab
              const hasData = tab === '전체' || activeInitials.has(tab)

              return (
                <button
                  key={tab}
                  onClick={() => hasData && setSelectedInit(tab)}
                  style={{
                    minWidth:32,
                    height:30,
                    padding:'0 6px',
                    borderRadius:6,
                    fontSize:12,
                    fontWeight: isActive ? 700 : 400,
                    cursor: hasData ? 'pointer' : 'default',
                    border: isActive ? 'none' : '1px solid #e2e8f0',
                    background: isActive ? '#2f6f4f' : hasData ? '#fff' : '#f8fafc',
                    color: isActive ? '#fff' : hasData ? '#334155' : '#cbd5e1',
                    transition:'all .12s',
                    boxShadow: isActive ? '0 2px 6px rgba(47,111,79,0.24)' : 'none',
                  }}
                >
                  {tab}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{
          display:'flex',
          justifyContent:'space-between',
          alignItems:'center',
          marginBottom:12,
        }}>
          <p style={{ margin:0, fontSize:13, color:'#64748b' }}>
            {isLoading ? '로딩 중...' : `${filtered.length}개 용어`}
          </p>
        </div>

        {isLoading && (
          <div style={{ textAlign:'center', padding:'60px 0', color:'#94a3b8' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>📖</div>
            <p style={{ margin:0 }}>용어를 불러오는 중입니다...</p>
          </div>
        )}

        {error && (
          <div style={{
            background:'#fef2f2',
            border:'1px solid #fecaca',
            borderRadius:10,
            padding:20,
            color:'#991b1b',
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
          <div className="sd-grid" style={{
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
