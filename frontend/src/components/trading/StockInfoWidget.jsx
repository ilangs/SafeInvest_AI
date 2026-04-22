import { useEffect, useState } from 'react'
import api from '../../services/api'

function formatCap(v) {
  if (!v) return '-'
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조원`
  return `${Math.round(v / 1e8).toLocaleString()}억원`
}

function InfoRow({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
      <span style={{ fontSize: '12px', color: '#475569' }}>{label}</span>
      <span style={{ fontSize: '12px', fontWeight: 600, color: highlight ? '#16a34a' : '#0f172a' }}>{value}</span>
    </div>
  )
}

export default function StockInfoWidget({ symbol, currentPrice }) {
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setError('')

    api
      .get(`/api/v1/stock/${symbol}/overview`)
      .then((r) => {
        setOverview(r.data)
        setLoading(false)
      })
      .catch(() => {
        setError('데이터 조회 실패')
        setLoading(false)
      })
  }, [symbol])

  const high52 = overview?.week52_high ?? null
  const low52 = overview?.week52_low ?? null
  const show52 = high52 && low52 && high52 > low52
  const pct52 = show52 ? Math.max(0, Math.min(100, ((currentPrice - low52) / (high52 - low52)) * 100)) : null

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '6px', fontSize: '13px' }}>
        <span>투자 정보</span>
      </div>

      {loading && <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '12px 0' }}>로딩 중...</div>}
      {error && <div style={{ fontSize: '12px', color: '#ef4444' }}>{error}</div>}

      {overview && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <InfoRow label="시가총액" value={formatCap(overview.market_cap)} />
          <InfoRow label="PER" value={overview.per != null ? `${overview.per.toFixed(2)}배` : '-'} />
          <InfoRow label="PBR" value={overview.pbr != null ? `${overview.pbr.toFixed(2)}배` : '-'} />
          <InfoRow label="배당수익률" value={overview.div_yield != null ? `${overview.div_yield.toFixed(2)}%` : '-'} highlight={overview.div_yield > 0} />
          <InfoRow label="업종" value={overview.sector ?? '-'} />
          <InfoRow label="시장" value={overview.market ?? '-'} />

          {show52 ? (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>52주 범위</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
                <span>{low52.toLocaleString()}</span>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>{currentPrice ? currentPrice.toLocaleString() : '-'}</span>
                <span>{high52.toLocaleString()}</span>
              </div>
              <div style={{ position: 'relative', height: '6px', background: '#e2e8f0', borderRadius: '3px' }}>
                <div style={{ position: 'absolute', left: `${pct52}%`, transform: 'translateX(-50%)', width: '10px', height: '10px', background: '#f59e0b', borderRadius: '50%', top: '-2px' }} />
                <div style={{ width: `${pct52}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #f59e0b)', borderRadius: '3px' }} />
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'right', marginTop: '2px' }}>{pct52?.toFixed(0)}% 위치</div>
            </div>
          ) : (
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>52주 데이터 준비 중</div>
          )}
        </div>
      )}
    </div>
  )
}
