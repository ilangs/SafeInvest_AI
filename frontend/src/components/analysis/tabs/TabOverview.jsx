import PlotlyChart from '../shared/PlotlyChart.jsx'
import ExplainBox from '../shared/ExplainBox.jsx'
import Expander from '../shared/Expander.jsx'

export default function TabOverview({ score, financials, warnings }) {
  if (!score) return <div className="an-loading"><div className="an-spinner" /></div>

  const {
    final_score,
    capital_score,
    debt_score,
    profit_score,
    volume_score,
    revenue_score,
    raw_score,
    deduction,
    active_warning_count,
    grade,
    grade_color,
    notes,
  } = score

  const chartBlue = '#5f7fb5'
  const chartRed = '#b94b48'
  const textSub = '#64748b'
  const gridLine = 'rgba(100, 116, 139, 0.24)'

  const gaugeData = [{
    type: 'indicator',
    mode: 'gauge+number',
    value: final_score,
    number: {
      font: { size: 55, color: '#0dc423' },
      suffix: '점',
    },
    gauge: {
      axis: {
        range: [0, 100],
        tickcolor: textSub,
        tickfont: { color: '#475569', size: 12 },
      },
      bar: {
        color: '#37c647',
        thickness: 0.26,
      },
      borderwidth: 1,
      bordercolor: 'rgba(100, 116, 139, 0.35)',
      steps: [
        { range: [0, 25], color: '#ffb6b2' },
        { range: [25, 45], color: '#ffd1a6' },
        { range: [45, 65], color: '#ffe58a' },
        { range: [65, 80], color: '#bcd4ff' },
        { range: [80, 100], color: '#a3eaa3' },
      ],
    },
  }]

  const gaugeLayout = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: textSub },
    height: 300,
    margin: { l: 20, r: 40, t: 40, b: 20 },
    autosize: true,
  }

  const labels = ['자본건전성', '부채안정성', '수익성', '거래활성도', '매출규모']
  const maxes = [25, 20, 25, 15, 15]
  const vals = [
    capital_score / maxes[0] * 100,
    debt_score / maxes[1] * 100,
    profit_score / maxes[2] * 100,
    volume_score / maxes[3] * 100,
    revenue_score / maxes[4] * 100,
  ]

  const radarData = [{
    type: 'scatterpolar',
    r: [...vals, vals[0]],
    theta: [...labels, labels[0]],
    fill: 'toself',
    fillcolor: 'rgba(95,127,181,0.18)',
    line: { color: '#5f76b5', width: 3 },
    marker: {
      color: chartBlue,
      size: 5,
    },
  }]

  const radarLayout = {
    polar: {
      bgcolor: 'rgba(255,255,255,0)',
      radialaxis: {
        range: [0, 100],
        gridcolor: gridLine,
        linecolor: 'rgba(100, 116, 139, 0.35)',
        tickfont: { color: textSub, size: 11 },
      },
      angularaxis: {
        gridcolor: gridLine,
        linecolor: 'rgba(100, 116, 139, 0.35)',
        tickfont: { color: '#475569', size: 13 },
      },
    },
    paper_bgcolor: 'rgba(0,0,0,0)',
    font: { color: textSub },
    height: 380,
    margin: { l: 40, r: 40, t: 40, b: 40 },
  }

  const bars = [
    { title: '🏛️ 자본건전성', score: capital_score, max: 25 },
    { title: '🔒 부채안정성', score: debt_score, max: 20 },
    { title: '📶 거래활성도', score: volume_score, max: 15 },
    { title: '💰 수익성', score: profit_score, max: 25 },
    { title: '💼 매출규모', score: revenue_score, max: 15 },
    { title: '⛔ 감점', score: deduction, max: 30 },
  ]

  const annual = financials?.annual ?? []
  const latest = annual.length ? annual[annual.length - 1] : null
  const prev = annual.length >= 2 ? annual[annual.length - 2] : null

  const roe_val = latest?.roe ?? null
  const debt_val = latest?.debt_ratio ?? null
  const op_margin =
    latest?.operating_profit != null && latest?.revenue > 0
      ? latest.operating_profit / latest.revenue * 100
      : null
  const rev_chg =
    latest?.revenue && prev?.revenue && prev.revenue !== 0
      ? (latest.revenue - prev.revenue) / prev.revenue * 100
      : null

  return (
    <div>
      <div className="an-grid-2">
        <div>
          <p style={{ fontWeight: 800, color: '#3b3e43', marginBottom: 4, marginTop: 20, textAlign: 'center', fontSize: 18, letterSpacing: '-0.005em' }}>
            안전점수 게이지
          </p>
          <PlotlyChart data={gaugeData} layout={gaugeLayout} />
        </div>
        <div>
          <p style={{ fontWeight: 800, color: '#3b3e43', marginBottom: 4, marginTop: 20, textAlign: 'center', fontSize: 18, letterSpacing: '-0.005em' }}>
            5대 항목 레이더
          </p>
          <PlotlyChart data={radarData} layout={radarLayout} />
        </div>
      </div>

      <div style={{ marginTop: 24, marginBottom: 35, width: '90%', marginLeft: 'auto', marginRight: 'auto' }}>
        {bars.map(({ title, score: s, max }) => (
          <ProgressBar key={title} title={title} score={s} max={max} />
        ))}
      </div>

      <ExplainBox
        className="an-guide-box"
        style={{ marginBottom: 35 }}
        title="✅ 투자 전 참고사항"
        body="최종 점수는 공개된 재무 데이터를 기계적으로 합산한 <b>참고 수치</b>입니다. 점수가 높다고 반드시 좋은 투자처이거나, 낮다고 나쁜 기업이 아닙니다."
        type="info"
      />

      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#111827',
          marginTop: 24,
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
          style={{
            width: 24,
            height: 24,
            objectFit: 'contain',
          }}
        />
        항목별 상세 해설
      </h3>

      <Expander title="🏛️ 자본건전성 — 이 기업의 자본은 안정적인가요?" defaultOpen>
        <ScoreDetailCapital capitalScore={capital_score} />
      </Expander>

      <Expander title="🔒 부채안정성 — 이 기업은 빚 부담이 큰가요?" defaultOpen>
        <ScoreDetailDebt debt={debt_val} debtScore={debt_score} />
      </Expander>

      <Expander title="📶 거래활성도 — 이 종목은 거래가 충분한가요?" defaultOpen>
        <ScoreDetailVolume score={volume_score} />
      </Expander>

      <Expander title="💰 수익성 — 이 기업은 돈을 잘 벌고 있나요?" defaultOpen>
        <ScoreDetailProfitability roe={roe_val} margin={op_margin} score={profit_score} />
      </Expander>

      <Expander title="💼 매출규모 — 이 기업의 매출 규모는 충분한가요?" defaultOpen>
        <ScoreDetailRevenue revChg={rev_chg} score={revenue_score} />
      </Expander>

      <Expander title="⛔ 감점 — 공식 위험 신호가 있나요?" defaultOpen>
        <ScoreDetailWarnings count={active_warning_count} deduction={deduction} notes={notes} />
      </Expander>
    </div>
  )
}

