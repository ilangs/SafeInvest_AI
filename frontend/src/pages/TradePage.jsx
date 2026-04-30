import { useState, useEffect, useCallback } from 'react'
import Navbar            from '../components/layout/Navbar'
import CandleChart       from '../components/trading/CandleChart'
import Orderbook         from '../components/trading/Orderbook'
import OrderForm         from '../components/trading/OrderForm'
import BalanceWidget     from '../components/trading/BalanceWidget'
import HoldingsWidget    from '../components/trading/HoldingsWidget'
import StockInfoWidget   from '../components/trading/StockInfoWidget'
import TodayOrdersWidget from '../components/trading/TodayOrdersWidget'
import api from '../services/api'

export default function TradePage() {
  const [symbol,        setSymbol]        = useState('005930')
  const [inputSymbol,   setInputSymbol]   = useState('005930')
  const [currentPrice,  setCurrentPrice]  = useState(null)
  const [stockName,     setStockName]     = useState('')
  const [changeRate,    setChangeRate]    = useState(null)
  const [change,        setChange]        = useState(null)
  const [selectedPrice, setSelectedPrice] = useState(null)
  const [refreshTick,   setRefreshTick]   = useState(0)
  const [quoteLoading,  setQuoteLoading]  = useState(false)
  const [kisConnected,  setKisConnected]  = useState(true)
  const [kisMode,       setKisMode]       = useState(true)

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

  // 5초 폴링
  useEffect(() => {
    const id = setInterval(fetchQuote, 5000)
    return () => clearInterval(id)
  }, [fetchQuote])

  const handleSearch = () => {
    const code = inputSymbol.trim().padStart(6, '0')
    if (code.length === 6) {
      setSymbol(code)
      setSelectedPrice(null)
      setStockName('')
      setCurrentPrice(null)
    }
  }

  const handleOrderComplete = () => {
    setRefreshTick(t => t + 1)
    fetchQuote()
  }

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
          <input
            value={inputSymbol}
            onChange={e => setInputSymbol(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="종목코드 (예: 005930)"
            maxLength={6}
            style={{
              width: 140, background: 'transparent', border: 'none',
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

          {/* 구분선 */}
          <div style={{ width: 1, height: 28, background: 'var(--color-border-tertiary)' }} />

          {stockName && (
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {stockName}
            </span>
          )}
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>({symbol})</span>

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

          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
            {quoteLoading ? '갱신 중...' : '5초 자동갱신'}
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
