import { useState, useEffect, useRef } from 'react'
import { api } from '../../services/analysisApi.js'
import MetricCard from './shared/MetricCard.jsx'
import ExplainBox from './shared/ExplainBox.jsx'

export default function AnalysisHome({ stocks, recentTickers, onSelect, onRefreshRecent }) {
  const [stats, setStats] = useState(null)
  const [query, setQuery] = useState('')
  const [dropdown, setDropdown] = useState([])
  const [showDrop, setShowDrop] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const inputRef = useRef(null)
  const activeItemRef = useRef(null)

  useEffect(() => {
    api.marketStats().then(setStats).catch(() => {})
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setDropdown([])
      setShowDrop(false)
      setActiveIndex(-1)
      return
    }

    const q = query.trim().toLowerCase()

    const matched = stocks
      .filter(
        (s) =>
          s.stock_name?.toLowerCase().includes(q) ||
          s.ticker?.includes(q) ||
          s.sector?.toLowerCase().includes(q)
      )
      .slice(0, 40)

    setDropdown(matched)
    setShowDrop(matched.length > 0)
    setActiveIndex(-1)
  }, [query, stocks])

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({
      block: 'nearest',
    })
  }, [activeIndex])

  const handleSelect = (ticker) => {
    setQuery('')
    setShowDrop(false)
    setActiveIndex(-1)
    onSelect(ticker)
  }

  const handleKeyDown = (e) => {
    if (!showDrop || dropdown.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) =>
        prev < dropdown.length - 1 ? prev + 1 : 0
      )
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : dropdown.length - 1
      )
    }

    if (e.key === 'Enter') {
      e.preventDefault()

      if (activeIndex >= 0 && dropdown[activeIndex]) {
        handleSelect(dropdown[activeIndex].ticker)
      }
    }

    if (e.key === 'Escape') {
      setShowDrop(false)
      setActiveIndex(-1)
    }
  }

  const deleteRecent = async (ticker, e) => {
    e.stopPropagation()
    await api.deleteRecent(ticker)
    onRefreshRecent()
  }

  const clearAllRecent = async () => {
    await api.clearRecent()
    onRefreshRecent()
  }

  const recentStocks = recentTickers.filter(Boolean)

  return (
    <div style={styles.page}>
      <section style={styles.container}>
        <div style={styles.pageHeader}>
          <h1 style={styles.pageTitle}>Market Analysis</h1>
          <p style={styles.pageSubtitle}>
            Ju-Dy 와 함께 종목의 위험 신호를 차근차근 확인해 보세요.
          </p>
        </div>

        <section style={styles.topGuideGrid}>
          <div style={styles.guidePanel}>
            <div style={styles.sectionHeaderCompact}>
              <p style={styles.sectionEyebrow}>Market Overview</p>
              <h2 style={styles.sectionTitle}>시장 요약</h2>
            </div>

            <div className="an-grid-4" style={styles.metricGridCompact}>
              <MetricCard title="전체 종목 수" value={stats ? stats.total_stocks.toLocaleString() : '…'} help="상장 종목 전체" accent="#8b5cf6" />
              <MetricCard title="KOSPI" value={stats ? stats.kospi_count.toLocaleString() : '…'} help="유가증권시장" accent="#3b82f6" />
              <MetricCard title="KOSDAQ" value={stats ? stats.kosdaq_count.toLocaleString() : '…'} help="코스닥시장" accent="#22c55e" />
              <MetricCard title="활성 위험 경고" value={stats ? stats.active_warnings.toLocaleString() : '…'} help="현재 적용 기준" accent="#ef4444" />
            </div>
          </div>

          <div style={styles.guidePanel}>
            <div style={styles.sectionHeaderCompact}>
              <p style={styles.sectionEyebrow}>Safety Score</p>
              <h2 style={styles.sectionTitle}>안전점수 등급 기준</h2>
            </div>

            <div className="an-grid-5" style={styles.scoreGridCompact}>
              {[
                { pts: '80~100점', grade: '우수', help: '위험 신호 적음', accent: '#22c55e' },
                { pts: '65~79점', grade: '양호', help: '대체로 안정', accent: '#3b82f6' },
                { pts: '45~64점', grade: '보통', help: '위험 요소 혼재', accent: '#eab308' },
                { pts: '25~44점', grade: '주의', help: '추가 확인 필요', accent: '#f97316' },
                { pts: '0~24점', grade: '위험', help: '투자 주의 필요', accent: '#ef4444' },
              ].map(({ pts, grade, help, accent }) => (
                <MetricCard key={grade} title={pts} value={grade} help={help} accent={accent} />
              ))}
            </div>
          </div>
        </section>

        <section style={styles.searchCard}>
          <div style={styles.searchTopRow}>
            <div style={styles.searchHeaderCompact}>
              <p style={styles.sectionEyebrow}>Stock Search</p>
              <h2 style={styles.sectionTitle}>종목 검색</h2>
            </div>

            <div className="an-search-wrapper" style={styles.searchWrap}>
              <input
                ref={inputRef}
                className="an-search-input"
                type="text"
                placeholder="종목명 또는 종목코드를 입력하세요."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => dropdown.length > 0 && setShowDrop(true)}
                onBlur={() => setTimeout(() => setShowDrop(false), 180)}
                onKeyDown={handleKeyDown}
              />

              {showDrop && (
                <div className="an-search-dropdown">
                  {dropdown.map((s, idx) => (
                    <div
                      key={s.ticker}
                      ref={idx === activeIndex ? activeItemRef : null}
                      className="an-search-item"
                      style={{
                        background: idx === activeIndex ? '#eef6f0' : '#ffffff',
                      }}
                      onMouseDown={() => handleSelect(s.ticker)}
                    >
                      <span style={{ fontWeight: 700 }}>{s.stock_name}</span>
                      <span style={{ color: '#64748b', fontSize: 13, marginLeft: 8 }}>
                        {s.ticker} · {s.market} · {s.sector ?? '-'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={styles.noticeGrid}>
            <div className="an-search-guide">
              <p>✅ 검색 안내 - 종목명 또는 종목코드로 검색할 수 있으며 최근 검색 종목이 자동 저장됩니다.</p>
            </div>

             <div className="an-search-warning">
              <p>⚠️ 중요 안내 - Ju-Dy는 투자 추천 서비스가 아니며 최종 투자 책임은 본인에게 있습니다.</p>
            </div>
          </div>

          {recentStocks.length > 0 && (
            <div style={styles.recentWrap}>
              <div style={styles.recentHeader}>
                <span style={styles.recentTitle}>최근 검색 종목</span>

                <button className="an-btn-ghost" onClick={clearAllRecent} style={styles.clearBtn}>
                  전체 삭제
                </button>
              </div>

              <div className="an-recent-grid" style={styles.recentGrid}>
                {recentStocks.map((s) => (
                  <div key={s.ticker} className="an-recent-item">
                    <button className="an-recent-btn" onClick={() => handleSelect(s.ticker)}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{s.stock_name}</div>
                      <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                        {s.ticker} · {s.market}
                      </div>
                    </button>

                    <button
                      className="an-recent-del"
                      onClick={(e) => deleteRecent(s.ticker, e)}
                      title="삭제"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </section>
    </div>
  )
}

const styles = {
  page: {
    width: '100%',
    minHeight: '100%',
    display: 'flex',
    justifyContent: 'center',
    background: '#f5f5f5',
    fontFamily: "'IBM Plex Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
  },

  container: {
    width: '100%',
    maxWidth: 1280,
    margin: '0 auto',
    padding: '25px 24px 56px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },

  pageHeader: {
    textAlign: 'center',
    marginBottom: 8,
  },

  pageTitle: {
    margin: 0,
    fontSize: 40,
    fontWeight: 800,
    color: '#286346',
    letterSpacing: '-0.03em',
  },

  pageSubtitle: {
    margin: '10px 0 0',
    fontSize: 16,
    color: '#6b7280',
    fontWeight: 400,
    lineHeight: 1.5,
  },

  topGuideGrid: {
    display: 'grid',
    gridTemplateColumns: '0.9fr 1.1fr',
    gap: 0,
    alignItems: 'start',
  },

  guidePanel: {
    padding: '24px 16px',
    borderRadius: 20,
    background: 'transparent',
    boxShadow: 'none',
  },

  searchCard: {
    width: '100%',
    margin: '0 auto',
    padding: '22px 26px 24px',
    borderRadius: 20,
    background: '#fdfdfd',
    border: '1px solid #dbe5de',
    boxShadow: '0 14px 34px rgba(47,111,79,0.08)',
  },

  searchTopRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 20,
    alignItems: 'end',
    marginBottom: 15,
  },

  sectionHeaderCompact: {
    marginBottom: 14,
  },

  sectionEyebrow: {
    margin: 0,
    fontSize: 13,
    fontWeight: 900,
    color: '#2f6f4f',
    letterSpacing: 0.4,
  },

  sectionTitle: {
    margin: '5px 0 0',
    fontSize: 25,
    fontWeight: 900,
    color: '#1f4f3a',
    letterSpacing: '-0.03em',
  },

  metricGridCompact: {
    gap: 12,
  },

  scoreGridCompact: {
    gap: 12,
  },

  noticeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 16,
  },

  recentWrap: {
    marginTop: 0,
  },

  recentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  recentTitle: {
    fontWeight: 900,
    fontSize: 15,
    color: '#1f4f3a',
  },

  clearBtn: {
    fontSize: 13,
    color: '#2f6f4f',
  },

  recentGrid: {
  display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 10,
    maxHeight: 144,
    overflowY: 'auto',
    paddingRight: 14,
  },

  searchWrap: {
    width: '100%',
    marginTop: 0,
  },
}