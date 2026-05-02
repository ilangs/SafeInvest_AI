import PlotlyChart from '../shared/PlotlyChart.jsx'
import ExplainBox  from '../shared/ExplainBox.jsx'
import Expander    from '../shared/Expander.jsx'
import { getGrade, fmtRatio, fmtMoney } from '../../../services/analysisApi.js'

export default function TabOverview({ score, financials, warnings }) {
  if (!score) return <div className="an-loading"><div className="an-spinner"/></div>

  const { final_score, capital_score, debt_score, profit_score, volume_score, revenue_score,
          raw_score, deduction, active_warning_count, grade, grade_color, notes } = score

  const gaugeData = [{
    type: 'indicator', mode: 'gauge+number', value: final_score,
    number: { font: { size: 52, color: grade_color }, suffix: '점' },
    gauge: {
      axis: { range: [0, 100], tickcolor: '#dbeafe' },
      bar: { color: grade_color, thickness: 0.28 },
      steps: [
        { range: [0,25],   color: 'rgba(239,68,68,.22)'  },
        { range: [25,45],  color: 'rgba(249,115,22,.22)' },
        { range: [45,65],  color: 'rgba(234,179,8,.22)'  },
        { range: [65,80],  color: 'rgba(59,130,246,.22)' },
        { range: [80,100], color: 'rgba(34,197,94,.22)'  },
      ],
    },
  }]
  const gaugeLayout = {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#dbeafe' }, height: 300,
    margin: { l: 20, r: 20, t: 40, b: 20 },
  }

  const labels = ['자본건전성','부채안정성','수익성','거래활성도','매출규모']
  const maxes  = [25, 20, 25, 15, 15]
  const vals   = [capital_score/maxes[0]*100, debt_score/maxes[1]*100,
                  profit_score/maxes[2]*100, volume_score/maxes[3]*100, revenue_score/maxes[4]*100]
  const radarData = [{
    type: 'scatterpolar', r: [...vals, vals[0]], theta: [...labels, labels[0]],
    fill: 'toself', fillcolor: 'rgba(110,231,255,0.12)',
    line: { color: '#6ee7ff', width: 3 },
  }]
  const radarLayout = {
    polar: {
      bgcolor: 'rgba(18,24,41,0.55)',
      radialaxis: { range:[0,100], gridcolor:'rgba(255,255,255,0.08)', tickfont:{ color:'#9cb0d3', size:11 } },
      angularaxis: { gridcolor:'rgba(255,255,255,0.08)', tickfont:{ color:'#dbeafe', size:13 } },
    },
    paper_bgcolor: 'rgba(0,0,0,0)', font: { color: '#dbeafe' },
    height: 380, margin: { l: 40, r: 40, t: 40, b: 40 },
  }

  const bars = [
    { title:'💰 자본건전성', score:capital_score, max:25 },
    { title:'🛡️ 부채안정성', score:debt_score,   max:20 },
    { title:'📈 수익성',     score:profit_score,  max:25 },
    { title:'📊 거래활성도', score:volume_score,  max:15 },
    { title:'💼 매출규모',   score:revenue_score, max:15 },
  ]

  const annual = financials?.annual ?? []
  const latest = annual.length ? annual[annual.length - 1] : null
  const prev   = annual.length >= 2 ? annual[annual.length - 2] : null

  const roe_val   = latest?.roe ?? null
  const debt_val  = latest?.debt_ratio ?? null
  const op_margin = (latest?.operating_profit != null && latest?.revenue > 0)
                      ? latest.operating_profit / latest.revenue * 100 : null
  const rev_chg   = (latest?.revenue && prev?.revenue && prev.revenue !== 0)
                      ? (latest.revenue - prev.revenue) / prev.revenue * 100 : null

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>종합진단</h2>

      <div className="an-grid-2">
        <div>
          <p style={{ fontWeight: 800, color: '#93c5fd', marginBottom: 4, textAlign:'center' }}>안전점수 게이지</p>
          <PlotlyChart data={gaugeData} layout={gaugeLayout} />
        </div>
        <div>
          <p style={{ fontWeight: 800, color: '#93c5fd', marginBottom: 4, textAlign:'center' }}>5대 항목 레이더</p>
          <PlotlyChart data={radarData} layout={radarLayout} />
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        {bars.map(({ title, score: s, max }) => <ProgressBar key={title} title={title} score={s} max={max} />)}
      </div>

      <hr className="an-hr" />
      <h3 style={{ marginBottom: 12 }}>🔍 이 점수는 어떻게 계산되었나요?</h3>
      <ExplainBox
        title="⚠️ 먼저 읽어주세요"
        body="아래 점수는 공개된 재무 데이터를 기계적으로 합산한 <b>참고 수치</b>입니다. 점수가 높다고 반드시 좋은 투자처이거나, 낮다고 나쁜 기업이 아닙니다."
        type="info"
      />

      <div className="an-grid-5" style={{ marginTop: 16 }}>
        {[
          { label:'💰 수익성',      val: profit_score  },
          { label:'🛡️ 안전성',     val: debt_score    },
          { label:'🏗️ 자본건전성', val: capital_score },
          { label:'📈 성장성',      val: revenue_score },
          { label:'📉 감점',        val: -deduction, red: true },
        ].map(({ label, val, red }) => (
          <div key={label} className="an-metric-card" style={{ borderLeft: `4px solid ${red ? '#ef4444' : '#3b82f6'}` }}>
            <div className="an-metric-label">{label}</div>
            <div className="an-metric-value" style={{ fontSize: 26, color: red ? '#ef4444' : '#f8fbff' }}>
              {red ? val : `${val}점`}
            </div>
          </div>
        ))}
      </div>
      <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 10 }}>
        최종 점수: <b style={{ color: grade_color }}>{Math.round(final_score)}점</b>
        &nbsp;(원점수 {Math.round(raw_score)}점 - 감점 {Math.round(deduction)}점) | 등급: <b>{grade}</b>
      </p>

      <h3 style={{ marginTop: 24, marginBottom: 8 }}>📖 항목별 상세 해설</h3>

      <Expander title="💰 수익성 점수 — 이 기업은 돈을 잘 벌고 있나요?" defaultOpen>
        <ScoreDetailProfitability roe={roe_val} margin={op_margin} score={profit_score} />
      </Expander>
      <Expander title="🛡️ 안전성 점수 — 이 기업은 빚이 얼마나 있나요?" defaultOpen>
        <ScoreDetailSafety debt={debt_val} capitalScore={capital_score} debtScore={debt_score} />
      </Expander>
      <Expander title="📈 성장성 점수 — 이 기업은 점점 커지고 있나요?" defaultOpen>
        <ScoreDetailGrowth revChg={rev_chg} score={revenue_score} />
      </Expander>
      <Expander title="⚠️ 감점 및 경고 항목 — 공식 위험 신호가 있나요?" defaultOpen>
        <ScoreDetailWarnings count={active_warning_count} deduction={deduction} notes={notes} />
      </Expander>
    </div>
  )
}

