function formatCap(v) {
  if (!v) return '-'
  const t = v / 1e12
  if (t >= 1) return `${t.toFixed(1)}조원`
  return `${Math.round(v / 1e8).toLocaleString()}억원`
}

export default function PeerComparison({ data }) {
  if (!data || data.length === 0) return <div style={{ color: '#64748b', fontSize: '13px' }}>비교 기업 데이터가 없습니다.</div>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            {['종목명', 'PER', 'PBR', '시가총액'].map((h) => (
              <th
                key={h}
                style={{
                  padding: '8px 12px',
                  background: '#f8fafc',
                  color: '#475569',
                  fontSize: '12px',
                  textAlign: h === '종목명' ? 'left' : 'right',
                  borderBottom: '1px solid #d7e1ee',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row) => (
            <tr key={row.stock_code} style={{ background: row.is_selected ? '#dcfce7' : 'transparent' }}>
              <td style={{ padding: '9px 12px', borderBottom: '1px solid #e2e8f0', color: row.is_selected ? '#166534' : '#0f172a', fontWeight: row.is_selected ? 700 : 400 }}>
                {row.stock_name}
                {row.is_selected && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#166534' }}>기준</span>}
              </td>
              {[row.per ? `${row.per}배` : '-', row.pbr ? `${row.pbr}배` : '-', formatCap(row.market_cap)].map((val, i) => (
                <td key={i} style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: row.is_selected ? '#166534' : '#0f172a' }}>
                  {val}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
