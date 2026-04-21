import { useState } from 'react'
import api from '../../services/api'

export default function OrderForm({ defaultSymbol = '', onOrderDone }) {
  const [tab, setTab] = useState('buy')
  const [symbol, setSymbol] = useState(defaultSymbol)
  const [quantity, setQuantity] = useState('')
  const [priceType, setPriceType] = useState('market') // 'market' | 'limit'
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

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
      onOrderDone?.()
    } catch (e) {
      setError(e.response?.data?.detail ?? '주문 실패. 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="mock-warning">
        ⚠️ 현재 모의투자 모드입니다. 실제 돈이 사용되지 않습니다.
      </div>

      <div className="card-header">
        <span>📝 주문</span>
      </div>

      <div className="tab-row">
        <button type="button" className={`tab-btn buy ${tab === 'buy' ? 'active' : ''}`} onClick={() => setTab('buy')}>매수</button>
        <button type="button" className={`tab-btn sell ${tab === 'sell' ? 'active' : ''}`} onClick={() => setTab('sell')}>매도</button>
      </div>

      <form onSubmit={handleOrder} className="order-form">
        <div className="form-group">
          <label>종목코드</label>
          <input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="005930" maxLength={6} required />
        </div>
        <div className="form-group">
          <label>주문유형</label>
          <select value={priceType} onChange={e => setPriceType(e.target.value)}>
            <option value="market">시장가</option>
            <option value="limit">지정가</option>
          </select>
        </div>
        {priceType === 'limit' && (
          <div className="form-group">
            <label>가격 (원)</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" min="1" required />
          </div>
        )}
        <div className="form-group">
          <label>수량</label>
          <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="1" min="1" required />
        </div>

        {error && <div className="error-msg">{error}</div>}

        {result && (
          <div className="order-result">
            <p>✅ {result.message}</p>
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
