import { useState, useEffect } from 'react'
import api from '../../services/api'
import { formatKRW } from '../../utils/format'

export default function OrderForm({ symbol, currentPrice, defaultPrice, onOrderComplete, isMock = true }) {
  const [tab,       setTab]       = useState('buy')
  const [orderType, setOrderType] = useState('limit')
  const [price,     setPrice]     = useState('')
  const [quantity,  setQuantity]  = useState('')
  const [balance,   setBalance]   = useState(0)
  const [loading,   setLoading]   = useState(false)
  const [message,   setMessage]   = useState('')

  // 호가 클릭 시 가격 자동 입력
  useEffect(() => {
    if (defaultPrice) {
      setPrice(defaultPrice.toString())
      setOrderType('limit')
    }
  }, [defaultPrice])

  // 잔고 로드
  useEffect(() => {
    api.get(`/api/v1/account/balance?is_mock=${isMock}`)
      .then(res => setBalance(res.data.available || 0))
      .catch(() => {})
  }, [isMock])

  // 수량 비율 버튼
  const calcQty = (pct) => {
    const p = parseInt(price) || currentPrice || 1
    const qty = Math.floor((balance * pct) / p)
    setQuantity(qty > 0 ? qty.toString() : '0')
  }

  // 예상 체결금액
  const estimated = (() => {
    const p = orderType === 'market' ? (currentPrice || 0) : (parseInt(price) || 0)
    const q = parseInt(quantity) || 0
    return p * q
  })()

  const handleSubmit = async () => {
    if (!symbol || !quantity || parseInt(quantity) <= 0) {
      setMessage('종목코드와 수량을 확인해 주세요.')
      return
    }
    if (orderType === 'limit' && (!price || parseInt(price) <= 0)) {
      setMessage('지정가를 입력해 주세요.')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const body = {
        symbol,
        order_type: tab,
        quantity:   parseInt(quantity),
        price:      orderType === 'market' ? null : parseInt(price),
        is_mock:    isMock,
      }
      const res = await api.post('/api/v1/order', body)
      setMessage(`✅ ${res.data.message || '주문이 접수되었습니다.'}`)
      setQuantity('')
      onOrderComplete?.()
    } catch (e) {
      setMessage(`❌ ${e.response?.data?.detail || '주문 실패. 다시 시도해 주세요.'}`)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-md)',
    padding: '6px 10px',
    fontSize: 13,
    color: 'var(--color-text-primary)',
    outline: 'none',
  }

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      borderRadius: 'var(--border-radius-md)',
      padding: '12px',
      border: '0.5px solid var(--color-border-tertiary)',
    }}>
      {/* 모의투자 배너 */}
      <div style={{
        background: '#E1F5EE', borderRadius: 4,
        padding: '4px 8px', fontSize: 11, color: '#0F6E56',
        marginBottom: 10,
      }}>
        ⚠️ 모의투자 모드 — 실제 돈이 사용되지 않습니다
      </div>

      {/* 매수/매도 탭 */}
      <div style={{
        display: 'flex', borderRadius: 'var(--border-radius-md)',
        overflow: 'hidden', border: '0.5px solid var(--color-border-secondary)',
        marginBottom: 12,
      }}>
        <button
          onClick={() => setTab('buy')}
          style={{
            flex: 1, padding: '7px', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', border: 'none',
            background: tab === 'buy' ? '#ef4444' : 'transparent',
            color: tab === 'buy' ? '#fff' : 'var(--color-text-secondary)',
          }}
        >매수</button>
        <button
          onClick={() => setTab('sell')}
          style={{
            flex: 1, padding: '7px', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', border: 'none',
            borderLeft: '0.5px solid var(--color-border-secondary)',
            background: tab === 'sell' ? '#3b82f6' : 'transparent',
            color: tab === 'sell' ? '#fff' : 'var(--color-text-secondary)',
          }}
        >매도</button>
      </div>

      {/* 종목 (읽기 전용) */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 3 }}>종목코드</div>
        <div style={{ ...inputStyle, color: 'var(--color-text-secondary)' }}>
          {symbol || '종목을 선택하세요'}
        </div>
      </div>

      {/* 주문유형 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 3 }}>주문유형</div>
        <select
          value={orderType}
          onChange={e => setOrderType(e.target.value)}
          style={inputStyle}
        >
          <option value="limit">지정가</option>
          <option value="market">시장가</option>
        </select>
      </div>

      {/* 가격 (지정가만) */}
      {orderType === 'limit' && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 3 }}>
            주문가격
            {defaultPrice && (
              <span style={{ color: '#0F6E56', marginLeft: 4, fontSize: 10 }}>호가 반영됨</span>
            )}
          </div>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="가격 입력"
            style={inputStyle}
          />
        </div>
      )}

      {/* 수량 + 비율 버튼 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 3 }}>수량</div>
        <input
          type="number"
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          placeholder="수량 입력"
          style={inputStyle}
          min="1"
        />
        <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
          {[0.1, 0.25, 0.5, 1].map(pct => (
            <button
              key={pct}
              onClick={() => calcQty(pct)}
              style={{
                flex: 1, padding: '4px', fontSize: 11, cursor: 'pointer',
                background: pct === 1 ? '#E1F5EE' : 'var(--color-background-secondary)',
                color:      pct === 1 ? '#0F6E56' : 'var(--color-text-secondary)',
                border:     `0.5px solid ${pct === 1 ? '#9FE1CB' : 'var(--color-border-secondary)'}`,
                borderRadius: 4,
              }}
            >
              {pct === 1 ? '최대' : `${pct * 100}%`}
            </button>
          ))}
        </div>
      </div>

      {/* 예상 체결금액 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 12, marginBottom: 10,
        padding: '6px 0', borderTop: '0.5px solid var(--color-border-tertiary)',
      }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>예상 체결금액</span>
        <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {formatKRW(estimated)}
        </span>
      </div>

      {/* 주문 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          width: '100%', padding: '9px', fontSize: 14, fontWeight: 500,
          background: tab === 'buy' ? '#ef4444' : '#3b82f6',
          color: '#fff', border: 'none',
          borderRadius: 'var(--border-radius-md)',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? '처리 중...' : `${tab === 'buy' ? '매수' : '매도'} 주문`}
      </button>

      {/* 결과 메시지 */}
      {message && (
        <div style={{
          marginTop: 8, fontSize: 12, textAlign: 'center',
          color: message.startsWith('✅') ? '#0F6E56' : '#ef4444',
        }}>
          {message}
        </div>
      )}
    </div>
  )
}
