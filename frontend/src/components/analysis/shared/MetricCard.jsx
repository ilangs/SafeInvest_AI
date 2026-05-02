export default function MetricCard({ title, value, help, accent = '#3b82f6' }) {
  return (
    <div className="an-metric-card" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="an-metric-label">{title}</div>
      <div className="an-metric-value">{value}</div>
      {help && <div className="an-metric-help">{help}</div>}
    </div>
  )
}
