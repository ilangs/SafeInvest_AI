import { useState } from 'react'

const MARKET_COLOR = { KOSPI: '#2563eb', KOSDAQ: '#7c3aed' }

function MetricCard({ label, value, sub }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px 16px', border: '1px solid #d7e1ee', flex: '1 1 120px' }}>
      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{value ?? <span style={{ color: '#94a3b8' }}>-</span>}</div>
      {sub && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

export default function CompanyOverview({ data }) {
  const [expanded, setExpanded] = useState(false)
  if (!data) return null

  const summary = data.business_summary ?? ''
  const shortLength = 120
  const needsExpand = summary.length > shortLength
  const displaySummary = expanded || !needsExpand ? summary : `${summary.slice(0, shortLength)}...`

  const marketColor = MARKET_COLOR[data.market] || '#64748b'

  const formatCap = (v) => {
    if (!v) return '-'
    const trillion = v / 1e12
    if (trillion >= 1) return `${trillion.toFixed(1)}조원`
    return `${Math.round(v / 1e8).toLocaleString()}억원`
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <span style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{data.stock_name}</span>
        <span style={{ fontSize: '13px', color: '#64748b' }}>{data.stock_code}</span>
        {data.market && (
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: `${marketColor}22`, color: marketColor, border: `1px solid ${marketColor}44` }}>
            {data.market}
          </span>
        )}
        {data.sector && (
          <span style={{ fontSize: '12px', color: '#334155', background: '#f1f5f9', padding: '2px 8px', borderRadius: '999px', border: '1px solid #d7e1ee' }}>
            {data.sector}
          </span>
        )}
        {data.risk_count > 0 && (
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 700 }}>
            리스크 {data.risk_count}건
          </span>
        )}
      </div>

      {summary && (
        <div style={{ marginBottom: '16px', fontSize: '13px', color: '#334155', lineHeight: '1.7' }}>
          {displaySummary}
          {needsExpand && (
            <button onClick={() => setExpanded((v) => !v)} style={{ marginLeft: '6px', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '12px' }}>
              {expanded ? '접기' : '더보기'}
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <MetricCard label="PER" value={data.per ? `${data.per}배` : null} sub="주가 대비 이익" />
        <MetricCard label="PBR" value={data.pbr ? `${data.pbr}배` : null} sub="주가 대비 자산" />
        <MetricCard label="배당수익률" value={data.div_yield != null ? `${data.div_yield}%` : null} sub="연간 배당" />
        <MetricCard label="시가총액" value={formatCap(data.market_cap)} sub="현재 기업가치" />
      </div>
    </div>
  )
}
