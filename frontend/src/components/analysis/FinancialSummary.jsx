function formatKRW(amount) {
  if (amount == null) return '-'
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}조원`
  if (abs >= 1e10) return `${sign}${Math.round(abs / 1e8).toLocaleString()}억원`
  return `${sign}${Math.round(abs / 1e8)}억원`
}

function YoY({ curr, prev }) {
  if (curr == null || prev == null || prev === 0) return null
  const rate = ((curr - prev) / Math.abs(prev)) * 100
  const up = rate >= 0
  return (
    <span style={{ fontSize: '11px', color: up ? '#16a34a' : '#dc2626', marginLeft: '4px' }}>
      {up ? '▲' : '▼'}{Math.abs(rate).toFixed(1)}%
    </span>
  )
}

const TH = ({ children }) => (
  <th style={{ padding: '8px 12px', background: '#f8fafc', color: '#475569', fontSize: '12px', textAlign: 'right', borderBottom: '1px solid #d7e1ee', whiteSpace: 'nowrap' }}>
    {children}
  </th>
)

const TD = ({ children, highlight }) => (
  <td style={{ padding: '8px 12px', fontSize: '13px', color: highlight ? '#16a34a' : '#0f172a', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
    {children}
  </td>
)

export default function FinancialSummary({ data }) {
  if (!data || data.length === 0) return <div style={{ color: '#64748b', fontSize: '13px' }}>재무 데이터가 없습니다.</div>

  const sorted = [...data].sort((a, b) => b.fiscal_year - a.fiscal_year)
  const [curr, prev] = sorted

  return (
    <div>
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #16a34a', background: '#dcfce7', color: '#166534', fontSize: '12px', cursor: 'default' }}>연결</button>
        <span style={{ fontSize: '11px', color: '#64748b' }}>최근 공시 기준</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              <TH>항목</TH>
              {sorted.map((r) => <TH key={r.fiscal_year}>{r.fiscal_year}년</TH>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <TD>매출액</TD>
              <TD>{formatKRW(curr?.revenue)}</TD>
              {prev && <TD>{formatKRW(prev?.revenue)}</TD>}
            </tr>
            <tr>
              <TD>영업이익</TD>
              <TD>{formatKRW(curr?.operating_profit)}{prev && <YoY curr={curr?.operating_profit} prev={prev?.operating_profit} />}</TD>
              {prev && <TD>{formatKRW(prev?.operating_profit)}</TD>}
            </tr>
            <tr>
              <TD>순이익</TD>
              <TD>{formatKRW(curr?.net_income)}{prev && <YoY curr={curr?.net_income} prev={prev?.net_income} />}</TD>
              {prev && <TD>{formatKRW(prev?.net_income)}</TD>}
            </tr>
            <tr>
              <TD>부채비율</TD>
              <TD>{curr?.debt_ratio != null ? `${curr.debt_ratio}%` : '-'}</TD>
              {prev && <TD>{prev?.debt_ratio != null ? `${prev.debt_ratio}%` : '-'}</TD>}
            </tr>
            <tr>
              <TD>ROE</TD>
              <TD highlight={curr?.roe >= 15}>{curr?.roe != null ? `${curr.roe}%` : '-'}</TD>
              {prev && <TD>{prev?.roe != null ? `${prev.roe}%` : '-'}</TD>}
            </tr>
            <tr>
              <TD>영업이익률</TD>
              <TD>{curr?.operating_margin != null ? `${curr.operating_margin}%` : '-'}</TD>
              {prev && <TD>{prev?.operating_margin != null ? `${prev.operating_margin}%` : '-'}</TD>}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
