import { useState, useMemo } from 'react'
import PlotlyChart from '../shared/PlotlyChart.jsx'
import ExplainBox  from '../shared/ExplainBox.jsx'
import { fmtPrice, fmtVolume, fmtPercent } from '../../../services/analysisApi.js'

const PERIODS = ['1개월','3개월','6개월','1년','전체']
const PERIOD_DAYS = { '1개월':30, '3개월':90, '6개월':180, '1년':365, '전체':99999 }

export default function TabPrice({ prices, score }) {
  const [period, setPeriod] = useState('1년')

  const filtered = useMemo(() => {
    if (!prices?.length) return []
    const days = PERIOD_DAYS[period]
    if (days >= 99999) return prices
    const last = new Date(prices[prices.length - 1].date)
    const cutoff = new Date(last); cutoff.setDate(cutoff.getDate() - days)
    return prices.filter(p => new Date(p.date) >= cutoff)
  }, [prices, period])

  if (!prices?.length) return (
    <div>
      <h2 style={{ marginBottom: 16 }}>가격추이</h2>
      <ExplainBox title="데이터 없음" body="가격 데이터가 없습니다." type="warning" />
    </div>
  )

  const closes  = filtered.map(p => p.close).filter(v => v != null)
  const volumes = filtered.map(p => p.volume).filter(v => v != null)
  const high    = closes.length ? Math.max(...closes) : null
  const low     = closes.length ? Math.min(...closes) : null
  const first   = closes[0], last = closes[closes.length - 1]
  const retPct  = (first && last && first !== 0) ? (last - first) / first * 100 : null
  const avgVol  = volumes.length ? volumes.reduce((a,b)=>a+b,0)/volumes.length : null

  const last252 = prices.slice(-252).map(p => p.close).filter(v => v != null)
  const cur = prices[prices.length - 1]?.close
  const hi52 = last252.length ? Math.max(...last252) : null
  const lo52 = last252.length ? Math.min(...last252) : null
  const dd52  = (cur && hi52 && hi52 > 0) ? (cur / hi52 - 1) * 100 : null
  const rb52  = (cur && lo52 && lo52 > 0) ? (cur / lo52 - 1) * 100 : null

  const dates = filtered.map(p => p.date)
  const volColors = filtered.map(p => (p.close >= p.open) ? '#ef4444' : '#3b82f6')

  const priceData = [
    {
      type:'candlestick', x:dates,
      open:filtered.map(p=>p.open), high:filtered.map(p=>p.high),
      low:filtered.map(p=>p.low),   close:filtered.map(p=>p.close),
      name:'캔들', yaxis:'y',
      increasing:{ line:{ color:'#ef4444' } },
      decreasing:{ line:{ color:'#3b82f6' } },
    },
    { type:'scatter', mode:'lines', x:dates, y:filtered.map(p=>p.ma5),  name:'MA5',  line:{ color:'#f59e0b', width:1.5 }, yaxis:'y' },
    { type:'scatter', mode:'lines', x:dates, y:filtered.map(p=>p.ma20), name:'MA20', line:{ color:'#22c55e', width:1.5 }, yaxis:'y' },
    { type:'scatter', mode:'lines', x:dates, y:filtered.map(p=>p.ma60), name:'MA60', line:{ color:'#a78bfa', width:1.5 }, yaxis:'y' },
    {
      type:'bar', x:dates, y:filtered.map(p=>p.volume),
      name:'거래량', marker:{ color:volColors }, yaxis:'y2',
    },
  ]
  const priceLayout = {
    paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(18,24,41,0.55)',
    font:{ color:'#dbeafe', size:12 }, height:620,
    margin:{ l:52, r:20, t:50, b:40 },
    title:{ text:`가격 추이 (${period})`, font:{ size:18, color:'#dbeafe' } },
    xaxis:{ gridcolor:'rgba(255,255,255,0.07)', rangeslider:{ visible:false } },
    yaxis:{ gridcolor:'rgba(255,255,255,0.07)', domain:[0.25,1] },
    yaxis2:{ gridcolor:'rgba(255,255,255,0.04)', domain:[0,0.22] },
    legend:{ bgcolor:'rgba(0,0,0,0)' },
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>가격추이</h2>

      <div className="an-period-bar">
        {PERIODS.map(p => (
          <button key={p} className={`an-period-btn${period===p?' active':''}`} onClick={() => setPeriod(p)}>{p}</button>
        ))}
      </div>

      <PlotlyChart data={priceData} layout={priceLayout} />

      <div className="an-grid-4" style={{ marginTop: 20 }}>
        <div className="an-metric-card">
          <div className="an-metric-label">기간 최고가</div>
          <div className="an-metric-value" style={{ fontSize:22, color:'#ef4444' }}>{fmtPrice(high)}</div>
        </div>
        <div className="an-metric-card">
          <div className="an-metric-label">기간 최저가</div>
          <div className="an-metric-value" style={{ fontSize:22, color:'#3b82f6' }}>{fmtPrice(low)}</div>
        </div>
        <div className="an-metric-card">
          <div className="an-metric-label">평균 거래량</div>
          <div className="an-metric-value" style={{ fontSize:22 }}>{fmtVolume(avgVol)}</div>
        </div>
        <div className="an-metric-card">
          <div className="an-metric-label">기간 수익률</div>
          <div className="an-metric-value" style={{ fontSize:22, color: retPct == null ? '#94a3b8' : retPct >= 0 ? '#22c55e' : '#ef4444' }}>
            {fmtPercent(retPct)}
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: 24, marginBottom: 12 }}>52주 가격 위치 해석</h3>
      <div className="an-grid-2">
        {dd52 == null
          ? <ExplainBox title="52주 고점 데이터 부족" body="계산할 수 없습니다." type="warn" />
          : dd52 > -10
            ? <ExplainBox title="52주 고점 근처" body={`현재가는 52주 고점 대비 <b>${dd52.toFixed(2)}%</b> 위치입니다. 가격 부담도 확인하세요.`} type="warn" />
            : dd52 < -50
              ? <ExplainBox title="52주 고점 대비 큰 하락" body={`현재가는 52주 고점 대비 <b>${dd52.toFixed(2)}%</b> 낮습니다. 하락 원인 점검이 우선입니다.`} type="warn" />
              : <ExplainBox title="52주 고점과 적당한 거리" body={`현재가는 52주 고점 대비 <b>${dd52.toFixed(2)}%</b> 위치입니다.`} type="info" />
        }
        {rb52 == null
          ? <ExplainBox title="52주 저점 데이터 부족" body="계산할 수 없습니다." type="warn" />
          : rb52 > 100
            ? <ExplainBox title="저점 대비 큰 반등" body={`현재가는 52주 저점 대비 <b>${rb52.toFixed(2)}%</b> 상승했습니다. 추격 매수는 신중하세요.`} type="warn" />
            : rb52 < 20
              ? <ExplainBox title="52주 저점 근처" body={`현재가는 52주 저점 대비 <b>${rb52.toFixed(2)}%</b> 상승 위치입니다.`} type="warn" />
              : <ExplainBox title="저점 대비 일정 반등" body={`현재가는 52주 저점 대비 <b>${rb52.toFixed(2)}%</b> 상승했습니다.`} type="info" />
        }
      </div>

      {retPct != null && (
        retPct >= 50
          ? <ExplainBox title="급등 구간 주의" body={`선택한 기간 수익률이 <b>${retPct.toFixed(2)}%</b>입니다. 단기 급등 이후 조정 가능성을 고려하세요.`} type="warning" />
          : retPct >= 20
            ? <ExplainBox title="상승폭 확인 필요" body={`선택한 기간 수익률이 <b>${retPct.toFixed(2)}%</b>입니다. 가격 부담이 커졌는지 확인하세요.`} type="info" />
            : retPct <= -50
              ? <ExplainBox title="큰 하락 주의" body={`선택한 기간 수익률이 <b>${retPct.toFixed(2)}%</b>입니다. 하락 원인이 재무 악화인지 먼저 확인하세요.`} type="danger" />
              : retPct <= -20
                ? <ExplainBox title="하락 원인 확인" body={`선택한 기간 수익률이 <b>${retPct.toFixed(2)}%</b>입니다. 저가 매수 전에 재무·공시 점검이 필요합니다.`} type="warn" />
                : <ExplainBox title="극단적 급등락은 아님" body={`선택한 기간 수익률은 <b>${retPct.toFixed(2)}%</b>입니다. 가격 외에 재무·경고 항목도 함께 확인하세요.`} type="good" />
      )}

      {avgVol == null
        ? <ExplainBox title="거래량 데이터 부족" body="평균 거래량을 계산할 수 없습니다." type="warn" />
        : avgVol < 1000
          ? <ExplainBox title="거래량 매우 부족" body={`평균 거래량이 <b>${fmtVolume(avgVol)}</b>입니다. 매수·매도 체결이 어려울 수 있습니다.`} type="danger" />
          : avgVol < 10000
            ? <ExplainBox title="거래량 부족" body={`평균 거래량이 <b>${fmtVolume(avgVol)}</b>입니다. 원하는 가격에 매도하기 어려울 수 있습니다.`} type="warn" />
            : <ExplainBox title="거래량 양호" body={`평균 거래량이 <b>${fmtVolume(avgVol)}</b>입니다. 비교적 거래가 활발한 편입니다.`} type="good" />
      }

      <ExplainBox
        title="가격추이 최종 정리"
        body="가격추이 탭은 싸다/비싸다를 단정하지 않고 현재 위치와 위험도를 점검하는 화면입니다. 초보자는 <b>종합진단 → 안전점검 → 재무분석 → 가격추이 → 기술적분석</b> 순서로 함께 확인하는 것이 좋습니다."
        type="info"
      />
    </div>
  )
}