function ProgressBar({ title, score, max }) {
  const ratio = Math.max(0, Math.min(1, score / max))
  const color =
    ratio >= .8 ? '#399f39'
  : ratio >= .6 ? '#5d8fe6'
  : ratio >= .45 ? '#e8bf37'
  : ratio >= .25 ? '#d45f57'
  : '#de9448'

  return (
    <div className="an-progress-wrap">
      <div className="an-progress-header">
        <span>{title}</span>
        <span>{score.toFixed(1)} / {max}</span>
      </div>
      <div className="an-progress-track">
        <div className="an-progress-fill" style={{ width: `${ratio * 100}%`, background: color }} />
      </div>
    </div>
  )
}

function ScoreDetailCapital({ capitalScore }) {
  const score = Math.round(capitalScore)

  let icon = '⚪'
  let text = '자본건전성 데이터를 확인할 수 없습니다.'

  if (capitalScore >= 20) {
    icon = '🟢'
    text = '자본 상태가 안정적인 편입니다.'
  } else if (capitalScore >= 12) {
    icon = '🟡'
    text = '자본 상태는 중립 수준입니다. 추가 확인이 필요합니다.'
  } else if (capitalScore > 0) {
    icon = '🟠'
    text = '자본 안정성이 낮은 편입니다.'
  } else {
    icon = '🔴'
    text = '자본잠식 가능성이 있어 반드시 공시를 확인해야 합니다.'
  }

  return (
    <>
      <p>자본건전성은 기업의 자기자본이 충분한지, 자본잠식 위험이 있는지를 확인하는 항목입니다.</p>
      <p style={{ marginTop: 8 }}><b>자본건전성 점수: {score}점</b></p>
      <p style={{ marginTop: 8 }}>{icon} {text}</p>
      <div className="an-warning-box" style={{ marginTop: 8 }}>
        📌 자본잠식은 상장폐지 위험과 연결될 수 있으므로, 점수가 낮다면 반드시 재무제표와 공시를 함께 확인하세요.
      </div>
    </>
  )
}

