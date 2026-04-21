import { useState } from 'react'
import api from '../../services/api'
import { usePolling } from '../../hooks/usePolling'

export default function QuoteWidget({ onSymbolChange }) {
  const [symbol, setSymbol] = useState('005930')
  const [inputVal, setInputVal] = useState('005930')
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState('')

  const { data: quote, loading, error } = usePolling(
    () => api.get(`/api/v1/market/quote?symbol=${symbol}`).then(r => r.data),
    5000
  )

  const handleSearch = (e) => {
    e.preventDefault()
    const code = inputVal.trim().padStart(6, '0')
    setSymbol(code)
    onSymbolChange?.(code)
    setAddMsg('')
  }

  const handleAddWatchlist = async () => {
    if (!quote) return
    setAdding(true)
    setAddMsg('')
    try {
      await api.post('/api/v1/watchlist', { stock_code: symbol, stock_name: quote.name })
      setAddMsg('관심종목에 추가했습니다!')
    } catch (e) {
      const msg = e.response?.data?.detail
      setAddMsg(msg?.includes('이미') ? '이미 추가된 종목입니다.' : '추가 실패. 다시 시도해 주세요.')
    } finally {
      setAdding(false)
    }
  }

  const changeRate = quote?.change_rate ?? 0
  const rateColor = changeRate > 0 ? '#ef4444' : changeRate < 0 ? '#3b82f6' : '#9ca3af'
  const ratePrefix = changeRate > 0 ? '+' : ''

  return (
    <div className="card">
      <div className="card-header">
        <span>📊 현재가 조회</span>
        <span className="mock-badge">🎮 모의투자 모드</span>
      </div>

      <form onSubmit={handleSearch} className="symbol-form">
        <input
          className="symbol-input"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          placeholder="종목코드 (예: 005930)"
          maxLength={6}
        />
        <button type="submit" className="btn-sm">조회</button>
      </form>

      {loading && <p className="muted">불러오는 중...</p>}
      {error && <p className="error-msg">조회 실패. API 서버를 확인하세요.</p>}

      {quote && (
        <div className="quote-body">
          <div className="quote-name">{quote.name} <span className="quote-code">({symbol})</span></div>
          <div className="quote-price">{quote.current_price.toLocaleString()}원</div>
          <div className="quote-change" style={{ color: rateColor }}>
            {ratePrefix}{quote.change.toLocaleString()}원 ({ratePrefix}{changeRate.toFixed(2)}%)
          </div>
          <div className="quote-volume muted">거래량: {quote.volume.toLocaleString()}</div>
          <div className="quote-polling-note muted">5초 자동 갱신 중...</div>

          <button className="btn-outline" onClick={handleAddWatchlist} disabled={adding}>
            ★ 관심종목 추가
          </button>
          {addMsg && <p className="add-msg">{addMsg}</p>}
        </div>
      )}
    </div>
  )
}
