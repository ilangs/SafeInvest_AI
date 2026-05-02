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

function isMarketOpen() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const day = kst.getUTCDay() // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes()
  return minutes >= 9 * 60 && minutes < 15 * 60 + 30
}

export default function TradePage() {
  const [symbol,        setSymbol]        = useState('005930')
  const [inputSymbol,   setInputSymbol]   = useState('')
  const [currentPrice,  setCurrentPrice]  = useState(null)
  const [stockName,     setStockName]     = useState('')
  const [changeRate,    setChangeRate]    = useState(null)
  const [change,        setChange]        = useState(null)
  const [selectedPrice, setSelectedPrice] = useState(null)
  const [refreshTick,   setRefreshTick]   = useState(0)
  const [quoteLoading,  setQuoteLoading]  = useState(false)
  const [kisConnected,  setKisConnected]  = useState(true)
  const [kisMode,       setKisMode]       = useState(true)
  const [suggestions,   setSuggestions]   = useState([])
  const [showSugg,      setShowSugg]      = useState(false)
  const [marketOpen,    setMarketOpen]    = useState(isMarketOpen)

  const searchRef   = useRef(null)
  const searchTimer = useRef(null)

  // 현재가 조회
  const fetchQuote = useCallback(async () => {
    if (!symbol) return
    setQuoteLoading(true)
    try {
      const res = await api.get(`/api/v1/market/quote?symbol=${symbol}&is_mock=${kisMode}`)
      setCurrentPrice(res.data.current_price)
      setStockName(res.data.name)
      setChangeRate(res.data.change_rate)
      setChange(res.data.change)
    } catch (e) {
      console.error('시세 조회 실패:', e)
    } finally {
      setQuoteLoading(false)
    }
  }, [symbol, kisMode])

  useEffect(() => { fetchQuote() }, [fetchQuote])

  // 장 시간 인식 폴링: 장중 5초, 장외 60초
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
    clearTimeout(searchTimer.current)
    if (!val.trim()) { setSuggestions([]); setShowSugg(false); return }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/api/v1/market/search?q=${encodeURIComponent(val)}&limit=8`)
        setSuggestions(res.data || [])
        setShowSugg(true)
      } catch { setSuggestions([]) }
    }, 250)
  }

  const handleSelectSugg = (stock) => {
    setSuggestions([])
    setShowSugg(false)
    setInputSymbol('')
    setSymbol(stock.code)
    setStockName(stock.name)
    setSelectedPrice(null)
    setCurrentPrice(null)
  }

  const handleSearch = () => {
    const code = inputSymbol.trim().padStart(6, '0')
    if (/^\d{6}$/.test(code)) {
      setSymbol(code)
      setInputSymbol('')
      setShowSugg(false)
      setSelectedPrice(null)
      setStockName('')
      setCurrentPrice(null)
    }
  }

  const handleOrderComplete = () => {
    setRefreshTick(t => t + 1)
    fetchQuote()
  }

  // 검색창 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSugg(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // KIS 연결 상태 확인 (마운트 시 1회)
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
  }, [])

  const isUp = changeRate != null && changeRate >= 0
  const rateColor = changeRate == null ? '#64748b' : isUp ? '#ef4444' : '#3b82f6'

  return (
    <div className="app-layout">
      <Navbar />
      <div style={{ padding: '12px 16px', background: 'var(--color-background-tertiary)', flex: 1 }}>

        {/* ── KIS 미연결 배너 ── */}
        {!kisConnected && (
          <div style={{
            background: '#FEF3C7', border: '0.5px solid #F59E0B',
            borderRadius: 'var(--border-radius-md)', padding: '8px 14px',
            marginBottom: 8, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', fontSize: 13,
          }}>
            <span>⚠️ KIS 계좌가 연결되지 않았습니다. 모의 데이터로 표시 중입니다.</span>
            <a href="/mypage" style={{ color: '#92400E', fontWeight: 600, textDecoration: 'none' }}>
              계좌 연결하기 →
            </a>
          </div>
        )}

        {/* ── 종목 검색 / 현재가 바 ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--color-background-primary)',
          borderRadius: 'var(--border-radius-md)',
          padding: '8px 14px', marginBottom: 10,
          border: '0.5px solid var(--color-border-tertiary)',
        }}>
          {/* 자동완성 드롭다운 래퍼 */}
          <div ref={searchRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              value={inputSymbol}
              onChange={e => handleSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="종목명 또는 코드 검색"
              style={{
                width: 180, background: 'transparent', border: 'none',
                fontSize: 14, color: 'var(--color-text-primary)', outline: 'none',
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                padding: '4px 14px', background: '#0F6E56', color: '#fff',
                border: 'none', borderRadius: 'var(--border-radius-md)',
                fontSize: 13, cursor: 'pointer',
              }}
            >조회</button>

            {/* 드롭다운 */}
            {showSugg && suggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 200,
                background: 'var(--color-background-primary)',
                border: '1px solid var(--color-border-tertiary)',
                borderRadius: 'var(--border-radius-md)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                minWidth: 280, marginTop: 4,
              }}>
                {suggestions.map(s => (
                  <div
                    key={s.code}
                    onMouseDown={() => handleSelectSugg(s)}
                    style={{
                      padding: '8px 12px', cursor: 'pointer', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center', fontSize: 13,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-background-tertiary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{s.name}</span>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: 11, fontFamily: 'monospace' }}>
                      {s.code} <span style={{ color: '#94a3b8', marginLeft: 4 }}>{s.market}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 구분선 */}
          <div style={{ width: 1, height: 28, background: 'var(--color-border-tertiary)' }} />

          {/* 종목명 표시 (코드보다 이름 강조) */}
          {stockName && (
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {stockName}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
            {symbol}
          </span>

          {currentPrice != null && (
            <>
              <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {currentPrice.toLocaleString()}원
              </span>
              <span style={{ fontSize: 13, color: rateColor, fontWeight: 500 }}>
                {isUp ? '▲' : '▼'}&nbsp;
                {change != null ? `${Math.abs(change).toLocaleString()}원` : ''}
                &nbsp;({isUp ? '+' : ''}{(changeRate ?? 0).toFixed(2)}%)
              </span>
            </>
          )}

          <span style={{ fontSize: 11, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              background: marketOpen ? '#22c55e' : '#94a3b8',
            }} />
            <span style={{ color: marketOpen ? '#22c55e' : 'var(--color-text-secondary)' }}>
              {quoteLoading ? '갱신 중...' : marketOpen ? '장 운영 중 · 5초 갱신' : '장 마감 · 1분 갱신'}
            </span>
          </span>
        </div>

        {/* ── 메인 그리드: 차트 | 호가창 | 주문창 ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 190px 280px',
          gap: 10, marginBottom: 10,
          alignItems: 'stretch',
        }}>
          {/* 좌: 차트 */}
          <CandleChart symbol={symbol} currentPrice={currentPrice} isMockMode={kisMode} />

          {/* 중: 호가창 */}
          <Orderbook
            symbol={symbol}
            currentPrice={currentPrice}
            onPriceSelect={setSelectedPrice}
            isMock={kisMode}
          />

          {/* 우: 주문창 */}
          <OrderForm
            symbol={symbol}
            currentPrice={currentPrice}
            defaultPrice={selectedPrice}
            onOrderComplete={handleOrderComplete}
            isMock={kisMode}
          />
        </div>

        {/* ── 하단 1행: 투자정보 | 잔고 | 보유종목 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 2fr', gap: 10, marginBottom: 10 }}>
          <StockInfoWidget symbol={symbol} currentPrice={currentPrice} isMock={kisMode} />
          <BalanceWidget  refreshTrigger={refreshTick} isMock={kisMode} />
          <HoldingsWidget refreshTrigger={refreshTick} isMock={kisMode} />
        </div>

        {/* ── 하단 2행: 당일 주문내역 ── */}
        <TodayOrdersWidget refreshTrigger={refreshTick} isMock={kisMode} />

      </div>
    </div>
  )
}