function ScoreDetailDebt({ debt, debtScore }) {
  let icon = '⚪'
  let text = '부채비율 데이터가 없습니다.'

  if (debt != null) {
    if (debt < 100) {
      icon = '🟢'
      text = `부채비율 ${debt.toFixed(1)}% — 매우 안전합니다.`
    } else if (debt < 200) {
      icon = '🟡'
      text = `부채비율 ${debt.toFixed(1)}% — 양호합니다.`
    } else if (debt < 400) {
      icon = '🟠'
      text = `부채비율 ${debt.toFixed(1)}% — 주의가 필요합니다.`
    } else {
      icon = '🔴'
      text = `부채비율 ${debt.toFixed(1)}% — 매우 높습니다.`
    }
  }

  return (
    <>
      <p>부채안정성은 기업이 자본 대비 얼마나 많은 빚을 가지고 있는지 확인하는 항목입니다.</p>
      <p style={{ marginTop: 8 }}><b>부채안정성 점수: {Math.round(debtScore)}점</b></p>
      <p style={{ marginTop: 8 }}>{icon} {text}</p>
      <div className="an-warning-box" style={{ marginTop: 8 }}>
        📌 금융업(은행·보험·증권)은 수천 %가 정상입니다. 반드시 같은 업종과 비교하세요.
      </div>
    </>
  )
}

function ScoreDetailVolume({ score }) {
  const rounded = Math.round(score)

  let icon = '⚪'
  let text = '거래활성도 데이터를 확인할 수 없습니다.'

  if (score >= 12) {
    icon = '🟢'
    text = '거래가 활발한 편입니다.'
  } else if (score >= 6) {
    icon = '🟡'
    text = '거래량이 보통 수준입니다.'
  } else if (score > 0) {
    icon = '🟠'
    text = '거래량이 적은 편입니다.'
  } else {
    icon = '🔴'
    text = '거래가 매우 부진할 수 있습니다.'
  }

  return (
    <>
      <p>거래활성도는 해당 종목이 시장에서 얼마나 활발하게 거래되는지를 보여줍니다.</p>
      <p style={{ marginTop: 8 }}><b>거래활성도 점수: {rounded}점</b></p>
      <p style={{ marginTop: 8 }}>{icon} {text}</p>
      <div className="an-warning-box" style={{ marginTop: 8 }}>
        📌 거래량이 너무 적은 종목은 원하는 가격에 사고팔기 어려울 수 있습니다.
      </div>
    </>
  )
}