function ProgressBar({ title, score, max }) {
  const ratio = Math.max(0, Math.min(1, score / max))
  const color = ratio >= .8 ? '#22c55e' : ratio >= .6 ? '#3b82f6' : ratio >= .45 ? '#eab308' : ratio >= .25 ? '#f97316' : '#ef4444'
  return (
    <div className="an-progress-wrap">
      <div className="an-progress-header">
        <span>{title}</span><span>{score.toFixed(1)} / {max}</span>
      </div>
      <div className="an-progress-track">
        <div className="an-progress-fill" style={{ width: `${ratio * 100}%`, background: color }} />
      </div>
    </div>
  )
}

function ScoreDetailProfitability({ roe, margin, score }) {
  let roeIcon = '⚪', roeText = 'ROE 데이터가 없습니다.'
  if (roe != null) {
    if (roe >= 15)     { roeIcon='🟢'; roeText=`ROE ${roe.toFixed(1)}% — 매우 우수합니다.` }
    else if (roe >= 5) { roeIcon='🟡'; roeText=`ROE ${roe.toFixed(1)}% — 보통 수준입니다.` }
    else if (roe >= 0) { roeIcon='🟠'; roeText=`ROE ${roe.toFixed(1)}% — 낮은 편입니다.` }
    else               { roeIcon='🔴'; roeText=`ROE ${roe.toFixed(1)}% — 순손실 상태입니다.` }
  }
  let marginText = ''
  if (margin != null) {
    if (margin >= 20)      marginText = `영업이익률 ${margin.toFixed(1)}% — 매우 높은 수익성입니다.`
    else if (margin >= 10) marginText = `영업이익률 ${margin.toFixed(1)}% — 양호한 수익성입니다.`
    else if (margin >= 0)  marginText = `영업이익률 ${margin.toFixed(1)}% — 낮은 편입니다.`
    else                   marginText = `영업이익률 ${margin.toFixed(1)}% — 영업손실 상태입니다.`
  }
  return (
    <>
      <p>수익성은 기업이 가진 자원으로 얼마나 효율적으로 이익을 내는지를 나타냅니다.</p>
      <p style={{ marginTop: 8 }}><b>이 종목의 수익성 점수: {Math.round(score)}점</b></p>
      <p style={{ marginTop: 8 }}>{roeIcon} {roeText}</p>
      {marginText && <p>📊 {marginText}</p>}
      <div className="an-warning-box" style={{ marginTop: 8 }}>ROE가 높아도 부채를 많이 써서 인위적으로 높인 경우가 있습니다. 반드시 부채비율과 함께 확인하세요.</div>
    </>
  )
}

