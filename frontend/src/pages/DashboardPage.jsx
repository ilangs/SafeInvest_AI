import { useState } from 'react'
import Navbar from '../components/layout/Navbar'
import QuoteWidget from '../components/market/QuoteWidget'
import WatchlistWidget from '../components/market/WatchlistWidget'
import BalanceWidget from '../components/trading/BalanceWidget'
import ChatWidget from '../components/ai/ChatWidget'

export default function DashboardPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('005930')
  const [balanceRefresh, setBalanceRefresh] = useState(0)

  return (
    <div className="app-layout">
      <Navbar />
      <div className="dashboard-grid">
        {/* 좌측: 관심종목 */}
        <div className="col-left">
          <WatchlistWidget onSelect={setSelectedSymbol} />
        </div>

        {/* 중앙: 현재가 */}
        <div className="col-center">
          <QuoteWidget
            onSymbolChange={setSelectedSymbol}
          />
        </div>

        {/* 우측: 잔고 */}
        <div className="col-right">
          <BalanceWidget refreshKey={balanceRefresh} />
        </div>

        {/* 하단 전체: AI 튜터 */}
        <div className="col-full">
          <ChatWidget />
        </div>
      </div>
    </div>
  )
}
