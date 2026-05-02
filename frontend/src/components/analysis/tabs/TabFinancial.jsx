import PlotlyChart from '../shared/PlotlyChart.jsx'
import ExplainBox  from '../shared/ExplainBox.jsx'
import Expander    from '../shared/Expander.jsx'
import { darkLayout, fmtMoney, fmtRatio } from '../../../services/analysisApi.js'

export default function TabFinancial({ financials }) {
  if (!financials) return <div className="an-loading"><div className="an-spinner"/></div>

  const annual    = financials.annual    ?? []
  const quarterly = financials.quarterly ?? []

  if (annual.length === 0) {
    return (
      <div>
        <h2 style={{ marginBottom: 16 }}>재무분석</h2>
        <ExplainBox title="데이터 없음" body="재무 데이터가 없습니다." type="warning" />
      </div>
    )
  }

  const years    = annual.map(r => r.year)
  const revenue  = annual.map(r => (r.revenue ?? 0) / 1e8)
  const opProfit = annual.map(r => (r.operating_profit ?? 0) / 1e8)
  const netProfit= annual.map(r => (r.net_profit ?? 0) / 1e8)

  const finData = [
    { type:'bar', x:years, y:revenue,   name:'매출(억원)', marker:{ color:'rgba(59,130,246,0.7)' } },
    { type:'scatter', mode:'lines+markers', x:years, y:opProfit,  name:'영업이익(억원)', line:{ color:'#22c55e', width:3 }, marker:{ size:8 } },
    { type:'scatter', mode:'lines+markers', x:years, y:netProfit, name:'순이익(억원)',   line:{ color:'#f59e0b', width:3 }, marker:{ size:8 } },
  ]
  const finLayout = darkLayout('매출 / 영업이익 / 순이익 추이', 440)

  const periods   = quarterly.map(r => `${r.year}-${r.quarter}`)
  const debtRatio = quarterly.map(r => r.debt_ratio)
  const debtColors = debtRatio.map(v => v == null ? '#94a3b8' : v < 200 ? '#22c55e' : v < 500 ? '#eab308' : '#ef4444')
  const debtData = [{
    type:'scatter', mode:'lines+markers',
    x:periods, y:debtRatio, name:'부채비율(%)',
    line:{ color:'#6ee7ff', width:3 },
    marker:{ color:debtColors, size:9 },
  }]
  const debtLayout = {
    ...darkLayout('부채비율 추이', 360),
    shapes: [
      { type:'line', x0:periods[0], x1:periods[periods.length-1], y0:100, y1:100, line:{ color:'#22c55e', dash:'dot' } },
      { type:'line', x0:periods[0], x1:periods[periods.length-1], y0:500, y1:500, line:{ color:'#ef4444', dash:'dot' } },
    ],
    annotations: [
      { x:periods[periods.length-1], y:100, text:'100%', showarrow:false, font:{ color:'#22c55e' }, xanchor:'right' },
      { x:periods[periods.length-1], y:500, text:'500%', showarrow:false, font:{ color:'#ef4444' }, xanchor:'right' },
    ],
  }

  const latest = annual[annual.length - 1]

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>재무분석</h2>
      <ExplainBox
        title="재무분석 안내"
        body="아래 그래프는 연간 합산 기준입니다. 금액 단위는 억원입니다. 부채비율 차트는 분기별 기준입니다."
        type="info"
      />

      <div style={{ marginTop: 20 }}>
        <PlotlyChart data={finData} layout={finLayout} />
      </div>
      <div style={{ marginTop: 20 }}>
        <PlotlyChart data={debtData} layout={debtLayout} />
      </div>

      <h3 style={{ marginTop: 24, marginBottom: 12 }}>연간 재무 요약</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="an-data-table">
          <thead>
            <tr>
              <th>연도</th><th>매출액</th><th>영업이익</th><th>순이익</th>
              <th>부채비율</th><th>자기자본</th><th>ROE</th>
            </tr>
          </thead>
          <tbody>
            {[...annual].reverse().map(r => (
              <tr key={r.year}>
                <td>{r.year}</td>
                <td>{fmtMoney(r.revenue)}</td>
                <td style={{ color: r.operating_profit < 0 ? '#ef4444' : '#22c55e' }}>{fmtMoney(r.operating_profit)}</td>
                <td style={{ color: r.net_profit < 0 ? '#ef4444' : '#22c55e' }}>{fmtMoney(r.net_profit)}</td>
                <td>{fmtRatio(r.debt_ratio)}</td>
                <td>{fmtMoney(r.total_equity)}</td>
                <td style={{ color: (r.roe ?? 0) < 0 ? '#ef4444' : '#d9e2f2' }}>{fmtRatio(r.roe)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <hr className="an-hr" />
      <h3 style={{ marginBottom: 8 }}>📖 재무 데이터 읽는 법</h3>

      <Expander title="📊 매출액 — 이 기업은 얼마나 팔았나요?" defaultOpen>
        <FinExplainRevenue annual={annual} />
      </Expander>

      <Expander title="💼 영업이익 — 본업에서 실제로 얼마나 남겼나요?" defaultOpen>
        <FinExplainOpProfit annual={annual} />
      </Expander>

      <Expander title="🏦 부채비율 — 이 기업의 빚 부담은 얼마나 되나요?" defaultOpen>
        <FinExplainDebt latest={latest} />
      </Expander>

      <Expander title="💡 ROE — 주주 돈으로 얼마나 벌었나요?" defaultOpen>
        <FinExplainROE latest={latest} />
      </Expander>
    </div>
  )
}

function FinExplainRevenue({ annual }) {
  const sorted = [...annual].sort((a, b) => Number(a.year) - Number(b.year))
  let trend = '비교할 수 있는 연도 데이터가 부족합니다.', detail = ''
  if (sorted.length >= 2) {
    const r0 = sorted[sorted.length-1].revenue ?? 0
    const r1 = sorted[sorted.length-2].revenue ?? 0
    if (r1 > 0) {
      const chg = (r0 - r1) / r1 * 100
      if (chg > 20)       { trend = `📗 전년 대비 매출이 ${chg.toFixed(1)}% 크게 증가했습니다.`;  detail = '빠른 성장 신호입니다.' }
      else if (chg > 5)   { trend = `📗 전년 대비 매출이 ${chg.toFixed(1)}% 증가했습니다.`;      detail = '꾸준한 성장 흐름입니다.' }
      else if (chg >= 0)  { trend = `🟡 전년 대비 매출이 ${chg.toFixed(1)}% 소폭 증가했습니다.`; detail = '성장이 정체 수준입니다.' }
      else if (chg > -10) { trend = `🟠 전년 대비 매출이 ${Math.abs(chg).toFixed(1)}% 감소했습니다.`; detail = '일시적인지 추세적인지 확인하세요.' }
      else                { trend = `🔴 전년 대비 매출이 ${Math.abs(chg).toFixed(1)}% 크게 감소했습니다.`; detail = '사업 경쟁력이 약화되고 있을 수 있습니다.' }
    }
  }
  return (
    <>
      <p>기업이 제품이나 서비스를 팔아서 벌어들인 <b>총수입금액</b>입니다.</p>
      <p style={{ marginTop: 8 }}>{trend}</p>
      {detail && <p>{detail}</p>}
      <ul style={{ marginTop: 10 }}>
        <li>3년 이상 꾸준히 증가하고 있나요?</li>
        <li>영업이익도 함께 증가하고 있나요?</li>
        <li>매출이 갑자기 크게 늘었다면 일회성 요인일 수 있습니다.</li>
      </ul>
    </>
  )
}

function FinExplainOpProfit({ annual }) {
  const sorted = [...annual].sort((a, b) => Number(a.year) - Number(b.year))
  let trend = '영업이익 데이터가 충분하지 않습니다.', detail = ''
  if (sorted.length >= 2) {
    const o0 = sorted[sorted.length-1].operating_profit ?? null
    const o1 = sorted[sorted.length-2].operating_profit ?? null
    if (o0 != null && o1 != null) {
      if (o0 > 0 && o1 > 0) {
        const chg = (o0 - o1) / Math.abs(o1) * 100
        if (chg > 20)  { trend = `📗 영업이익이 전년 대비 ${chg.toFixed(1)}% 크게 증가했습니다.`; detail = '본업 수익성이 빠르게 개선되고 있습니다.' }
        else if (chg>0){ trend = `📗 영업이익이 전년 대비 ${chg.toFixed(1)}% 증가했습니다.` }
        else           { trend = `🟠 영업이익이 전년 대비 ${Math.abs(chg).toFixed(1)}% 감소했습니다.`; detail = '수익성이 악화되고 있습니다.' }
      } else if (o0 <= 0 && o1 > 0) {
        trend='🔴 흑자에서 영업손실로 전환되었습니다.'; detail='본업에서 손해가 나기 시작했습니다.'
      } else if (o0 <= 0 && o1 <= 0) {
        trend='🔴 영업손실이 지속되고 있습니다.'; detail='본업에서 계속 손해를 보고 있습니다.'
      } else {
        trend='📗 영업손실에서 흑자로 전환되었습니다.'; detail='실적 개선 신호입니다.'
      }
    }
  }
  return (
    <>
      <p>매출에서 원가와 판관비를 뺀 금액. <b>본업을 통해 실제로 얼마나 남겼는지</b>를 보여줍니다.</p>
      <p style={{ marginTop: 8 }}>{trend}</p>
      {detail && <p>{detail}</p>}
      <table style={{ marginTop: 10 }}>
        <thead><tr><th>영업이익률</th><th>평가</th><th>주요 업종</th></tr></thead>
        <tbody>
          <tr><td>20% 이상</td><td>매우 높음</td><td>소프트웨어·바이오·플랫폼</td></tr>
          <tr><td>10~20%</td><td>양호</td><td>일반 제조업·화학</td></tr>
          <tr><td>5~10%</td><td>보통</td><td>자동차·건설·소비재</td></tr>
          <tr><td>5% 미만</td><td>낮음</td><td>유통·식품·물류</td></tr>
        </tbody>
      </table>
    </>
  )
}

function FinExplainDebt({ latest }) {
  const d = latest?.debt_ratio ?? null
  let status = '⚪ 부채비율 데이터가 없습니다.'
  if (d != null) {
    if (d < 100)      status = `🟢 부채비율 ${d.toFixed(1)}% — 매우 안전합니다.`
    else if (d < 200) status = `🟡 부채비율 ${d.toFixed(1)}% — 양호합니다.`
    else if (d < 400) status = `🟠 부채비율 ${d.toFixed(1)}% — 높은 편입니다.`
    else              status = `🔴 부채비율 ${d.toFixed(1)}% — 매우 높습니다.`
  }
  return (
    <>
      <p>자기 돈(자본) 대비 빚(부채)이 얼마나 있는지를 나타냅니다.</p>
      <p style={{ marginTop: 8, fontWeight: 700 }}>{status}</p>
      <div className="an-warning-box" style={{ marginTop: 8 }}>⚠️ 금융업(은행·보험·증권)은 수천 %가 정상입니다. 반드시 같은 업종과 비교하세요.</div>
    </>
  )
}

function FinExplainROE({ latest }) {
  const roe = latest?.roe ?? null
  let status = '⚪ ROE 데이터가 없습니다.'
  if (roe != null) {
    if (roe >= 15)      status = `🟢 ROE ${roe.toFixed(1)}% — 매우 우수합니다.`
    else if (roe >= 5)  status = `🟡 ROE ${roe.toFixed(1)}% — 보통 수준입니다.`
    else if (roe >= 0)  status = `🟠 ROE ${roe.toFixed(1)}% — 낮은 편입니다.`
    else                status = `🔴 ROE ${roe.toFixed(1)}% — 순손실 상태입니다.`
  }
  return (
    <>
      <p>주주가 맡긴 돈(자기자본)으로 기업이 얼마의 순이익을 냈는지 보여줍니다.</p>
      <p style={{ marginTop: 8, fontWeight: 700 }}>{status}</p>
      <div className="an-warning-box" style={{ marginTop: 8 }}>⚠️ ROE는 부채를 많이 쓸수록 높아지는 구조적 함정이 있습니다. 반드시 부채비율과 함께 확인하세요.</div>
    </>
  )
}
