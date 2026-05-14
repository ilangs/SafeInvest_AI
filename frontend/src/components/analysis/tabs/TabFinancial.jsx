import PlotlyChart from '../shared/PlotlyChart.jsx'
import ExplainBox from '../shared/ExplainBox.jsx'
import Expander from '../shared/Expander.jsx'
import { fmtMoney, fmtRatio } from '../../../services/analysisApi.js'

export default function TabFinancial({ financials }) {
  if (!financials) return <div className="an-loading"><div className="an-spinner" /></div>

  const annual = financials.annual ?? []
  const quarterly = financials.quarterly ?? []

  if (annual.length === 0) {
    return (
      <div>
        <ExplainBox className="an-empty-warning" title="⚠️ 재무 데이터 확인 불가" body="우선주는 재무 데이터를 제공하지 않습니다." type="warning" />
      </div>
    )
  }

  const years = annual.map(r => r.fiscal_year)
  const revenue = annual.map(r => (r.revenue ?? 0) / 1e8)
  const opProfit = annual.map(r => (r.operating_profit ?? 0) / 1e8)
  const netProfit = annual.map(r => (r.net_income ?? 0) / 1e8)

  const baseLayout = (height) => ({
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    height,
    autosize: true,
    font: {
      color: '#111827',
      size: 12,
      family:
        'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    },
    margin: { l: 50, r: 8, t: 28, b: 32 },
    xaxis: {
      gridcolor: '#dfe9dd',
      zerolinecolor: '#dfe9dd',
      tickfont: { color: '#111827' },
      linecolor: '#cfdcc9',
    },
    yaxis: {
      gridcolor: '#dfe9dd',
      zerolinecolor: '#dfe9dd',
      tickfont: { color: '#111827' },
      linecolor: '#cfdcc9',
    },
    legend: {
      orientation: 'h',
      x: 0,
      y: 1.08,
      bgcolor: 'rgba(255,255,255,0)',
      font: { color: '#111827', size: 12 },
    },
    hoverlabel: {
      bgcolor: '#ffffff',
      bordercolor: '#d7e4d5',
      font: { color: '#111827' },
    },
  })

  const finData = [
    {
      type: 'bar',
      x: years,
      y: revenue,
      width: 0.5,
      name: '매출(억원)',
      marker: { color: 'rgba(47, 125, 79, 0.55)' },
    },
    {
      type: 'scatter',
      mode: 'lines+markers',
      x: years,
      y: opProfit,
      name: '영업이익(억원)',
      line: { color: '#e38b2c', width: 2 },
      marker: { size: 8 },
    },
    {
      type: 'scatter',
      mode: 'lines+markers',
      x: years,
      y: netProfit,
      name: '순이익(억원)',
      line: { color: '#6957ef', width: 1.8 },
      marker: { size: 8 },
    },
  ]

  const finLayout = baseLayout(560)

  const periods = quarterly.map(r => `${r.fiscal_year}-${r.fiscal_quarter}`)
  const debtRatio = quarterly.map(r => r.debt_ratio)

  const debtColors = debtRatio.map(v =>
    v == null ? '#94a3b8' : v < 200 ? '#4f8a57' : v < 500 ? '#d7b325' : '#d95c5c'
  )

  const debtData = [
    {
      type: 'scatter',
      mode: 'lines+markers',
      x: periods,
      y: debtRatio,
      name: '부채비율(%)',
      line: { color: '#2f7d4f', width: 2 },
      marker: { color: debtColors, size: 9 },
    },
  ]

  const debtLayout = {
    ...baseLayout(420),
    shapes: [
      {
        type: 'line',
        x0: periods[0],
        x1: periods[periods.length - 1],
        y0: 100,
        y1: 100,
        line: { color: '#4f8a57', dash: 'dot' },
      },
      {
        type: 'line',
        x0: periods[0],
        x1: periods[periods.length - 1],
        y0: 500,
        y1: 500,
        line: { color: '#d95c5c', dash: 'dot' },
      },
    ],
    annotations: [
      {
        x: periods[periods.length - 1],
        y: 100,
        text: '100%',
        showarrow: false,
        font: { color: '#4f8a57' },
        xanchor: 'right',
      },
      {
        x: periods[periods.length - 1],
        y: 500,
        text: '500%',
        showarrow: false,
        font: { color: '#d95c5c' },
        xanchor: 'right',
      },
    ],
  }

  const latest = annual[annual.length - 1]

  return (
    <div>
      {/* 라인형 탭 가이드 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginTop: 28,
          marginBottom: 33,
        }}
      >
        <div style={{ flex: 1, height: 1, background: '#d7e4d5' }} />
        <div
          style={{
            fontSize: 16,
            fontWeight: 590,
            color: '#3b3e43',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.03em',
          }}
        >
          아래 그래프는 연간 합산 기준입니다. 부채비율 차트는 분기별 기준입니다.
        </div>
        <div style={{ flex: 1, height: 1, background: '#d7e4d5' }} />
      </div>

      {/* 매출 / 영업이익 / 순이익 그래프 */}
      <div
        style={{
          width: '100%',
          background: 'transparent',
          padding: '0 4px',
          marginBottom: 24,
        }}
      >
        <PlotlyChart data={finData} layout={finLayout} />
      </div>

      {/* 부채비율 그래프 */}
      <div
        style={{
          width: '100%',
          background: 'transparent',
          padding: '0 4px',
          marginBottom: 30,
        }}
      >
        <PlotlyChart data={debtData} layout={debtLayout} />
      </div>

      {/* 연간 재무 요약 */}
      <div>
        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#111827',
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            letterSpacing: '-0.03em',
          }}
        >
          <img
            src="/logo-tab.png"
            alt="Ju-Dy"
            style={{ width: 24, height: 24, objectFit: 'contain' }}
          />
          연간 재무 요약
        </h3>

        <div
          style={{
            overflowX: 'auto',
            paddingBottom: 8,
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #d7e4d5',
            boxShadow: '0 10px 24px rgba(47, 95, 67, 0.08)',
          }}
        >
          <table className="an-data-table">
            <thead>
              <tr>
                <th>연도</th>
                <th>매출액</th>
                <th>영업이익</th>
                <th>순이익</th>
                <th>부채비율</th>
                <th>자기자본</th>
                <th>ROE</th>
              </tr>
            </thead>
            <tbody>
              {[...annual].reverse().map(r => (
                <tr key={r.fiscal_year}>
                  <td>{r.fiscal_year}</td>
                  <td>{fmtMoney(r.revenue)}</td>
                  <td style={{ color: r.operating_profit < 0 ? '#ef4444' : '#2f7d4f' }}>
                    {r.operating_profit > 0 ? '+' : ''}{fmtMoney(r.operating_profit)}
                  </td>
                  <td style={{ color: r.net_income < 0 ? '#ef4444' : '#2f7d4f' }}>
                    {r.net_income > 0 ? '+' : ''}{fmtMoney(r.net_income)}
                  </td>
                  <td>{fmtRatio(r.debt_ratio)}</td>
                  <td>{fmtMoney(r.total_equity)}</td>
                  <td style={{ color: (r.roe ?? 0) < 0 ? '#ef4444' : '#2f7d4f' }}>
                    {(r.roe ?? 0) > 0 ? '+' : ''}{fmtRatio(r.roe)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 재무 데이터 읽는 법 */}
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#111827',
          marginTop: 28,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          letterSpacing: '-0.03em',
        }}
      >
        <img
          src="/logo-tab.png"
          alt="Ju-Dy"
          style={{ width: 24, height: 24, objectFit: 'contain' }}
        />
        재무 데이터 읽는 법
      </h3>

      <Expander title="📊 매출액 — 이 기업은 얼마나 팔았나요?" defaultOpen>
        <FinExplainRevenue annual={annual} />
      </Expander>

      <Expander title="💰 영업이익 — 본업에서 실제로 얼마나 남겼나요?" defaultOpen>
        <FinExplainOpProfit annual={annual} />
      </Expander>

      <Expander title="🏦 부채비율 — 이 기업의 빚 부담은 얼마나 되나요?" defaultOpen>
        <FinExplainDebt latest={latest} />
      </Expander>

      <Expander title="💹 ROE — 주주 돈으로 얼마나 벌었나요?" defaultOpen>
        <FinExplainROE latest={latest} />
      </Expander>
    </div>
  )
}

