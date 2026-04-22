/**
 * TradePage.jsx — Module C 전면 재구성
 *
 * 레이아웃:
 *   [상단] QuoteWidget (종목 검색 + 현재가)
 *   [중단] ChartWidget(좌) | OrderbookWidget(중) | StockInfoWidget+OrderForm(우)
 *   [하단] BalanceWidget | HoldingsWidget
 *
 * 상태 흐름:
 *   currentSymbol  → 모든 위젯 공유
 *   currentPrice   → QuoteWidget → OrderForm, StockInfoWidget
 *   selectedPrice  → OrderbookWidget → OrderForm defaultPrice
 *   refreshKey     → 주문 완료 시 Balance/Holdings 갱신
 */
import { useState, useCallback } from 'react'
import Navbar from '../components/layout/Navbar'
import QuoteWidget from '../components/market/QuoteWidget'
import ChartWidget from '../components/trading/ChartWidget'
import OrderbookWidget from '../components/trading/OrderbookWidget'
import StockInfoWidget from '../components/trading/StockInfoWidget'
import OrderForm from '../components/trading/OrderForm'
import BalanceWidget from '../components/trading/BalanceWidget'
import HoldingsWidget from '../components/trading/HoldingsWidget'

export default function TradePage() {
  const [currentSymbol, setCurrentSymbol] = useState('005930')
  const [currentPrice,  setCurrentPrice]  = useState(0)
  const [selectedPrice, setSelectedPrice] = useState(null)
  const [refreshKey,    setRefreshKey]    = useState(0)
  const [balance,       setBalance]       = useState(0)   // BalanceWidget에서 끌어올리기

  const handleSymbolChange = useCallback((code) => {
    setCurrentSymbol(code)
    setCurrentPrice(0)
    setSelectedPrice(null)
  }, [])

  const handlePriceUpdate = useCallback((price) => {
    setCurrentPrice(price)
  }, [])

  const handlePriceSelect = useCallback((price) => {
    setSelectedPrice(price)
  }, [])

  const handleOrderDone = useCallback(() => {
    setRefreshKey(k => k + 1)
    setSelectedPrice(null)
  }, [])

  return (
    <div className="app-layout">
      <Navbar />
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* ── 상단: 현재가 조회 바 ── */}
        <QuoteWidget
          onSymbolChange={handleSymbolChange}
          onPriceUpdate={handlePriceUpdate}
        />

        {/* ── 중단: 3컬럼 그리드 ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 200px 300px',
          gap: '12px',
          alignItems: 'stretch',
          minHeight: '420px',
        }}>
          {/* 좌: 차트 */}
          <ChartWidget symbol={currentSymbol} />

          {/* 중: 호가창 */}
          <OrderbookWidget
            symbol={currentSymbol}
            onPriceSelect={handlePriceSelect}
          />

          {/* 우: 투자정보 + 주문창 (세로 스택) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ flex: '0 0 auto' }}>
              <StockInfoWidget
                symbol={currentSymbol}
                currentPrice={currentPrice}
              />
            </div>
            <div style={{ flex: '1 1 auto' }}>
              <OrderForm
                defaultSymbol={currentSymbol}
                defaultPrice={selectedPrice}
                currentPrice={currentPrice}
                availableBalance={balance}
                onOrderDone={handleOrderDone}
              />
            </div>
          </div>
        </div>

        {/* ── 하단: 잔고 + 보유종목 ── */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div style={{ flexShrink: 0, width: '260px' }}>
            <BalanceWidget
              refreshKey={refreshKey}
              onBalanceLoad={setBalance}
            />
          </div>
          <div style={{ flex: 1 }}>
            <HoldingsWidget refreshKey={refreshKey} />
          </div>
        </div>

      </div>
    </div>
  )
}
