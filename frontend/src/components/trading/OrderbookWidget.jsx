import api from '../../services/api'
import { usePolling } from '../../hooks/usePolling'

function volumeBar(vol, maxVol, side) {
  const pct = maxVol > 0 ? Math.round((vol / maxVol) * 100) : 0
  const color = side === 'ask' ? 'rgba(239,68,68,0.35)' : 'rgba(59,130,246,0.35)'
  return <div style={{ width: `${pct}%`, maxWidth: '60px', minWidth: '4px', height: '14px', background: color, borderRadius: '2px', flexShrink: 0 }} />
}

export default function OrderbookWidget({ symbol, onPriceSelect }) {
  const { data, loading, error } = usePolling(() => api.get(`/api/v1/market/orderbook?symbol=${symbol}`).then((r) => r.data), 5000)

  const asks = data?.asks ?? []
  const bids = data?.bids ?? []
  const maxAskVol = asks.reduce((m, a) => Math.max(m, a.volume), 1)
  const maxBidVol = bids.reduce((m, b) => Math.max(m, b.volume), 1)

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 6px',
    cursor: 'pointer',
    borderRadius: '3px',
  }

  return (
    <div className="card" style={{ padding: '8px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '4px', fontSize: '13px' }}>
        <span>호가창</span>
        {data?.is_mock && <span style={{ fontSize: '10px', color: '#64748b' }}>mock</span>}
      </div>

      {loading && !data && <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '12px 0' }}>로딩 중...</div>}
      {error && <div style={{ color: '#ef4444', fontSize: '12px' }}>조회 실패</div>}

      {data && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '0 6px', marginBottom: '2px' }}>
            <span style={{ fontSize: '10px', color: '#475569', minWidth: '60px', textAlign: 'right' }}>잔량</span>
            <span style={{ fontSize: '10px', color: '#475569', flex: 1, textAlign: 'center' }}>호가</span>
            <span style={{ fontSize: '10px', color: '#475569', minWidth: '60px', textAlign: 'right' }}>잔량</span>
          </div>

          {[...asks].reverse().map((ask, idx) => (
            <div
              key={`ask-${idx}`}
              style={rowStyle}
              onClick={() => onPriceSelect?.(ask.price)}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>{volumeBar(ask.volume, maxAskVol, 'ask')}</div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#ef4444', minWidth: '70px', textAlign: 'right', flexShrink: 0 }}>{ask.price.toLocaleString()}</div>
              <div style={{ fontSize: '11px', color: '#475569', minWidth: '56px', textAlign: 'right', flexShrink: 0 }}>{ask.volume.toLocaleString()}</div>
            </div>
          ))}

          <div style={{ textAlign: 'center', fontSize: '11px', color: '#334155', background: '#f1f5f9', padding: '2px 0', borderRadius: '3px', margin: '2px 0', letterSpacing: '1px' }}>
            매도 / 매수
          </div>

          {bids.map((bid, idx) => (
            <div
              key={`bid-${idx}`}
              style={rowStyle}
              onClick={() => onPriceSelect?.(bid.price)}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ fontSize: '11px', color: '#475569', minWidth: '56px', textAlign: 'left', flexShrink: 0 }}>{bid.volume.toLocaleString()}</div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#3b82f6', minWidth: '70px', textAlign: 'right', flexShrink: 0 }}>{bid.price.toLocaleString()}</div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>{volumeBar(bid.volume, maxBidVol, 'bid')}</div>
            </div>
          ))}

          <div style={{ fontSize: '10px', color: '#475569', marginTop: 'auto', paddingTop: '4px', textAlign: 'right' }}>5초 자동 갱신</div>
        </div>
      )}
    </div>
  )
}
