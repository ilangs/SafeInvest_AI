import { useEffect, useState } from 'react'
import api from '../../services/api'
import CompanyOverview from './CompanyOverview'
import FinancialSummary from './FinancialSummary'
import PeerComparison from './PeerComparison'
import RiskBadge from './RiskBadge'

function SectionCard({ title, loading, children }) {
  return (
    <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #d7e1ee', padding: '20px' }}>
      <div style={{ fontWeight: 700, fontSize: '14px', color: '#334155', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </div>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[80, 60, 90].map((w, i) => (
            <div key={i} style={{ height: '14px', background: '#e2e8f0', borderRadius: '4px', width: `${w}%` }} />
          ))}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

export default function AnalysisDashboard({ stockCode }) {
  const [overview, setOverview] = useState(null)
  const [financials, setFinancials] = useState(null)
  const [peers, setPeers] = useState(null)
  const [risks, setRisks] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!stockCode) return
    setLoading(true)
    setError(null)

    Promise.all([
      api.get(`/api/v1/stock/${stockCode}/overview`),
      api.get(`/api/v1/stock/${stockCode}/financials`),
      api.get(`/api/v1/stock/${stockCode}/peers`),
      api.get(`/api/v1/stock/${stockCode}/risk`),
    ])
      .then(([ov, fin, peer, risk]) => {
        setOverview(ov.data)
        setFinancials(fin.data)
        setPeers(peer.data)
        setRisks(risk.data)
      })
      .catch(() => setError('기업 분석 데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [stockCode])

  if (error) {
    return (
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #d7e1ee', padding: '20px', color: '#334155', fontSize: '13px', textAlign: 'center' }}>
        {error}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
      <SectionCard title="Company Overview" loading={loading}>
        <CompanyOverview data={overview} />
      </SectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <SectionCard title="Financial Summary" loading={loading}>
          <FinancialSummary data={financials} />
        </SectionCard>
        <SectionCard title="Peer Comparison" loading={loading}>
          <PeerComparison data={peers} />
        </SectionCard>
      </div>

      <SectionCard title="Risk Flags" loading={loading}>
        <RiskBadge data={risks} />
      </SectionCard>
    </div>
  )
}
