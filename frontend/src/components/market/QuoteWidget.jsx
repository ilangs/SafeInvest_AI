import { useState } from 'react'
import api from '../../services/api'
import { usePolling } from '../../hooks/usePolling'
import { useStockName } from '../../hooks/useStockName'

export default function QuoteWidget({ onSymbolChange, onAnalyse, onPriceUpdate }) {
  const [symbol, setSymbol] = useState('005930')
  const [inputVal, setInputVal] = useState('005930')
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState('')

  const { data: quote, loading, error } = usePolling(
    () =>
      api.get(`/api/v1/market/quote?symbol=${symbol}`).then((r) => {
        if (r.data?.current_price) onPriceUpdate?.(r.data.current_price)
        return r.data
      }),
    5000,
  )

  const cachedName = useStockName(symbol)
  const changeRate = quote?.change_rate ?? 0
  const rateColor = changeRate > 0 ? '#ef4444' : changeRate < 0 ? '#3b82f6' : '#475569'
  const ratePrefix = changeRate > 0 ? '+' : ''

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
      await api.post('/api/v1/watchlist', {
        stock_code: symbol,
        stock_name: quote.name || cachedName || symbol,
      })
      setAddMsg('관심종목에 추가했습니다.')
    } catch (e) {
      const msg = e.response?.data?.detail
      setAddMsg(msg?.includes('이미') ? '이미 추가된 종목입니다.' : '추가에 실패했습니다.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span>현재가 조회</span>
        <span className="mock-badge">모의투자</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', paddingTop: '8px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <input className="symbol-input" value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder="종목코드" maxLength={6} style={{ width: '110px' }} />
          <button type="submit" className="btn-sm">조회</button>
        </form>

        {(quote || cachedName) && <div style={{ width: '1px', height: '36px', background: '#d7e1ee', flexShrink: 0 }} />}

        {loading && !quote && <span style={{ color: '#64748b', fontSize: '13px' }}>불러오는 중...</span>}
        {error && <span style={{ color: '#ef4444', fontSize: '13px' }}>조회 실패</span>}

        {!quote && cachedName && (
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155', flexShrink: 0 }}>
            {cachedName}
            <span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '6px' }}>({symbol})</span>
          </span>
        )}

        {quote && (
          <>
            <div style={{ flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>{quote.name || cachedName || symbol}</span>
              <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>({symbol})</span>
            </div>

            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', flexShrink: 0 }}>{quote.current_price.toLocaleString()}원</div>

            <div style={{ fontSize: '14px', color: rateColor, fontWeight: 600, flexShrink: 0 }}>
              {ratePrefix}{quote.change.toLocaleString()}원 ({ratePrefix}{changeRate.toFixed(2)}%)
            </div>

            <div style={{ fontSize: '13px', color: '#475569', flexShrink: 0 }}>거래량 {quote.volume.toLocaleString()}</div>

            <div style={{ width: '1px', height: '36px', background: '#d7e1ee', flexShrink: 0 }} />

            {onAnalyse && (
              <button className="btn-outline" onClick={() => onAnalyse(symbol)} style={{ flexShrink: 0 }}>
                기업 분석 보기
              </button>
            )}

            <button className="btn-outline" onClick={handleAddWatchlist} disabled={adding} style={{ flexShrink: 0 }}>
              관심종목 추가
            </button>

            {addMsg && <span style={{ fontSize: '12px', color: '#16a34a' }}>{addMsg}</span>}
          </>
        )}
      </div>

      {quote && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>현재가는 5초 주기로 갱신됩니다.</div>}
    </div>
  )
}