function ScoreDetailSafety({ debt, capitalScore, debtScore }) {
  let icon = '⚪', text = '부채비율 데이터가 없습니다.'
  if (capitalScore === 0) { icon='🔴'; text='자본잠식 상태입니다. 상장폐지 위험이 있으니 반드시 공시를 확인하세요.' }
  else if (debt != null) {
    if (debt < 100)      { icon='🟢'; text=`부채비율 ${debt.toFixed(1)}% — 매우 안전합니다.` }
    else if (debt < 200) { icon='🟡'; text=`부채비율 ${debt.toFixed(1)}% — 양호합니다.` }
    else if (debt < 400) { icon='🟠'; text=`부채비율 ${debt.toFixed(1)}% — 주의가 필요합니다.` }
    else                 { icon='🔴'; text=`부채비율 ${debt.toFixed(1)}% — 매우 높습니다.` }
  }
  return (
    <>
      <p>안전성은 기업이 재정적으로 얼마나 안정적인지를 측정합니다.</p>
      <p style={{ marginTop: 8 }}><b>안전성: {Math.round(debtScore)}점 / 자본건전성: {Math.round(capitalScore)}점</b></p>
      <p style={{ marginTop: 8 }}>{icon} {text}</p>
      <div className="an-warning-box" style={{ marginTop: 8 }}>⚠️ 금융업(은행·보험·증권)은 수천 %가 정상입니다. 반드시 같은 업종과 비교하세요.</div>
    </>
  )
}

function ScoreDetailGrowth({ revChg, score }) {
  let icon = '⚪', text = '성장률 비교 데이터가 부족합니다.'
  if (revChg != null) {
    if (revChg >= 20)     { icon='🟢'; text=`최근 매출 성장률 ${revChg.toFixed(1)}% — 빠르게 성장하고 있습니다.` }
    else if (revChg >= 5) { icon='🟡'; text=`최근 매출 성장률 ${revChg.toFixed(1)}% — 완만하게 성장 중입니다.` }
    else if (revChg >= 0) { icon='🟠'; text=`최근 매출 성장률 ${revChg.toFixed(1)}% — 성장이 정체되고 있습니다.` }
    else                  { icon='🔴'; text=`최근 매출 성장률 ${revChg.toFixed(1)}% — 매출이 줄고 있습니다.` }
  }
  return (
    <>
      <p>성장성은 기업의 매출과 이익이 시간이 지남에 따라 커지고 있는지를 측정합니다.</p>
      <p style={{ marginTop: 8 }}><b>성장성 점수: {Math.round(score)}점</b></p>
      <p style={{ marginTop: 8 }}>{icon} {text}</p>
      <div className="an-warning-box" style={{ marginTop: 8 }}>⚠️ 성장성이 높은 기업은 주가에 이미 높은 기대가 반영된 경우가 많습니다.</div>
    </>
  )
}

function ScoreDetailWarnings({ count, deduction, notes }) {
  let icon = '⚪', text = ''
  if (count === 0)     { icon='🟢'; text='현재 공식 투자 경고가 없습니다.' }
  else if (count === 1){ icon='🟠'; text=`${count}건의 투자 경고가 있습니다. 안전점검 탭에서 반드시 확인하세요.` }
  else                 { icon='🔴'; text=`${count}건의 복합 투자 경고가 있습니다. 안전점검 탭을 반드시 확인하세요.` }
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
