import { useState } from 'react'
import Navbar from '../components/layout/Navbar'
import QuoteWidget from '../components/market/QuoteWidget'
import WatchlistWidget from '../components/market/WatchlistWidget'
import ChatWidget from '../components/ai/ChatWidget'
import AnalysisDashboard from '../components/analysis/AnalysisDashboard'

export default function DashboardPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('005930')
  const [analysisCode, setAnalysisCode] = useState(null)

  const handleAnalyse = (code) => {
    setAnalysisCode(prev => (prev === code ? null : code))
  }

  return (
    <div className="app-layout">
      <Navbar />
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* 상단: 관심종목(좌) + 현재가(우) — 가로 배치 */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <div style={{ flexShrink: 0, width: '200px' }}>
            <WatchlistWidget onSelect={setSelectedSymbol} />
          </div>
          <div style={{ flex: 1 }}>
            <QuoteWidget
              onSymbolChange={setSelectedSymbol}
              onAnalyse={handleAnalyse}
            />
          </div>
        </div>

        {/* 기업 분석 대시보드 */}
        {analysisCode && (
          <AnalysisDashboard stockCode={analysisCode} />
        )}

        {/* AI 튜터 */}
        <ChatWidget />
      </div>
    </div>
  )
}
