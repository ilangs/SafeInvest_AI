import PlotlyChart from '../shared/PlotlyChart.jsx'
import ExplainBox  from '../shared/ExplainBox.jsx'
import Expander    from '../shared/Expander.jsx'
import { fmtPrice } from '../../../services/analysisApi.js'

export default function TabTechnical({ prices }) {
  if (!prices?.length || prices.length < 35) return (
    <div>
      <h2 style={{ marginBottom: 16 }}>기술적분석</h2>
      <ExplainBox title="데이터 부족" body="기술지표 계산에 필요한 데이터가 부족합니다 (최소 35일 필요)." type="warning" />
    </div>
  )

  const dates = prices.map(p => p.date)
  const close = prices.map(p => p.close)
  const bbU   = prices.map(p => p.bb_upper)
  const ma20  = prices.map(p => p.ma20)
  const bbL   = prices.map(p => p.bb_lower)
  const rsi   = prices.map(p => p.rsi)
  const macd  = prices.map(p => p.macd)
  const sig   = prices.map(p => p.macd_signal)
  const hist  = prices.map(p => p.macd_hist)
  const histColors = hist.map(v => (v ?? 0) >= 0 ? '#22c55e' : '#ef4444')

  const techData = [
    { type:'scatter', mode:'lines', x:dates, y:close, name:'종가',    line:{ color:'#dbeafe', width:2 }, yaxis:'y' },
    { type:'scatter', mode:'lines', x:dates, y:bbU,   name:'BB상단', line:{ color:'#22c55e', width:1, dash:'dot' }, yaxis:'y' },
    { type:'scatter', mode:'lines', x:dates, y:ma20,  name:'BB중심', line:{ color:'#f59e0b', width:1, dash:'dot' }, yaxis:'y' },
    { type:'scatter', mode:'lines', x:dates, y:bbL,   name:'BB하단', line:{ color:'#ef4444', width:1, dash:'dot' }, yaxis:'y' },
    { type:'scatter', mode:'lines', x:dates, y:rsi,   name:'RSI',    line:{ color:'#a78bfa', width:2 }, yaxis:'y2' },
    { type:'bar',     x:dates, y:hist,  name:'Hist',   marker:{ color:histColors }, yaxis:'y3' },
    { type:'scatter', mode:'lines', x:dates, y:macd,  name:'MACD',   line:{ color:'#6ee7ff', width:2 }, yaxis:'y3' },
    { type:'scatter', mode:'lines', x:dates, y:sig,   name:'Signal', line:{ color:'#f59e0b', width:2 }, yaxis:'y3' },
  ]

  const techLayout = {
    paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(18,24,41,0.55)',
    font:{ color:'#dbeafe', size:12 }, height:880,
    margin:{ l:52, r:20, t:60, b:40 },
    title:{ text:'기술적 분석 (볼린저밴드 / RSI / MACD)', font:{ size:18, color:'#dbeafe' } },
    grid:{ rows:3, columns:1, pattern:'independent' },
    xaxis:  { gridcolor:'rgba(255,255,255,0.07)', domain:[0,1], anchor:'y'  },
    xaxis2: { gridcolor:'rgba(255,255,255,0.07)', domain:[0,1], anchor:'y2', matches:'x' },
    xaxis3: { gridcolor:'rgba(255,255,255,0.07)', domain:[0,1], anchor:'y3', matches:'x' },
    yaxis:  { gridcolor:'rgba(255,255,255,0.07)', domain:[0.55,1],   title:'종가+BB' },
    yaxis2: { gridcolor:'rgba(255,255,255,0.07)', domain:[0.30,0.52], title:'RSI' },
    yaxis3: { gridcolor:'rgba(255,255,255,0.07)', domain:[0,0.27],   title:'MACD' },
    shapes: [
      { type:'line', x0:dates[0], x1:dates[dates.length-1], y0:70, y1:70, yref:'y2', line:{ color:'#ef4444', dash:'dot' } },
      { type:'line', x0:dates[0], x1:dates[dates.length-1], y0:30, y1:30, yref:'y2', line:{ color:'#22c55e', dash:'dot' } },
    ],
    legend:{ bgcolor:'rgba(0,0,0,0)' },
  }

  const latest      = prices[prices.length - 1]
  const lastRSI     = latest?.rsi
  const lastMACD    = latest?.macd
  const lastMACDSig = latest?.macd_signal
  const lastClose   = latest?.close
  const lastBBU     = latest?.bb_upper
  const lastBBL     = latest?.bb_lower
  const lastMA20    = latest?.ma20
  const lastMA60    = prices.find(p => p.ma60 != null) ? prices[prices.length - 1]?.ma60 : null

  let rsiMsg = null, rsiType = 'info'
  if (lastRSI != null) {
    if (lastRSI >= 70)     { rsiMsg = `현재 RSI: <b>${lastRSI.toFixed(1)}</b> — 과매수 구간. 단기 조정 가능성에 유의하세요.`;          rsiType='warning' }
    else if (lastRSI <= 30){ rsiMsg = `현재 RSI: <b>${lastRSI.toFixed(1)}</b> — 과매도 구간. 반등 가능성이 있으나 확인이 필요합니다.`; rsiType='info'    }
    else                   { rsiMsg = `현재 RSI: <b>${lastRSI.toFixed(1)}</b> — 중립 구간입니다.`;                                     rsiType='good'    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>기술적분석</h2>
      <ExplainBox
        title="기술적 분석이란?"
        body="볼린저밴드·RSI·MACD는 보조 지표로, 과열·과냉·추세 전환 신호를 읽는 데 씁니다. <b>단독으로 매수·매도 결정을 내리지 마세요.</b>"
        type="info"
      />

      <div style={{ marginTop: 20 }}>
        <PlotlyChart data={techData} layout={techLayout} />
      </div>

      {rsiMsg && <ExplainBox title="RSI 해석" body={rsiMsg} type={rsiType} />}

      <hr className="an-hr" />
      <h3 style={{ marginBottom: 8 }}>📖 기술적 지표 상세 해설</h3>
      <div className="an-warning-box">
        <b>⚠️ 기술적 분석의 한계를 먼저 이해하세요</b><br />
        기술적 분석은 <b>과거</b> 주가와 거래량 데이터를 분석하는 방법입니다. 과거 패턴이 미래에도 반복된다는 가정을 전제하지만, 이것이 항상 맞지는 않습니다. 기술적 지표는 매수·매도 타이밍의 <b>참고 자료</b>일 뿐입니다.
      </div>

      <Expander title="📉 이동평균선(MA) — 주가의 흐름을 부드럽게 보여줍니다" defaultOpen>
        <MAExplain close={lastClose} ma20={lastMA20} ma60={lastMA60} />
      </Expander>

      <Expander title="📊 RSI — 지금 이 주식이 과열됐나요, 침체됐나요?" defaultOpen>
        <RSIExplain rsi={lastRSI} />
      </Expander>

      <Expander title="📈 MACD — 추세의 방향과 강도를 동시에 보여줍니다" defaultOpen>
        <MACDExplain macd={lastMACD} signal={lastMACDSig} />
      </Expander>

      <Expander title="🎯 볼린저밴드 — 주가의 정상 움직임 범위를 보여줍니다" defaultOpen>
        <BBExplain close={lastClose} upper={lastBBU} lower={lastBBL} />
      </Expander>
    </div>
  )
}

function MAExplain({ close, ma20, ma60 }) {
  let closeComment = '', alignComment = ''
  if (close != null && ma20 != null) {
    closeComment = close > ma20
      ? `📗 현재가(${fmtPrice(close)})가 20일 이동평균(${fmtPrice(ma20)}) 위에 있습니다 — 단기 상승 흐름.`
      : `📕 현재가(${fmtPrice(close)})가 20일 이동평균(${fmtPrice(ma20)}) 아래에 있습니다 — 단기 하락 압력.`
  }
  if (ma20 != null && ma60 != null) {
    alignComment = ma20 > ma60
      ? '📗 20일선이 60일선 위에 있습니다 (정배열) — 중단기 상승 추세.'
      : '📕 20일선이 60일선 아래에 있습니다 (역배열) — 중단기 하락 추세.'
  }
  return (
    <>
      <p>일정 기간 동안 주가를 평균 내어 <b>부드러운 추세선</b>으로 만든 것입니다.</p>
      {closeComment && <p style={{ marginTop: 8 }}>{closeComment}</p>}
      {alignComment && <p>{alignComment}</p>}
      <table style={{ marginTop: 12 }}>
        <thead><tr><th>이동평균선</th><th>기간</th><th>의미</th></tr></thead>
        <tbody>
          <tr><td>MA5</td><td>5거래일</td><td>초단기 흐름</td></tr>
          <tr><td>MA20</td><td>1개월</td><td>단기 추세</td></tr>
          <tr><td>MA60</td><td>3개월</td><td>중기 추세</td></tr>
        </tbody>
      </table>
      <div className="an-warning-box" style={{ marginTop: 8 }}>⚠️ 이동평균선은 <b>후행(lagging) 지표</b>입니다. 이미 주가가 크게 움직인 다음에 신호가 나타나는 경우가 많습니다.</div>
    </>
  )
}

function RSIExplain({ rsi }) {
  let status = '⚪ RSI 데이터를 불러올 수 없습니다.', detail = ''
  if (rsi != null) {
    if (rsi >= 70)      { status=`🔴 과매수 구간 (현재 RSI: ${rsi.toFixed(1)})`; detail='최근 주가가 단기간에 많이 올랐습니다. 통계적으로 조정이 올 가능성이 높아지는 구간입니다.' }
    else if (rsi <= 30) { status=`🔵 과매도 구간 (현재 RSI: ${rsi.toFixed(1)})`; detail='최근 주가가 단기간에 많이 떨어졌습니다. 기술적으로는 반등 가능성이 있는 구간입니다.' }
    else if (rsi >= 50) { status=`🟡 중립 상단 (현재 RSI: ${rsi.toFixed(1)})`; detail='매수세가 다소 우세한 보통 구간입니다.' }
    else                { status=`🟡 중립 하단 (현재 RSI: ${rsi.toFixed(1)})`; detail='매도세가 다소 우세한 보통 구간입니다.' }
  }
  return (
    <>
      <p>최근 14일 동안 주가가 오른 날과 내린 날의 크기를 비교하여 <b>0~100</b> 사이로 표현한 지표입니다.</p>
      <p style={{ marginTop: 8, fontWeight: 700 }}>{status}</p>
      {detail && <p style={{ marginTop: 4 }}>{detail}</p>}
      <table style={{ marginTop: 12 }}>
        <thead><tr><th>RSI 범위</th><th>상태</th><th>해석</th></tr></thead>
        <tbody>
          <tr><td>70 이상</td><td>🔴 과매수</td><td>단기 조정 가능성 주의</td></tr>
          <tr><td>50~70</td><td>🟡 중립 상단</td><td>상승 흐름 유지</td></tr>
          <tr><td>30~50</td><td>🟡 중립 하단</td><td>하락 흐름 유지</td></tr>
          <tr><td>30 이하</td><td>🔵 과매도</td><td>반등 가능성 참고</td></tr>
        </tbody>
      </table>
      <div className="an-warning-box" style={{ marginTop: 8 }}>⚠️ RSI가 70을 넘었다고 해서 <b>반드시</b> 떨어지는 것이 아닙니다. 강한 상승 추세에서는 70~90을 몇 달씩 유지하는 경우도 흔합니다.</div>
    </>
  )
}

function MACDExplain({ macd, signal }) {
  let status = '⚪ MACD 데이터를 불러올 수 없습니다.'
  if (macd != null && signal != null) {
    status = macd > signal
      ? `📗 MACD선(${macd.toFixed(2)})이 시그널선(${signal.toFixed(2)})보다 위에 있습니다 — 상승 모멘텀 유지.`
      : `📕 MACD선(${macd.toFixed(2)})이 시그널선(${signal.toFixed(2)})보다 아래에 있습니다 — 하락 모멘텀 진행 중.`
  }
  return (
    <>
      <p>단기(12일)와 장기(26일) 이동평균의 차이를 계산한 지표입니다.</p>
      <p style={{ marginTop: 8, fontWeight: 700 }}>{status}</p>
      <table style={{ marginTop: 12 }}>
        <thead><tr><th>요소</th><th>설명</th></tr></thead>
        <tbody>
          <tr><td>MACD선</td><td>12일 EMA - 26일 EMA</td></tr>
          <tr><td>시그널선</td><td>MACD선의 9일 이동평균</td></tr>
          <tr><td>히스토그램</td><td>MACD선 - 시그널선 (막대가 클수록 추세 강함)</td></tr>
        </tbody>
      </table>
      <div className="an-warning-box" style={{ marginTop: 8 }}>⚠️ MACD도 이동평균에 기반하므로 후행성이 있습니다. MACD 신호만 보고 매수·매도하는 것은 위험합니다.</div>
    </>
  )
}

function BBExplain({ close, upper, lower }) {
  let status = '⚪ 볼린저밴드 데이터를 불러올 수 없습니다.'
  if (close != null && upper != null && lower != null && upper > lower) {
    const width = upper - lower
    const pos   = (close - lower) / width * 100
    if (close >= upper * 0.99)      status = `🔴 현재가(${fmtPrice(close)})가 상단 밴드(${fmtPrice(upper)}) 근처입니다 — 단기 과열 구간일 수 있습니다.`
    else if (close <= lower * 1.01) status = `🔵 현재가(${fmtPrice(close)})가 하단 밴드(${fmtPrice(lower)}) 근처입니다 — 단기 침체 구간일 수 있습니다.`
    else                            status = `🟡 현재가(${fmtPrice(close)})가 밴드 안 ${pos.toFixed(1)}% 위치에 있습니다 — 정상 범위 내.`
  }
  return (
    <>
      <p>20일 이동평균선을 중심으로 위아래로 통계적 범위(표준편차 ×2)를 표시한 <b>띠(band)</b>입니다.</p>
      <p style={{ marginTop: 8, fontWeight: 700 }}>{status}</p>
      <ul style={{ marginTop: 10 }}>
        <li>상단 밴드 근처: 과매수 구간일 가능성</li>
        <li>하단 밴드 근처: 과매도 구간일 가능성</li>
        <li>밴드가 좁아질수록: 곧 큰 움직임이 올 수 있음</li>
      </ul>
      <div className="an-warning-box" style={{ marginTop: 8 }}>⚠️ 볼린저밴드만으로 매수·매도 시점을 판단하는 것은 위험합니다. 다른 지표와 함께 사용하세요.</div>
    </>
  )
}
