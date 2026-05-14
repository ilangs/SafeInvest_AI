// ════════════════════════════════════════════════════════════════════
// TradePage.jsx — 매매 페이지 (프론트엔드의 가장 종합적인 화면)
// ════════════════════════════════════════════════════════════════════
// [이 페이지가 보여주는 것]
//   ① 상단 검색바    — 종목 자동완성·코드 검색·현재가·등락률
//   ② 캔들 차트      — KIS OHLCV + MA5/20/60 이동평균선
//   ③ 투자정보       — 시가총액·상한가/하한가·PER·52주범위
//   ④ 잔고현황       — 예수금·매수가능·평가금액·총손익
//   ⑤ 호가창        — 매수/매도 10단계 호가 + 클릭으로 가격 자동입력
//   ⑥ 모의투자 폼   — 매수/매도 + 지정가/시장가 + 거래시간 외 차단
//   ⑦ 보유종목       — KIS 보유 + 로컬 미반영분 병합 표시
//   ⑧ 매매내역       — 기간별 주문 이력 (체결/접수 상태 표시)
//
// [핵심 데이터 흐름]
//   - useAuth() 로 사용자 ID 확보 → kisReady 플래그 후 위젯들이 일제히 호출
//   - credentials/status API로 실거래/모의 환경 결정 (kisMode)
//   - 종목 변경 시: localStorage 저장 + stocks API로 시장/업종 메타 fetch
//   - 보유종목 첫 로드 시: 최상단 종목으로 symbol 자동 선택 (1회만)
//
// [관련 컴포넌트]
//   - CandleChart, Orderbook, OrderForm, BalanceWidget, HoldingsWidget,
//     StockInfoWidget, TodayOrdersWidget  (모두 components/trading/)
//
// [백엔드 의존성]
//   /api/v1/market/{quote,orderbook,chart,info,search}
//   /api/v1/account/{balance,holdings}
//   /api/v1/order, /api/v1/orders/{today,history}
//   /api/v1/credentials/status, /api/v1/stocks/{ticker}
// ════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from 'react'
import Navbar            from '../components/layout/Navbar'
import CandleChart       from '../components/trading/CandleChart'
import Orderbook         from '../components/trading/Orderbook'
import OrderForm         from '../components/trading/OrderForm'
import BalanceWidget     from '../components/trading/BalanceWidget'
import HoldingsWidget    from '../components/trading/HoldingsWidget'
import StockInfoWidget   from '../components/trading/StockInfoWidget'
import TodayOrdersWidget from '../components/trading/TodayOrdersWidget'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

function isMarketOpen() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const day = kst.getUTCDay()
  if (day === 0 || day === 6) return false
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes()
  return minutes >= 9 * 60 && minutes < 15 * 60 + 30
}

const DEFAULT_SYMBOL = '005930'

// 사용자별 마지막 조회 종목 키
const lastSymbolKey = (userId) => `safeinvest:lastSymbol:${userId || 'guest'}`

function readLastSymbol(userId) {
  try {
    const v = localStorage.getItem(lastSymbolKey(userId))
    return v && /^\d{6}$/.test(v) ? v : null
  } catch {
    return null
  }
}

function saveLastSymbol(userId, code) {
  try { localStorage.setItem(lastSymbolKey(userId), code) } catch {}
}

