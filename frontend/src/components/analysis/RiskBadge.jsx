const SEVERITY_CONFIG = {
  high: { color: '#dc2626', bg: '#fee2e2', border: '#fecaca', icon: '■', label: 'HIGH' },
  medium: { color: '#ea580c', bg: '#ffedd5', border: '#fed7aa', icon: '●', label: 'MEDIUM' },
  low: { color: '#ca8a04', bg: '#fef3c7', border: '#fde68a', icon: '▲', label: 'LOW' },
}

export default function RiskBadge({ data }) {
  if (!data) return null

  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>✓</span>
        <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '14px' }}>특이 리스크 없음</span>
        <span style={{ color: '#475569', fontSize: '12px' }}>현재 수집된 리스크 신호가 없습니다.</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {data.map((flag, i) => {
        const cfg = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.low
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderRadius: '8px', background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            <span style={{ fontSize: '14px', flexShrink: 0 }}>{cfg.icon}</span>
            <div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600 }}>{flag.flag_type}</span>
              </div>
              {flag.flag_detail && <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>{flag.flag_detail}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
