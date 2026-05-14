import { useState, useMemo } from 'react'
import PlotlyChart from '../shared/PlotlyChart.jsx'
import ExplainBox from '../shared/ExplainBox.jsx'
import { fmtPrice, fmtVolume, fmtPercent } from '../../../services/analysisApi.js'

const PERIODS = ['1개월', '3개월', '6개월', '1년', '전체']
const PERIOD_DAYS = { '1개월': 30, '3개월': 90, '6개월': 180, '1년': 365, '전체': 99999 }

export default function TabPrice({ prices, score }) {
  const [period, setPeriod] = useState('1년')

  const filtered = useMemo(() => {
    if (!prices?.length) return []

    const days = PERIOD_DAYS[period]
    if (days >= 99999) return prices

    const last = new Date(prices[prices.length - 1].date)
    const cutoff = new Date(last)
    cutoff.setDate(cutoff.getDate() - days)

    return prices.filter(p => new Date(p.date) >= cutoff)
  }, [prices, period])

  if (!prices?.length) {
    return (
      <div>
        <ExplainBox className="an-empty-warning" title="⚠️ 가격 데이터 확인 불가" body="현재 제공 가능한 가격 데이터가 부족합니다." type="warning" />
      </div>
    )
  }

  const closes = filtered.map(p => p.close).filter(v => v != null)
  const volumes = filtered.map(p => p.volume).filter(v => v != null)

  const high = closes.length ? Math.max(...closes) : null
  const low = closes.length ? Math.min(...closes) : null
  const first = closes[0]
  const last = closes[closes.length - 1]

  const retPct =
    first && last && first !== 0 ? ((last - first) / first) * 100 : null

  const avgVol = volumes.length
    ? volumes.reduce((a, b) => a + b, 0) / volumes.length
    : null

  const last252 = prices.slice(-252).map(p => p.close).filter(v => v != null)
  const cur = prices[prices.length - 1]?.close

  const hi52 = last252.length ? Math.max(...last252) : null
  const lo52 = last252.length ? Math.min(...last252) : null

  const dd52 = cur && hi52 && hi52 > 0 ? (cur / hi52 - 1) * 100 : null
  const rb52 = cur && lo52 && lo52 > 0 ? (cur / lo52 - 1) * 100 : null

  const dates = filtered.map(p => p.date)

  const volColors = filtered.map(p =>
    p.close >= p.open ? 'rgba(216, 92, 92, 0.45)' : 'rgba(59, 130, 246, 0.42)'
  )

  const priceData = [
    {
      type: 'candlestick',
      x: dates,
      open: filtered.map(p => p.open),
      high: filtered.map(p => p.high),
      low: filtered.map(p => p.low),
      close: filtered.map(p => p.close),
      name: '캔들',
      yaxis: 'y',
      increasing: {
        line: { color: '#d95c5c', width: 1.4 },
        fillcolor: 'rgba(217, 92, 92, 0.45)',
      },
      decreasing: {
        line: { color: '#3b82f6', width: 1.4 },
        fillcolor: 'rgba(59, 130, 246, 0.42)',
      },
    },
    {
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: filtered.map(p => p.ma5),
      name: 'MA5',
      line: { color: '#e38b2c', width: 1.8 },
      yaxis: 'y',
    },
    {
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: filtered.map(p => p.ma20),
      name: 'MA20',
      line: { color: '#2f7d4f', width: 2 },
      yaxis: 'y',
    },
    {
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: filtered.map(p => p.ma60),
      name: 'MA60',
      line: { color: '#6957ef', width: 1.8 },
      yaxis: 'y',
    },
    {
      type: 'bar',
      x: dates,
      y: filtered.map(p => p.volume),
      name: '거래량',
      marker: { color: volColors },
      yaxis: 'y2',
    },
  ]

  const priceLayout = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    height: 560,
    autosize: true,
    font: {
      color: 'var(--text-primary)',
      size: 12,
      family:
        'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    },
    margin: { l: 50, r: 8, t: 28, b: 2 },
    xaxis: {
      gridcolor: '#dfe9dd',
      zerolinecolor: '#dfe9dd',
      tickfont: { color: '#111827' },
      linecolor: '#cfdcc9',
      rangeslider: { visible: false },
    },
    yaxis: {
      gridcolor: '#dfe9dd',
      zerolinecolor: '#dfe9dd',
      tickfont: { color: '#111827' },
      linecolor: '#cfdcc9',
      domain: [0.31, 1],
    },
    yaxis2: {
      gridcolor: '#e9f1e7',
      zerolinecolor: '#dfe9dd',
      tickfont: { color: '#111827' },
      linecolor: '#cfdcc9',
      domain: [0, 0.2],
    },
    legend: {
      orientation: 'h',
      x: 0,
      y: 1.08,
      bgcolor: 'rgba(255,255,255,0)',
      font: { color: 'var(--text-primary)', size: 12 },
    },
    hoverlabel: {
      bgcolor: '#ffffff',
      bordercolor: '#d7e4d5',
      font: { color: '#111827' },
    },
  }

  const metricCards = [
    {
      label: '기간 최고가',
      value: fmtPrice(high),
      color: '#d95c5c',
    },
    {
      label: '기간 최저가',
      value: fmtPrice(low),
      color: '#3b82f6',
    },
    {
      label: '평균 거래량',
      value: fmtVolume(avgVol),
      color: '#2f7d4f',
    },
    {
      label: '기간 수익률',
      value: fmtPercent(retPct),
      color: retPct == null ? '#94a3b8' : retPct >= 0 ? '#4f8a57' : '#ef4444',
    },
  ]

  const priceRows = [
    {
      title:
        dd52 == null
          ? '52주 고점 데이터 부족'
          : dd52 > -10
            ? '52주 고점 근처'
            : dd52 < -50
              ? '52주 고점 대비 큰 하락'
              : '52주 고점과 적당한 거리',
      detail:
        dd52 == null
          ? '계산할 수 없습니다.'
          : dd52 > -10
            ? `현재가는 52주 고점 대비 ${dd52.toFixed(2)}% 위치입니다. 가격 부담도 확인하세요.`
            : dd52 < -50
              ? `현재가는 52주 고점 대비 ${dd52.toFixed(2)}% 낮습니다. 하락 원인 점검이 우선입니다.`
              : `현재가는 52주 고점 대비 ${dd52.toFixed(2)}% 위치입니다.`,
      sev: '고점 기준',
      sevColor: '#d95c5c',
      dot: '#d95c5c',
    },
    {
      title:
        rb52 == null
          ? '52주 저점 데이터 부족'
          : rb52 > 100
            ? '저점 대비 큰 반등'
            : rb52 < 20
              ? '52주 저점 근처'
              : '저점 대비 일정 반등',
      detail:
        rb52 == null
          ? '계산할 수 없습니다.'
          : rb52 > 100
            ? `현재가는 52주 저점 대비 ${rb52.toFixed(2)}% 상승했습니다. 추격 매수는 신중하세요.`
            : rb52 < 20
              ? `현재가는 52주 저점 대비 ${rb52.toFixed(2)}% 상승 위치입니다.`
              : `현재가는 52주 저점 대비 ${rb52.toFixed(2)}% 상승했습니다.`,
      sev: '저점 기준',
      sevColor: '#2f7d4f',
      dot: '#2f7d4f',
    },
    {
      title:
        retPct == null
          ? '수익률 데이터 부족'
          : retPct >= 50
            ? '급등 구간 주의'
            : retPct >= 20
              ? '상승폭 확인 필요'
              : retPct <= -50
                ? '큰 하락 주의'
                : retPct <= -20
                  ? '하락 원인 확인'
                  : '극단적 급등락은 아님',
      detail:
        retPct == null
          ? '선택한 기간 수익률을 계산할 수 없습니다.'
          : retPct >= 50
            ? `선택한 기간 수익률이 ${retPct.toFixed(2)}%입니다. 단기 급등 이후 조정 가능성을 고려하세요.`
            : retPct >= 20
              ? `선택한 기간 수익률이 ${retPct.toFixed(2)}%입니다. 가격 부담이 커졌는지 확인하세요.`
              : retPct <= -50
                ? `선택한 기간 수익률이 ${retPct.toFixed(2)}%입니다. 하락 원인이 재무 악화인지 먼저 확인하세요.`
                : retPct <= -20
                  ? `선택한 기간 수익률이 ${retPct.toFixed(2)}%입니다. 저가 매수 전에 재무·공시 점검이 필요합니다.`
                  : `선택한 기간 수익률은 ${retPct.toFixed(2)}%입니다. 가격 외에 재무·경고 항목도 함께 확인하세요.`,
      sev: '수익률',
      sevColor:
        retPct == null
          ? '#98a2b3'
          : retPct >= 20
            ? '#d95c5c'
            : retPct <= -20
              ? '#e38b2c'
              : '#4f8a57',
      dot:
        retPct == null
          ? '#98a2b3'
          : retPct >= 20
            ? '#d95c5c'
            : retPct <= -20
              ? '#e38b2c'
              : '#4f8a57',
    },
    {
      title:
        avgVol == null
          ? '거래량 데이터 부족'
          : avgVol < 1000
            ? '거래량 매우 부족'
            : avgVol < 10000
              ? '거래량 부족'
              : '거래량 양호',
      detail:
        avgVol == null
          ? '평균 거래량을 계산할 수 없습니다.'
          : avgVol < 1000
            ? `평균 거래량이 ${fmtVolume(avgVol)}입니다. 매수·매도 체결이 어려울 수 있습니다.`
            : avgVol < 10000
              ? `평균 거래량이 ${fmtVolume(avgVol)}입니다. 원하는 가격에 매도하기 어려울 수 있습니다.`
              : `평균 거래량이 ${fmtVolume(avgVol)}입니다. 비교적 거래가 활발한 편입니다.`,
      sev: '거래량',
      sevColor:
        avgVol == null
          ? '#98a2b3'
          : avgVol < 10000
            ? '#d7b325'
            : '#4f8a57',
      dot:
        avgVol == null
          ? '#98a2b3'
          : avgVol < 10000
            ? '#d7b325'
            : '#4f8a57',
    },
  ]

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
        <div
          style={{
            flex: 1,
            height: 1,
            background: 'var(--border)',
          }}
        />
        <div
          style={{
            fontSize: 15,
            fontWeight: 590,
            color: '#3b3e43',
            whiteSpace: 'normal',
            wordBreak: 'keep-all',
            textAlign: 'center',
            padding: '0 10px',
            letterSpacing: '-0.03em',
          }}
        >
          가격추이 탭은 현재 가격 위치와 위험도를 점검하는 화면입니다.
        </div>
        <div
          style={{
            flex: 1,
            height: 1,
            background: 'var(--border)',
          }}
        />
      </div>

      {/* 카드 4개 */}
      <div
        className="an-grid-4"
        style={{
          marginTop: 0,
          marginBottom: 30,
          gap: 12,
        }}
      >
        {metricCards.map(card => (
          <div
            key={card.label}
            className="an-metric-card"
            style={{
              borderLeft: `5px solid ${card.color}`,
              background: 'var(--bg-card)',
              borderRadius: 18,
              padding: '18px 22px',
              minHeight: 90,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div className="an-metric-label">{card.label}</div>
            <div
              className="an-metric-value"
              style={{
                fontSize: 27,
                color: card.color,
                letterSpacing: '-0.04em',
              }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* 기간 선택 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'left',
          marginTop: 0,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            flexWrap: 'wrap', // 모바일에서 버튼이 많아질 경우 대비
            padding: 4,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            gap: 2,
          }}
        >
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '6px 16px',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 700,
                color: period === p ? 'var(--text-on-brand)' : 'var(--text-secondary)',
                background: period === p ? 'var(--brand)' : 'transparent',
                transition: '0.2s ease',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 그래프 */}
      <div
        style={{
          width: '100%',
          background: 'transparent',
          padding: '0 4px',
          marginBottom: 20,
        }}
      >
        <PlotlyChart data={priceData} layout={priceLayout} />
      </div>

      {/* 52주 가격 위치 해석 */}
      <div
        style={{
          marginTop: 22,
          padding: '24px 26px',
          borderRadius: 20,
        }}
      >
        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text-primary)',
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
            style={{
              width: 24,
              height: 24,
              objectFit: 'contain',
            }}
          />
          52주 가격 위치 해석
        </h3>

        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid var(--border)',
          }}
        >
          {priceRows.map((row, idx) => (
            <div
              key={row.title}
              style={{
                display: 'flex', // 반응형을 위해 grid 대신 flex 사용
                flexWrap: 'wrap', // 좁아지면 아래로 떨어지도록 설정
                gap: '12px 16px',
                alignItems: 'center',
                padding: '16px 22px', // 터치 영역 및 시각적 안정감을 위해 패딩 약간 증가
                borderBottom:
                  idx === priceRows.length - 1 ? 'none' : '1px solid var(--border-subtle)',
              }}
            >
              {/* 타이틀 영역 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.03em',
                  width: 160, // 모바일에서도 타이틀이 차지할 최소 넓이 확보
                  flex: '0 0 auto',
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: row.dot,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                {row.title}
              </div>

              {/* 상세 설명 영역 */}
              <div
                style={{
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  flex: '1 1 200px', // 남은 공간을 차지하되, 좁으면 줄바꿈
                  wordBreak: 'keep-all',
                }}
              >
                {row.detail}
              </div>

              {/* 배지 영역 */}
              <div
                style={{
                  marginLeft: 'auto', // 우측 끝으로 밀어내기 (justifySelf 대체)
                  color: row.sevColor,
                  fontWeight: 700,
                  fontSize: 13,
                  background: `${row.sevColor}12`,
                  border: `1px solid ${row.sevColor}55`,
                  padding: '5px 12px',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                  flex: '0 0 auto',
                }}
              >
                {row.sev}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}