export default function TradePage() {
  const { user } = useAuth()
  const userId = user?.id || null

  // 화면 상태값
  const [symbol,        setSymbol]        = useState(() => readLastSymbol(userId) || DEFAULT_SYMBOL)
  const [inputSymbol,   setInputSymbol]   = useState('')
  const [currentPrice,  setCurrentPrice]  = useState(null)
  const [stockName,     setStockName]     = useState('')
  const [stockMeta,     setStockMeta]     = useState({ market: '', industry: '', sector: '' })
  const [changeRate,    setChangeRate]    = useState(null)
  const [change,        setChange]        = useState(null)
  const [selectedPrice, setSelectedPrice] = useState(null)
  const [refreshTick,   setRefreshTick]   = useState(0)
  const [quoteLoading,  setQuoteLoading]  = useState(false)
  const [kisConnected,  setKisConnected]  = useState(true)
  const [kisMode,       setKisMode]       = useState(true)
  const [kisReady,      setKisReady]      = useState(false)   // credentials 1차 확인 완료 여부
  const [suggestions,   setSuggestions]   = useState([])
  const [showSugg,      setShowSugg]      = useState(false)
  const [activeSuggIndex, setActiveSuggIndex] = useState(-1)
  const [marketOpen,    setMarketOpen]    = useState(isMarketOpen)

  const searchRef   = useRef(null)
  const searchTimer = useRef(null)

  // 이전 시세 요청 무효화용 ID
  const quoteReqId  = useRef(0)

  // 종목 변경 시 기존 시세값 초기화 + 종목 메타정보(시장/업종) 조회
  useEffect(() => {
    quoteReqId.current += 1
    setCurrentPrice(null)
    setChangeRate(null)
    setChange(null)
    setStockMeta({ market: '', industry: '', sector: '' })

    if (symbol && /^\d{6}$/.test(symbol)) {
      saveLastSymbol(userId, symbol)
      // analysis 모듈과 동일하게 stocks 테이블에서 시장/업종 가져옴
      api.get(`/api/v1/stocks/${symbol}`)
        .then(res => {
          if (res.data) {
            setStockMeta({
              market:   res.data.market   || '',
              industry: res.data.industry || '',
              sector:   res.data.sector   || '',
            })
            // 종목명도 보강 (quote API보다 먼저 응답할 수 있음)
            if (res.data.stock_name && !stockName) {
              setStockName(res.data.stock_name)
            }
          }
        })
        .catch(() => { /* stocks 테이블에 없는 종목 — 표시만 생략 */ })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, userId])

  // 로그인 후 사용자별 마지막 조회 종목 복원
  useEffect(() => {
    if (!userId) return

    const saved = readLastSymbol(userId)
    if (saved && saved !== symbol) {
      setSymbol(saved)
      setStockName('')
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // 현재가 조회
  const fetchQuote = useCallback(async () => {
    if (!symbol) return

    const myReq = ++quoteReqId.current
    setQuoteLoading(true)

    try {
      const res = await api.get(`/api/v1/market/quote?symbol=${symbol}&is_mock=${kisMode}`)

      // 최신 요청만 화면에 반영
      if (myReq !== quoteReqId.current) return

      setCurrentPrice(res.data.current_price)

      // ★ 백엔드 QuoteResponse 필드명은 `name` (이전엔 `stock_name`을 잘못 참조)
      const apiName = res.data.name
      if (apiName && apiName !== symbol && !/^\d{6}$/.test(apiName)) {
        setStockName(apiName)
      }

      setChangeRate(res.data.change_rate)
      setChange(res.data.change)
    } catch (e) {
      if (myReq === quoteReqId.current) console.error('시세 조회 실패:', e)
    } finally {
      if (myReq === quoteReqId.current) setQuoteLoading(false)
    }
  }, [symbol, kisMode])

  useEffect(() => { fetchQuote() }, [fetchQuote])

  // 장중/장외 갱신 주기 관리
  useEffect(() => {
    const INTERVAL = marketOpen ? 5000 : 60000

    const id = setInterval(() => {
      const open = isMarketOpen()
      setMarketOpen(open)

      if (open) fetchQuote()
    }, INTERVAL)

    return () => clearInterval(id)
  }, [fetchQuote, marketOpen])

  // 자동완성 검색
  const handleSearchInput = (val) => {
    setInputSymbol(val)
    setActiveSuggIndex(-1)
    clearTimeout(searchTimer.current)

    if (!val.trim()) {
      setSuggestions([])
      setShowSugg(false)
      return
    }

    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/api/v1/market/search?q=${encodeURIComponent(val)}&limit=8`)
        setSuggestions(res.data || [])
        setShowSugg(true)
        setActiveSuggIndex(-1)
      } catch {
        setSuggestions([])
      }
    }, 250)
  }

  // 자동완성 종목 선택
  const handleSelectSugg = (stock) => {
    setSuggestions([])
    setShowSugg(false)
    setActiveSuggIndex(-1)
    setInputSymbol('')
    setSymbol(stock.code)
    setStockName(stock.stock_name)
    setSelectedPrice(null)
    setCurrentPrice(null)
  }

  // 종목 코드 직접 검색
  const handleSearch = () => {
    const code = inputSymbol.trim().padStart(6, '0')

    if (/^\d{6}$/.test(code)) {
      setSymbol(code)
      setInputSymbol('')
      setShowSugg(false)
      setActiveSuggIndex(-1)
      setSelectedPrice(null)
      setStockName('')
      setCurrentPrice(null)
    }
  }

  // 자동완성 키보드 조작
  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()

      if (!showSugg || suggestions.length === 0) return

      setActiveSuggIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      )
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()

      if (!showSugg || suggestions.length === 0) return

      setActiveSuggIndex(prev =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      )
    }

    if (e.key === 'Enter') {
      e.preventDefault()

      if (showSugg && activeSuggIndex >= 0 && suggestions[activeSuggIndex]) {
        handleSelectSugg(suggestions[activeSuggIndex])
      } else {
        handleSearch()
      }
    }

    if (e.key === 'Escape') {
      setShowSugg(false)
      setActiveSuggIndex(-1)
    }
  }

  // 주문 완료 후 관련 위젯 갱신
  const handleOrderComplete = () => {
    setRefreshTick(t => t + 1)
    fetchQuote()

    // 주문 반영 지연 보완용 2차 갱신
    setTimeout(() => setRefreshTick(t => t + 1), 1500)
  }

  // 검색창 외부 클릭 시 자동완성 닫기
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSugg(false)
        setActiveSuggIndex(-1)
      }
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // KIS 연결 상태 확인 — 완료 후 kisReady=true 로 위젯 자동 로드 트리거
  useEffect(() => {
    api.get('/api/v1/credentials/status')
      .then(res => {
        const realConn = res.data.find(c => c.is_mock === false && c.is_connected)
        const mockConn = res.data.find(c => c.is_mock === true && c.is_connected)
        const activeConn = realConn || mockConn || null

        setKisConnected(!!activeConn)
        setKisMode(activeConn ? activeConn.is_mock : true)
      })
      .catch(() => setKisConnected(false))
      .finally(() => setKisReady(true))
  }, [])

  // 첫 보유종목 자동 선택 — 진입 1회만, 사용자가 직접 종목 검색하면 비활성화
  const firstHoldingApplied = useRef(false)
  const handleHoldingsLoaded = useCallback((holdings) => {
    if (firstHoldingApplied.current) return
    if (!Array.isArray(holdings) || holdings.length === 0) {
      firstHoldingApplied.current = true   // 보유종목 없음 → 더 시도 안 함
      return
    }
    const top = holdings[0]
    if (top?.stock_code && /^\d{6}$/.test(top.stock_code)) {
      setSymbol(top.stock_code)
      setStockName(top.stock_name || '')
      firstHoldingApplied.current = true
    }
  }, [])

  const isUp = changeRate != null && changeRate >= 0
  const rateColor = changeRate == null
    ? 'var(--text-secondary)'
    : isUp ? 'var(--up)' : 'var(--down)'

  return (
    <div className="app-layout">
      <Navbar />

      {/* TradePage 전용 레이아웃 스타일 */}
      <style>{`
  .trade-page-shell {
    flex: 1;
    min-height: 100vh;
    padding: 18px 20px 24px;

    /* 다른 메뉴들과 맞추기 위한 기본 배경 */
    background: var(--bg-primary);
  }

  .trade-dashboard {
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
  }

  .trade-top-panel {
    background: var(--bg-card);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
  }

  .trade-warning-banner {
    background: #FEF3C7;
    border: 1px solid #F59E0B;
    border-radius: var(--border-radius-md);
    padding: 9px 14px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
    color: #78350F;
  }
  [data-theme="dark"] .trade-warning-banner {
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.5);
    color: #fbbf24;
  }

  .trade-search-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: var(--border-radius-md);
    padding: 9px 14px;
    margin-bottom: 12px;
  }

  .trade-main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px;
    grid-template-areas:
      "chart sideTop"
      "bottom bottom";
    gap: 12px;
    align-items: start;
  }

  .trade-chart-area {
    grid-area: chart;
    min-width: 0;
    min-height: 470px;
  }

  .trade-chart-area > * {
    min-height: 470px;
  }

  .trade-side-top {
    grid-area: sideTop;
    display: grid;
    grid-template-rows: 0.9fr 0.65fr;
    gap: 12px;
    min-width: 0;
    min-height: 470px;
  }

  .trade-bottom-wide {
    grid-area: bottom;
    display: grid;
    grid-template-columns: 300px 320px minmax(0, 1fr);
    gap: 12px;
    align-items: stretch;
    min-width: 0;

    /* 하단 전체 높이 */
    height: 520px;
  }

  .trade-bottom-right {
    display: grid;
    grid-template-rows: 1fr 1fr;
    gap: 12px;
    min-width: 0;
    height: 520px;
  }

  .trade-widget-frame {
    min-width: 0;
    height: 100%;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--border-radius-md);
    overflow: hidden;
  }

  .trade-widget-frame > * {
    height: 100%;
  }

  /* ── laptop ↓ (≤1024px): 메인 그리드 1열로 전환, 위젯 줄별 2열 ── */
  @media (max-width: 1024px) {
    .trade-main-grid {
      grid-template-columns: 1fr;
      grid-template-areas:
        "chart"
        "sideTop"
        "bottom";
    }

    .trade-side-top {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto;
      min-height: auto;
    }
    .trade-side-top > * { min-height: 340px; }

    .trade-bottom-wide {
      grid-template-columns: 1fr 1fr;
      height: auto;
    }

    .trade-bottom-right {
      grid-column: 1 / -1;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto;
      height: auto;
    }
    .trade-bottom-wide > .trade-widget-frame,
    .trade-bottom-right > .trade-widget-frame { min-height: 380px; }
  }

  /* ── tablet ↓ (≤768px): 검색바 wrap, 패딩 축소, 차트 높이 감소 ── */
  @media (max-width: 768px) {
    .trade-page-shell {
      padding: 12px 12px 20px;
    }

    .trade-search-bar {
      flex-wrap: wrap;
      gap: 8px !important;
      padding: 10px 12px !important;
    }
    /* 검색바 안쪽 구분선(작은 세로바) 숨김 — 줄바꿈 후 어색해짐 */
    .trade-search-bar > div[style*="width: 1px"] { display: none; }

    .trade-chart-area,
    .trade-chart-area > * { min-height: 360px !important; }
  }

  /* ── mobile (≤480px): 모든 위젯 1열 풀폭, 높이 더 축소 ── */
  @media (max-width: 480px) {
    .trade-page-shell { padding: 8px 8px 16px; }

    .trade-warning-banner {
      flex-direction: column;
      align-items: flex-start !important;
      gap: 6px !important;
      font-size: 12px !important;
    }

    .trade-side-top,
    .trade-bottom-wide,
    .trade-bottom-right {
      grid-template-columns: 1fr !important;
    }

    .trade-chart-area,
    .trade-chart-area > * { min-height: 300px !important; }
    .trade-side-top > * { min-height: 280px !important; }
    .trade-bottom-wide > .trade-widget-frame,
    .trade-bottom-right > .trade-widget-frame { min-height: 320px !important; }

    /* 검색바 input/버튼 풀폭 */
    .trade-search-bar > div:first-child {
      width: 100%;
    }
    .trade-search-bar > div:first-child > input {
      width: 100% !important;
      flex: 1;
    }
    /* 자동완성 드롭다운: 풀폭 */
    .trade-search-bar > div:first-child > div[style*="position: absolute"] {
      left: 0 !important;
      right: 0 !important;
      min-width: 0 !important;
      width: 100% !important;
    }
    /* 장 운영 상태 — 왼쪽 정렬로 풀어줌 */
    .trade-search-bar > span:last-child {
      margin-left: 0 !important;
      font-size: 12px !important;
    }
  }
`}</style>

      <div className="trade-page-shell">
        <div className="trade-dashboard">

          {/* KIS 미연결 배너 */}
          {!kisConnected && (
            <div className="trade-warning-banner">
              <span>KIS 계좌가 연결되지 않았습니다. 모의 데이터로 표시 중입니다.</span>
              <a href="/mypage" style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>
                계좌 연결하기 →
              </a>
            </div>
          )}

          {/* 종목 검색 / 현재가 바 */}
          <div className="trade-top-panel trade-search-bar">
            {/* 자동완성 드롭다운 래퍼 */}
            <div ref={searchRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                value={inputSymbol}
                onChange={e => handleSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="종목명 또는 코드 검색"
                style={{
                  width: 180,
                  background: 'transparent',
                  border: 'none',
                  fontSize: 14,
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                }}
              />

              <button
                onClick={handleSearch}
                style={{
                  padding: '4px 14px',
                  background: 'var(--brand)',
                  color: 'var(--text-on-brand)',
                  border: 'none',
                  borderRadius: 'var(--border-radius-md)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                조회
              </button>

              {/* 자동완성 드롭다운 */}
              {showSugg && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  zIndex: 200,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--border-radius-md)',
                  boxShadow: 'var(--shadow-md)',
                  minWidth: 280,
                  marginTop: 4,
                }}>
                  {suggestions.map((s, idx) => (
                    <div
                      key={s.code}
                      onMouseDown={() => handleSelectSugg(s)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 13,
                        background: activeSuggIndex === idx
                          ? 'var(--brand-bg)'
                          : 'transparent',
                      }}
                      onMouseEnter={e => {
                        setActiveSuggIndex(idx)
                        e.currentTarget.style.background = 'var(--brand-bg)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = activeSuggIndex === idx
                          ? 'var(--brand-bg)'
                          : 'transparent'
                      }}
                    >
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'monospace' }}>
                        {s.code} <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{s.market}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 구분선 */}
            <div style={{ width: 1, height: 28, background: 'var(--border)' }} />

            {/* 종목 정보 inline: 종목명 · 코드 035420 · KOSPI · IT·서비스 */}
            {stockName && (
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                {stockName}
              </span>
            )}

            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              · 코드 <span style={{ fontFamily: 'monospace' }}>{symbol}</span>
            </span>

            {stockMeta.market && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                · {stockMeta.market}
              </span>
            )}

            {stockMeta.industry && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                · {stockMeta.industry}
              </span>
            )}

            {/* 현재가 표시 */}
            {currentPrice != null && (
              <>
                <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginLeft: 4 }}>
                  {currentPrice.toLocaleString()}원
                </span>

                <span style={{ fontSize: 13, color: rateColor, fontWeight: 500 }}>
                  {isUp ? '▲' : '▼'}&nbsp;
                  {change != null ? `${Math.abs(change).toLocaleString()}원` : ''}
                  &nbsp;({isUp ? '+' : ''}{(changeRate ?? 0).toFixed(2)}%)
                </span>
              </>
            )}

            {/* 장 운영 상태 표시 */}
            <span style={{ fontSize: 13, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: marketOpen ? 'var(--success)' : 'var(--text-muted)',
              }} />

              <span style={{ color: marketOpen ? 'var(--success)' : 'var(--text-secondary)' }}>
                {quoteLoading ? '갱신 중...' : marketOpen ? '장 운영 중 · 5초 갱신' : '장 마감 · 1분 갱신'}
              </span>
            </span>
          </div>

          {/* 대시보드 전체 배치 */}
          <div className="trade-main-grid">

            {/* 왼쪽 상단: 그래프 */}
            <div className="trade-chart-area trade-widget-frame">
              <CandleChart symbol={symbol} currentPrice={currentPrice} isMockMode={kisMode} />
            </div>

            {/* 오른쪽 상단: 투자정보 + 잔고현황 */}
            <div className="trade-side-top">
              <div className="trade-widget-frame">
                <StockInfoWidget symbol={symbol} currentPrice={currentPrice} isMock={kisMode} />
              </div>

              <div className="trade-widget-frame">
                <BalanceWidget refreshTrigger={refreshTick} isMock={kisMode} kisReady={kisReady} />
              </div>
            </div>

            {/* 왼쪽 하단 전체: 호가창 + 주문창 + 보유종목/매매내역 */}
            <div className="trade-bottom-wide">

              {/* 호가창 */}
              <div className="trade-widget-frame">
                <Orderbook
                  symbol={symbol}
                  currentPrice={currentPrice}
                  onPriceSelect={setSelectedPrice}
                  isMock={kisMode}
                />
              </div>

              {/* 매수/매도창 */}
              <div className="trade-widget-frame">
                <OrderForm
                  symbol={symbol}
                  currentPrice={currentPrice}
                  defaultPrice={selectedPrice}
                  onOrderComplete={handleOrderComplete}
                  isMock={kisMode}
                />
              </div>

              {/* 보유종목 + 매매내역 */}
              <div className="trade-bottom-right">
                <div className="trade-widget-frame">
                  <HoldingsWidget
                    refreshTrigger={refreshTick}
                    isMock={kisMode}
                    kisReady={kisReady}
                    onHoldingsLoad={handleHoldingsLoaded}
                  />
                </div>

                <div className="trade-widget-frame">
                  <TodayOrdersWidget refreshTrigger={refreshTick} isMock={kisMode} />
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    </div>
  )
}