function ScoreDetailProfitability({ roe, margin, score }) {
  let roeIcon = '⚪'
  let roeText = 'ROE 데이터가 없습니다.'

  if (roe != null) {
    if (roe >= 15) {
      roeIcon = '🟢'
      roeText = `ROE ${roe.toFixed(1)}% — 매우 우수합니다.`
    } else if (roe >= 5) {
      roeIcon = '🟡'
      roeText = `ROE ${roe.toFixed(1)}% — 보통 수준입니다.`
    } else if (roe >= 0) {
      roeIcon = '🟠'
      roeText = `ROE ${roe.toFixed(1)}% — 낮은 편입니다.`
    } else {
      roeIcon = '🔴'
      roeText = `ROE ${roe.toFixed(1)}% — 순손실 상태입니다.`
    }
  }

  let marginText = ''
  if (margin != null) {
    if (margin >= 20) marginText = `영업이익률 ${margin.toFixed(1)}% — 매우 높은 수익성입니다.`
    else if (margin >= 10) marginText = `영업이익률 ${margin.toFixed(1)}% — 양호한 수익성입니다.`
    else if (margin >= 0) marginText = `영업이익률 ${margin.toFixed(1)}% — 낮은 편입니다.`
    else marginText = `영업이익률 ${margin.toFixed(1)}% — 영업손실 상태입니다.`
  }

  return (
    <>
      <p>수익성은 기업이 가진 자원으로 얼마나 효율적으로 이익을 내는지를 나타냅니다.</p>
      <p style={{ marginTop: 8 }}><b>수익성 점수: {Math.round(score)}점</b></p>
      <p style={{ marginTop: 8 }}>{roeIcon} {roeText}</p>
      {marginText && <p>➡️ {marginText}</p>}
      <div className="an-warning-box" style={{ marginTop: 8 }}>
        📌 ROE가 높아도 부채를 많이 써서 인위적으로 높인 경우가 있습니다. 반드시 부채비율과 함께 확인하세요.
      </div>
    </>
  )
}

function ScoreDetailRevenue({ revChg, score }) {
  let icon = '⚪'
  let text = '매출 비교 데이터가 부족합니다.'

  if (revChg != null) {
    if (revChg >= 20) {
      icon = '🟢'
      text = `최근 매출 성장률 ${revChg.toFixed(1)}% — 빠르게 성장하고 있습니다.`
    } else if (revChg >= 5) {
      icon = '🟡'
      text = `최근 매출 성장률 ${revChg.toFixed(1)}% — 완만하게 성장 중입니다.`
    } else if (revChg >= 0) {
      icon = '🟠'
      text = `최근 매출 성장률 ${revChg.toFixed(1)}% — 성장이 정체되고 있습니다.`
    } else {
      icon = '🔴'
      text = `최근 매출 성장률 ${revChg.toFixed(1)}% — 매출이 줄고 있습니다.`
    }
  }

  return (
    <>
      <p>매출규모는 기업의 사업 규모가 어느 정도인지 확인하는 항목입니다.</p>
      <p style={{ marginTop: 8 }}><b>매출규모 점수: {Math.round(score)}점</b></p>
      <p style={{ marginTop: 8 }}>{icon} {text}</p>
      <div className="an-warning-box" style={{ marginTop: 8 }}>
        📌 매출 규모가 작거나 줄어드는 기업은 사업 안정성이 낮을 수 있으므로, 업종 특성과 함께 확인하세요.
      </div>
    </>
  )
}

function ScoreDetailWarnings({ count, deduction, notes }) {
  let icon = '⚪'
  let text = ''

  if (count === 0) {
    icon = '🟢'
    text = '현재 공식 투자 경고가 없습니다.'
  } else if (count === 1) {
    icon = '🟠'
    text = `${count}건의 투자 경고가 있습니다. 안전점검 탭에서 반드시 확인하세요.`
  } else {
    icon = '🔴'
    text = `${count}건의 복합 투자 경고가 있습니다. 안전점검 탭을 반드시 확인하세요.`
  }

  return (
    <>
      <p>감점은 재무적 위험 신호가 감지될 때 원점수에서 차감되는 항목입니다.</p>
      <p style={{ marginTop: 8 }}><b>경고 현황: {count}건 / 감점: -{Math.round(deduction)}점</b></p>
      <p style={{ marginTop: 8 }}>{icon} {text}</p>
      {notes?.length > 0 && (
        <ul style={{ marginTop: 8, marginLeft: 18 }}>
          {notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </>
  )
}
