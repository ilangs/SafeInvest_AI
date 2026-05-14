// ════════════════════════════════════════════════════════════════════
// MarketAnalysisPage.jsx — 시장분석 페이지 (종목 안전성 평가)
// ════════════════════════════════════════════════════════════════════
// [이 페이지가 하는 일]
//   사용자가 관심 종목을 고르면 ① 재무 안정성 ② 수익성 ③ 거래 활성도
//   를 종합한 "안전성 스코어"를 보여주고, 위험 신호(자본잠식·연속적자·
//   고부채·매출부족)를 한 화면에 정리.
//
// [데이터 소스]
//   - analysis/daily_update.py가 매일 KRX/DART/KIS에서 수집해 적재한
//     Supabase의 stocks/stock_prices/stock_financials/stock_warnings
//
// [구성]
//   - AnalysisHome   : 종목 목록·최근 조회·시장 통계
//   - AnalysisDetail : 선택 종목의 상세 (스코어, 차트, 재무, 경고, AI 분석)
//
// [최근 조회 기능]
//   recent_searches 테이블에 사용자별로 저장 — 페이지 재진입 시 빠르게
//   이전 관심 종목으로 돌아갈 수 있음.
// ════════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react'
import Navbar         from '../components/layout/Navbar'
import AnalysisHome   from '../components/analysis/AnalysisHome.jsx'
import AnalysisDetail from '../components/analysis/AnalysisDetail.jsx'
import { api }        from '../services/analysisApi.js'

export default function MarketAnalysisPage() {
  const [stocks,         setStocks]         = useState([])
  const [recentTickers,  setRecentTickers]  = useState([])
  const [selectedTicker, setSelectedTicker] = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)

  useEffect(() => {
    api.stocks()
      .then(s => setStocks(s))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
    api.recentSearches()
      .then(r => setRecentTickers(r))
      .catch(() => {/* recent_searches 없어도 메인 기능 유지 */})
  }, [])

  const selectStock = async (ticker) => {
    setSelectedTicker(ticker)
    try {
      await api.addRecent(ticker)
      setRecentTickers(await api.recentSearches())
    } catch { /* 최근검색 실패는 무시 */ }
  }

  const goHome = () => setSelectedTicker(null)

  const refreshRecent = async () => {
    try { setRecentTickers(await api.recentSearches()) } catch { /* ignore */ }
  }

  return (
    <div className="app-layout">
      <Navbar />
      <div className="an-page-root">
        {loading ? (
          <div className="an-loading">
            <div className="an-spinner" />
            <p>종목 데이터 로딩 중...</p>
          </div>
        ) : error ? (
          <div className="an-warning-box" style={{ marginTop: 40 }}>
            <b>⚠️ 서버 연결 실패</b><br />
            분석 서버에 연결할 수 없습니다.<br />
            <code style={{ fontSize: 13, color: '#ffd0d0' }}>{error}</code>
          </div>
        ) : selectedTicker ? (
          <AnalysisDetail
            ticker={selectedTicker}
            stocks={stocks}
            onBack={goHome}
          />
        ) : (
          <AnalysisHome
            stocks={stocks}
            recentTickers={recentTickers}
            onSelect={selectStock}
            onRefreshRecent={refreshRecent}
          />
        )}
      </div>
    </div>
  )
}
