import { useEffect, useState, useCallback } from 'react'
import api from '../../services/api'
import { formatVolume } from '../../utils/format'

export default function Orderbook({ symbol, currentPrice, onPriceSelect, isMock = true }) {
  const [data,    setData]    = useState({ asks: [], bids: [] })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!symbol) return
    try {
      const res = await api.get(`/api/v1/market/orderbook?symbol=${symbol}&is_mock=${isMock}`)
      setData(res.data)
    } catch (e) {
      console.error('호가 로드 실패:', e)
    }
  }, [symbol, isMock])

  // 초기 로드
  useEffect(() => { load() }, [load, isMock])

  // 5초 폴링
  useEffect(() => {
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load, isMock])

  const asks = data.asks || []
  const bids = data.bids || []
  const maxAskVol = Math.max(...asks.map(a => a.volume), 1)
  const maxBidVol = Math.max(...bids.map(b => b.volume), 1)

  const rowStyle = {
    display: 'grid',
    gridTemplateColumns: '60px 1fr 52px',
    alignItems: 'center',
    gap: 4,
    padding: '3px 0',
    cursor: 'pointer',
    borderRadius: 4,
  }

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      borderRadius: 'var(--border-radius-md)',
      padding: '10px 12px',
      border: '0.5px solid var(--color-border-tertiary)',
      minWidth: 160,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
    }}>
      {/* 헤더 */}
      <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
        호가창
        {data.is_mock && <span style={{ marginLeft: 4, color: '#94a3b8', fontSize: 10 }}>mock</span>}
      </div>

      {/* 스크롤 영역: 매도 + 현재가 + 매수 */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {/* 매도 (역순: 5호가→1호가 위→아래) */}
        {[...asks].reverse().map((ask, i) => (
          <div
            key={`ask-${i}`}
            style={rowStyle}
            onClick={() => onPriceSelect?.(ask.price)}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: 11, fontWeight: 500, color: '#ef4444', textAlign: 'right' }}>
              {ask.price.toLocaleString()}
            </span>
            <div style={{ position: 'relative', height: 14, background: 'rgba(239,68,68,0.08)', borderRadius: 2 }}>
              <div style={{
                position: 'absolute', right: 0, top: 0, height: '100%',
                width: `${Math.round((ask.volume / maxAskVol) * 100)}%`,
                background: 'rgba(239,68,68,0.25)', borderRadius: 2,
              }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
              {formatVolume(ask.volume)}
            </span>
          </div>
        ))}

        {/* 현재가 중앙 표시 */}
        <div style={{
          textAlign: 'center', padding: '5px 0', margin: '3px 0',
          borderTop: '0.5px solid var(--color-border-tertiary)',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          fontSize: 13, fontWeight: 500, color: '#0F6E56',
        }}>
          {currentPrice ? currentPrice.toLocaleString() : '-'}
        </div>

        {/* 매수 (1호가→5호가 위→아래) */}
        {bids.map((bid, i) => (
          <div
            key={`bid-${i}`}
            style={rowStyle}
            onClick={() => onPriceSelect?.(bid.price)}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: 11, fontWeight: 500, color: '#3b82f6', textAlign: 'right' }}>
              {bid.price.toLocaleString()}
            </span>
            <div style={{ position: 'relative', height: 14, background: 'rgba(59,130,246,0.08)', borderRadius: 2 }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: `${Math.round((bid.volume / maxBidVol) * 100)}%`,
                background: 'rgba(59,130,246,0.25)', borderRadius: 2,
              }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
              {formatVolume(bid.volume)}
            </span>
          </div>
        ))}
      </div>

      {/* 푸터 */}
      <div style={{ flexShrink: 0, fontSize: 9, color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: 6 }}>
        클릭하면 주문가에 자동 입력됩니다
      </div>
    </div>
  )
}