function FinExplainRevenue({ annual }) {
  const sorted = [...annual].sort((a, b) => Number(a.year) - Number(b.year))
  let trend = '비교할 수 있는 연도 데이터가 부족합니다.'
  let detail = ''

  if (sorted.length >= 2) {
    const r0 = sorted[sorted.length - 1].revenue ?? 0
    const r1 = sorted[sorted.length - 2].revenue ?? 0

    if (r1 > 0) {
      const chg = ((r0 - r1) / r1) * 100

      if (chg > 20) {
        trend = `전년 대비 매출이 ${chg.toFixed(1)}% 크게 증가했습니다.`
        detail = '빠른 성장 신호입니다.'
      } else if (chg > 5) {
        trend = `전년 대비 매출이 ${chg.toFixed(1)}% 증가했습니다.`
        detail = '꾸준한 성장 흐름입니다.'
      } else if (chg >= 0) {
        trend = `전년 대비 매출이 ${chg.toFixed(1)}% 소폭 증가했습니다.`
        detail = '성장이 정체 수준입니다.'
      } else if (chg > -10) {
        trend = `전년 대비 매출이 ${Math.abs(chg).toFixed(1)}% 감소했습니다.`
        detail = '일시적인지 추세적인지 확인하세요.'
      } else {
        trend = `전년 대비 매출이 ${Math.abs(chg).toFixed(1)}% 크게 감소했습니다.`
        detail = '사업 경쟁력이 약화되고 있을 수 있습니다.'
      }
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
  let trend = '영업이익 데이터가 충분하지 않습니다.'
  let detail = ''

  if (sorted.length >= 2) {
    const o0 = sorted[sorted.length - 1].operating_profit ?? null
    const o1 = sorted[sorted.length - 2].operating_profit ?? null

    if (o0 != null && o1 != null) {
      if (o0 > 0 && o1 > 0) {
        const chg = ((o0 - o1) / Math.abs(o1)) * 100

        if (chg > 20) {
          trend = `영업이익이 전년 대비 ${chg.toFixed(1)}% 크게 증가했습니다.`
          detail = '본업 수익성이 빠르게 개선되고 있습니다.'
        } else if (chg > 0) {
          trend = `영업이익이 전년 대비 ${chg.toFixed(1)}% 증가했습니다.`
        } else {
          trend = `영업이익이 전년 대비 ${Math.abs(chg).toFixed(1)}% 감소했습니다.`
          detail = '수익성이 악화되고 있습니다.'
        }
      } else if (o0 <= 0 && o1 > 0) {
        trend = '흑자에서 영업손실로 전환되었습니다.'
        detail = '본업에서 손해가 나기 시작했습니다.'
      } else if (o0 <= 0 && o1 <= 0) {
        trend = '영업손실이 지속되고 있습니다.'
        detail = '본업에서 계속 손해를 보고 있습니다.'
      } else {
        trend = '영업손실에서 흑자로 전환되었습니다.'
        detail = '실적 개선 신호입니다.'
      }
    }
  }

  return (
    <>
      <p>매출에서 원가와 판관비를 뺀 금액. <b>본업을 통해 실제로 얼마나 남겼는지</b>를 보여줍니다.</p>
      <p style={{ marginTop: 8 }}>{trend}</p>
      {detail && <p>{detail}</p>}
      <table className="an-fin-guide-table" style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>영업이익률</th>
            <th>평가</th>
            <th>주요 업종</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>20% 이상</td>
            <td>매우 높음</td>
            <td>소프트웨어·바이오·플랫폼</td>
          </tr>
          <tr>
            <td>10~20%</td>
            <td>양호</td>
            <td>일반 제조업·화학</td>
          </tr>
          <tr>
            <td>5~10%</td>
            <td>보통</td>
            <td>자동차·건설·소비재</td>
          </tr>
          <tr>
            <td>5% 미만</td>
            <td>낮음</td>
            <td>유통·식품·물류</td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

function FinExplainDebt({ latest }) {
  const d = latest?.debt_ratio ?? null
  let status = '부채비율 데이터가 없습니다.'

  if (d != null) {
    if (d < 100) status = `부채비율 ${d.toFixed(1)}% — 매우 안전합니다.`
    else if (d < 200) status = `부채비율 ${d.toFixed(1)}% — 양호합니다.`
    else if (d < 400) status = `부채비율 ${d.toFixed(1)}% — 높은 편입니다.`
    else status = `부채비율 ${d.toFixed(1)}% — 매우 높습니다.`
  }

  return (
    <>
      <p>자기 돈(자본) 대비 빚(부채)이 얼마나 있는지를 나타냅니다.</p>
      <p style={{ marginTop: 8, fontWeight: 700 }}>{status}</p>
      <div className="an-warning-box" style={{ marginTop: 8 }}>
        📌 금융업(은행·보험·증권)은 수천 %가 정상입니다. 반드시 같은 업종과 비교하세요.
      </div>
    </>
  )
}

function FinExplainROE({ latest }) {
  const roe = latest?.roe ?? null
  let status = 'ROE 데이터가 없습니다.'

  if (roe != null) {
    if (roe >= 15) status = `ROE ${roe.toFixed(1)}% — 매우 우수합니다.`
    else if (roe >= 5) status = `ROE ${roe.toFixed(1)}% — 보통 수준입니다.`
    else if (roe >= 0) status = `ROE ${roe.toFixed(1)}% — 낮은 편입니다.`
    else status = `ROE ${roe.toFixed(1)}% — 순손실 상태입니다.`
  }

  return (
    <>
      <p>주주가 맡긴 돈(자기자본)으로 기업이 얼마의 순이익을 냈는지 보여줍니다.</p>
      <p style={{ marginTop: 8, fontWeight: 700 }}>{status}</p>
      <div className="an-warning-box" style={{ marginTop: 8 }}>
        📌 ROE는 부채를 많이 쓸수록 높아지는 구조적 함정이 있습니다. 반드시 부채비율과 함께 확인하세요.
      </div>
    </>
  )
}
