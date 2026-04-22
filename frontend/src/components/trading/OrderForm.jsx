import { useEffect, useState } from 'react'
import api from '../../services/api'
import { useStockName } from '../../hooks/useStockName'

function formatKRW(v) {
  if (!v || Number.isNaN(v)) return '-'
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조원`
  if (v >= 1e8) return `${Math.round(v / 1e8).toLocaleString()}억원`
  return `${Math.round(v).toLocaleString()}원`
}

export default function OrderForm({ defaultSymbol = '', defaultPrice = null, currentPrice = 0, availableBalance = 0, onOrderDone }) {
  const [tab, setTab] = useState('buy')
  const [symbol, setSymbol] = useState(defaultSymbol)
  const [quantity, setQuantity] = useState('')
  const [priceType, setPriceType] = useState('market')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const companyName = useStockName(symbol)

  useEffect(() => {
    setSymbol(defaultSymbol)
  }, [defaultSymbol])

  useEffect(() => {
    if (defaultPrice && defaultPrice > 0) {
      setPriceType('limit')
      setPrice(String(defaultPrice))
    }
  }, [defaultPrice])

  const effectivePrice = priceType === 'limit' ? Number(price) || 0 : currentPrice || 0
  const estimatedTotal = effectivePrice > 0 && quantity > 0 ? effectivePrice * Number(quantity) : 0

  const calcQty = (ratio) => {
    if (!effectivePrice) return
    const qty = Math.floor((availableBalance * ratio) / effectivePrice)
    setQuantity(qty > 0 ? String(qty) : '0')
  }

  const handleOrder = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const body = {
        symbol: symbol.padStart(6, '0'),
        order_type: tab,
        quantity: Number(quantity),
        price: priceType === 'limit' ? Number(price) : null,
      }
      const { data } = await api.post('/api/v1/order', body)
      setResult(data)
      setQuantity('')
      onOrderDone?.()
    } catch (e2) {
      setError(e2.response?.data?.detail ?? '주문에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="mock-warning">현재 모의투자 모드입니다. 실제 주문은 체결되지 않습니다.</div>

      <div className="card-header"><span>주문</span></div>

      <div className="tab-row">
        <button type="button" className={`tab-btn buy ${tab === 'buy' ? 'active' : ''}`} onClick={() => setTab('buy')}>매수</button>
        <button type="button" className={`tab-btn sell ${tab === 'sell' ? 'active' : ''}`} onClick={() => setTab('sell')}>매도</button>
      </div>

      <form onSubmit={handleOrder} className="order-form">
        <div className="form-group">
          <label>종목코드</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="005930" maxLength={6} required />
            {companyName && <span style={{ fontSize: '13px', color: '#334155', whiteSpace: 'nowrap' }}>{companyName}</span>}
          </div>
        </div>

        <div className="form-group">
          <label>주문유형</label>
          <select value={priceType} onChange={(e) => { setPriceType(e.target.value); setPrice('') }}>
            <option value="market">시장가</option>
            <option value="limit">지정가</option>
          </select>
        </div>

        {priceType === 'limit' && (
          <div className="form-group">
            <label>가격(원)</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={currentPrice ? currentPrice.toLocaleString() : '0'} min="1" required />
          </div>
        )}

        <div className="form-group">
          <label>수량</label>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="1" min="1" required />
          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
            {[['10%', 0.1], ['25%', 0.25], ['50%', 0.5], ['최대', 1]].map(([label, ratio]) => (
              <button
                key={label}
                type="button"
                onClick={() => calcQty(ratio)}
                style={{ flex: 1, padding: '3px 0', fontSize: '11px', border: '1px solid #d7e1ee', borderRadius: '4px', background: '#f8fafc', color: '#334155', cursor: 'pointer' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid #e2e8f0', marginTop: '4px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>예상 체결금액</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: estimatedTotal > 0 ? '#0f172a' : '#94a3b8' }}>{estimatedTotal > 0 ? formatKRW(estimatedTotal) : '-'}</span>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {result && (
          <div className="order-result">
            <p>{result.message}</p>
            <p className="muted">주문번호: {result.order_id}</p>
          </div>
        )}

        <button type="submit" className={`btn-order ${tab}`} disabled={loading}>
          {loading ? '처리 중...' : tab === 'buy' ? '매수 주문' : '매도 주문'}
        </button>
      </form>
    </div>
  )
}
