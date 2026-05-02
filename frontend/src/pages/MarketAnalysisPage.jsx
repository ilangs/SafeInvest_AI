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
