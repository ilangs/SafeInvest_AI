import ExplainBox from '../shared/ExplainBox.jsx'
import { warnKorean, warnDesc } from '../../../services/analysisApi.js'

export default function TabSafety({ score, warnings }) {
  const active   = (warnings ?? []).filter(w => w.is_active === 1)
  const inactive = (warnings ?? []).filter(w => w.is_active !== 1)

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>안전점검</h2>

      <ExplainBox
        title="안전점검이란?"
        body="이 탭은 재무 데이터 기반으로 확인된 <b>공식 위험 경고</b>를 보여줍니다. 경고가 있다면 투자 전 반드시 DART 전자공시를 직접 확인하세요."
        type="info"
      />

      <div className="an-grid-2" style={{ marginTop: 16 }}>
        <div className="an-metric-card" style={{ borderLeft: `4px solid ${active.length > 0 ? '#ef4444' : '#22c55e'}` }}>
          <div className="an-metric-label">활성 경고</div>
          <div className="an-metric-value" style={{ color: active.length > 0 ? '#ef4444' : '#22c55e' }}>
            {active.length}건
          </div>
        </div>
        <div className="an-metric-card" style={{ borderLeft: '4px solid #94a3b8' }}>
          <div className="an-metric-label">해제된 경고</div>
          <div className="an-metric-value" style={{ color: '#94a3b8' }}>{inactive.length}건</div>
        </div>
      </div>

      <h3 style={{ marginTop: 24, marginBottom: 12 }}>
        {active.length > 0 ? '🔴 활성 위험 경고' : '✅ 현재 활성 경고 없음'}
      </h3>

      {active.length === 0 ? (
        <ExplainBox
          title="경고 없음"
          body="현재 데이터 기준 활성화된 투자 경고가 없습니다. 경고가 없다고 해서 투자가 안전하다는 의미는 아닙니다."
          type="good"
        />
      ) : (
        active.map((w, i) => <WarnCard key={i} warn={w} active />)
      )}

      {inactive.length > 0 && (
        <>
          <h3 style={{ marginTop: 28, marginBottom: 12 }}>⬜ 해제된 경고 이력</h3>
          {inactive.map((w, i) => <WarnCard key={i} warn={w} active={false} />)}
        </>
      )}

      <hr className="an-hr" />
      <h3 style={{ marginBottom: 12 }}>📖 위험 유형 설명</h3>
      {[
        { type: 'CAPITAL_IMPAIRMENT', sev: '매우 심각', sevColor: '#ef4444',
          detail: '누적 손실이 자본금을 잠식한 상태입니다. 자본잠식률 50% 이상이면 관리종목 지정, 완전자본잠식이면 상장폐지 위험이 있습니다.' },
        { type: 'CONTINUOUS_LOSS', sev: '심각', sevColor: '#f97316',
          detail: '최근 3년 동안 계속 순손실이 발생했습니다. 사업 지속 가능성을 점검해야 합니다.' },
        { type: 'HIGH_DEBT', sev: '주의', sevColor: '#eab308',
          detail: '자본 대비 빚이 매우 큰 상태입니다. 금리 상승 시 이자 부담으로 경영이 어려워질 수 있습니다.' },
        { type: 'LOW_REVENUE', sev: '주의', sevColor: '#eab308',
          detail: '연간 매출이 작아 사업 안정성이 낮을 수 있습니다.' },
      ].map(({ type, sev, sevColor, detail }) => (
        <div key={type} className="an-glass-card" style={{ marginTop: 12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 800, color: '#dbeafe' }}>{warnKorean(type)}</span>
            <span style={{ color: sevColor, fontWeight: 700, fontSize: 13 }}>{sev}</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>{warnDesc(type)}</p>
          <p style={{ color: '#d9e2f2', fontSize: 14, marginTop: 6 }}>{detail}</p>
        </div>
      ))}
    </div>
  )
}

function WarnCard({ warn, active }) {
  const korean = warnKorean(warn.warning_type)
  const desc   = warnDesc(warn.warning_type)
  return (
    <div className={active ? 'an-warning-box' : 'an-easy-box'} style={{ marginTop: 10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 6 }}>
        <b>{active ? '🔴' : '⬜'} {korean}</b>
        <span style={{ fontSize: 12, color: active ? '#ffd0d0' : '#64748b' }}>
          {active ? '활성' : '해제'}
        </span>
      </div>
      <p style={{ fontSize: 14 }}>{desc}</p>
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
        {warn.start_date && <span>시작: {warn.start_date}</span>}
        {warn.end_date   && <span style={{ marginLeft: 12 }}>종료: {warn.end_date}</span>}
      </div>
    </div>
  )
}
