import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import api from '../../services/api'

const PERIODS = [
  { key: 'D', label: '일봉' },
  { key: 'W', label: '주봉' },
  { key: 'M', label: '월봉' },
]

// 이동평균선 정의 (기간 / 색상)
const MA_LINES = [
  { period:  5, color: '#f59e0b', label: 'MA5'  },
  { period: 20, color: '#3b82f6', label: 'MA20' },
  { period: 60, color: '#10b981', label: 'MA60' },
]

// 단순이동평균(SMA) 계산
function calcSMA(candles, period) {
  const out = []
  let sum = 0
  for (let i = 0; i < candles.length; i += 1) {
    sum += candles[i].close
    if (i >= period) sum -= candles[i - period].close
    if (i >= period - 1) {
      out.push({ time: candles[i].time, value: +(sum / period).toFixed(2) })
    }
  }
  return out
}

export default function CandleChart({ symbol, currentPrice, isMockMode = true }) {
  const wrapperRef    = useRef(null)   // flex wrapper — ResizeObserver 대상
  const chartRef      = useRef(null)   // TradingView 컨테이너
  const chartInstance = useRef(null)
  const candleSeries  = useRef(null)
  const volSeries     = useRef(null)
  const maSeriesRefs  = useRef([])     // 이동평균선 시리즈 배열
  const candleCount   = useRef(0)      // 휠 핸들러에서 사용하는 전체 캔들 개수
  // 종목 변경 시 in-flight 차트 요청 무효화
  const chartReqId    = useRef(0)
  const [period, setPeriod] = useState('D')
  const [loading, setLoading] = useState(false)
  const [isMock, setIsMock]   = useState(false)

  // 차트 초기화 (마운트 1회)
  useEffect(() => {
    if (!chartRef.current) return

    const initH = wrapperRef.current?.clientHeight || 380

    const chart = createChart(chartRef.current, {
      layout: {
        background:      { color: 'transparent' },
        textColor:       '#9ca3af',
        fontSize:        11,
        attributionLogo: false,    // TradingView 로고/링크 숨김 (v4.2+)
      },
      grid: {
        vertLines: { color: 'rgba(128,128,128,0.1)' },
        horzLines: { color: 'rgba(128,128,128,0.1)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: {
        borderColor:  'rgba(128,128,128,0.2)',
        scaleMargins: { top: 0.1, bottom: 0.3 },
      },
      timeScale: {
        borderColor:    'rgba(128,128,128,0.2)',
        timeVisible:    true,
        secondsVisible: false,
        rightOffset:    3,
        barSpacing:     6,
        minBarSpacing:  1,
        fixRightEdge:   true,      // 우측 끝(최신 캔들) 고정
        fixLeftEdge:    false,
      },
      // 휠은 커스텀 핸들러로 처리 (마우스 위치 무관, 우측 고정 줌)
      handleScroll: {
        mouseWheel:       false,
        pressedMouseMove: true,    // 드래그 패닝 유지
        horzTouchDrag:    true,
        vertTouchDrag:    false,
      },
      handleScale: {
        mouseWheel:           false,   // 기본 휠 줌 비활성 → 커스텀으로 대체
        pinch:                true,
        axisPressedMouseMove: { time: true, price: false },
      },
      kineticScroll: { mouse: false, touch: true },
      width:  chartRef.current.clientWidth,
      height: initH,
    })

    // 캔들스틱: 상승=빨강, 하락=파랑 (한국 증시 관례)
    const candle = chart.addSeries(CandlestickSeries, {
      upColor:          '#ef4444',
      downColor:        '#3b82f6',
      borderUpColor:    '#ef4444',
      borderDownColor:  '#3b82f6',
      wickUpColor:      '#ef4444',
      wickDownColor:    '#3b82f6',
      priceLineVisible: false,    // 마지막 종가 기준선(파란 점선) 숨김
      lastValueVisible: false,    // 우측 가격 라벨 숨김
    })

    // 이동평균선 시리즈 (캔들과 동일 가격축 공유)
    const maSeries = MA_LINES.map(({ color }) => chart.addSeries(LineSeries, {
      color,
      lineWidth:           1.5,
      priceLineVisible:    false,
      lastValueVisible:    false,
      crosshairMarkerVisible: false,
    }))

    // 거래량 히스토그램 (하단 25%)
    const vol = chart.addSeries(HistogramSeries, {
      color:            'rgba(100,100,100,0.4)',
      priceFormat:      { type: 'volume' },
      priceScaleId:     'volume',
      priceLineVisible: false,    // 거래량 기준선 숨김
      lastValueVisible: false,    // 우측 거래량 라벨(20.52M) 숨김
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins:    { top: 0.75, bottom: 0 },
      visible:         false,    // 거래량 가격축 자체를 숨김 (489K 라벨 + 점선 제거)
      borderVisible:   false,
    })

    chartInstance.current = chart
    candleSeries.current  = candle
    volSeries.current     = vol
    maSeriesRefs.current  = maSeries

    // ── 커스텀 휠 줌 핸들러 ─────────────────────────────────────
    // 마우스 위치와 무관하게 우측(최신 캔들) 고정, 좌측만 늘었다 줄었다.
    // 줌 아웃 한계: 전체 데이터가 모두 보이면 더 이상 축소 불가.
    const RIGHT_OFFSET = 3
    const MIN_VISIBLE  = 10        // 최소 보이는 캔들 수 (확대 한계)
    const handleWheel = (e) => {
      e.preventDefault()
      const ts = chart.timeScale()
      const range = ts.getVisibleLogicalRange()
      const total = candleCount.current
      if (!range || total <= 0) return

      // 우측 끝은 항상 (총 캔들 - 1) + RIGHT_OFFSET 으로 고정
      const rightEdge   = total - 1 + RIGHT_OFFSET
      const currentSpan = rightEdge - range.from
      // 휠 위 (deltaY < 0) = 확대(span↓), 휠 아래 (deltaY > 0) = 축소(span↑)
      const factor      = e.deltaY > 0 ? 1.18 : 0.85
      let newSpan       = currentSpan * factor

      // 클램프: 최소 MIN_VISIBLE, 최대 (전체 데이터 + 우측 여백)
      newSpan = Math.max(MIN_VISIBLE, newSpan)
      newSpan = Math.min(total + RIGHT_OFFSET - 1, newSpan)

      ts.setVisibleLogicalRange({
        from: rightEdge - newSpan,
        to:   rightEdge,
      })
    }
    chartRef.current.addEventListener('wheel', handleWheel, { passive: false })

    // 반응형 리사이즈 — wrapperRef 기준으로 너비·높이 모두 업데이트
    const ro = new ResizeObserver(() => {
      if (wrapperRef.current && chartInstance.current) {
        chartInstance.current.applyOptions({
          width:  wrapperRef.current.clientWidth,
          height: wrapperRef.current.clientHeight,
        })
      }
    })
    if (wrapperRef.current) ro.observe(wrapperRef.current)

    return () => {
      ro.disconnect()
      chartRef.current?.removeEventListener('wheel', handleWheel)
      chart.remove()
      chartInstance.current = null
      candleSeries.current  = null
      volSeries.current     = null
      maSeriesRefs.current  = []
    }
  }, [])

  // 종목 변경 시 차트 데이터 즉시 비우기 + 이전 요청 무효화
  useEffect(() => {
    chartReqId.current += 1
    candleSeries.current?.setData([])
    volSeries.current?.setData([])
    maSeriesRefs.current.forEach(s => s.setData([]))
    setIsMock(false)
  }, [symbol])

  // 데이터 로드 — symbol·period 변경 시에만 (폴링 없음)
  const loadData = useCallback(async (sym, prd) => {
    if (!sym || !candleSeries.current) return
    const myReq = ++chartReqId.current
    setLoading(true)
    try {
      const { data } = await api.get(`/api/v1/market/chart?symbol=${sym}&period=${prd}&is_mock=${isMockMode}`)
      // 최신 요청만 반영 (이전 종목 응답 무시)
      if (myReq !== chartReqId.current) return
      setIsMock(data.is_mock || false)

      const candleData = (data.candles || []).map(c => ({
        time:  c.time,
        open:  c.open,
        high:  c.high,
        low:   c.low,
        close: c.close,
      }))
      const volData = (data.candles || []).map(c => ({
        time:  c.time,
        value: c.value,
        color: c.close >= c.open
          ? 'rgba(239,68,68,0.5)'
          : 'rgba(59,130,246,0.5)',
      }))

      candleSeries.current?.setData(candleData)
      volSeries.current?.setData(volData)
      // 이동평균선 데이터 계산 및 적용
      MA_LINES.forEach(({ period: p }, idx) => {
        const series = maSeriesRefs.current[idx]
        if (series) series.setData(calcSMA(candleData, p))
      })
      // 휠 핸들러용 캔들 개수 갱신
      candleCount.current = candleData.length
      // 초기 표시 범위: 최근 90개 캔들만 보이도록 우측 정렬
      // (전체 2년치 데이터는 캐싱되어 있어 휠 아웃 시 과거 데이터 노출)
      const ts = chartInstance.current?.timeScale()
      if (ts && candleData.length > 0) {
        const visibleCount = Math.min(90, candleData.length)
        const rightEdge    = candleData.length - 1 + 3   // 우측 여백 3 bar
        ts.setVisibleLogicalRange({
          from: rightEdge - visibleCount,
          to:   rightEdge,
        })
      }
    } catch (e) {
      if (myReq === chartReqId.current) console.error('차트 로드 실패:', e)
    } finally {
      if (myReq === chartReqId.current) setLoading(false)
    }
  }, [isMockMode])

  // symbol 변경 시 재조회 (period 유지)
  useEffect(() => {
    if (symbol) loadData(symbol, period)
  }, [symbol, period, isMockMode, loadData])

  // 탭 클릭 시에만 재조회
  const handlePeriod = (key) => {
    setPeriod(key)
    loadData(symbol, key)
  }

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      borderRadius: 'var(--border-radius-md)',
      padding: '12px',
      border: '0.5px solid var(--color-border-tertiary)',
      /* 부모 grid stretch 에 맞춰 전체 높이 사용 */
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
    }}>
      {/* 헤더 (shrink 고정) */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {currentPrice ? currentPrice.toLocaleString() : '-'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>원</span>
          {isMock && (
            <span style={{
              fontSize: 10,
              background: 'var(--color-background-warning)',
              color: 'var(--color-text-warning)',
              padding: '1px 6px', borderRadius: 4,
            }}>
              모의데이터
            </span>
          )}
          {loading && (
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>로딩 중...</span>
          )}

          {/* 이동평균선 범례 */}
          <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
            {MA_LINES.map(m => (
              <span key={m.label} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 11, color: 'var(--color-text-secondary)',
              }}>
                <span style={{
                  display: 'inline-block', width: 10, height: 2,
                  background: m.color, borderRadius: 1,
                }} />
                {m.label}
              </span>
            ))}
          </div>
        </div>

        {/* 일봉/주봉/월봉 탭 */}
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => handlePeriod(p.key)}
              style={{
                padding: '3px 10px', fontSize: 11,
                borderRadius: 'var(--border-radius-md)',
                background: period === p.key ? '#0F6E56' : 'var(--color-background-secondary)',
                color:      period === p.key ? '#fff' : 'var(--color-text-secondary)',
                border:     period === p.key ? 'none' : '0.5px solid var(--color-border-secondary)',
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 차트 wrapper — flex: 1 로 나머지 공간 모두 차지 */}
      <div ref={wrapperRef} style={{ flex: 1, minHeight: 200, position: 'relative', overflow: 'hidden' }}>
        <div ref={chartRef} style={{ position: 'absolute', inset: 0 }} />
      </div>
    </div>
  )
}
