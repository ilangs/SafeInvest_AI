import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import api from '../../services/api'

const PERIODS = [
  { key: 'D', label: '일봉' },
  { key: 'W', label: '주봉' },
  { key: 'M', label: '월봉' },
]

const MA_LINES = [
  { period:  5, color: '#f59e0b', label: 'MA5'  },
  { period: 20, color: '#3b82f6', label: 'MA20' },
  { period: 60, color: '#10b981', label: 'MA60' },
]

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

function formatMobilePrice(price) {
  if (Math.abs(price) >= 1000000) return `${Math.round(price / 1000000)}M`
  if (Math.abs(price) >= 1000) return `${Math.round(price / 1000)}K`
  return `${Math.round(price)}`
}

export default function CandleChart({ symbol, currentPrice, isMockMode = true }) {
  const wrapperRef    = useRef(null)
  const chartRef      = useRef(null)
  const chartInstance = useRef(null)
  const candleSeries  = useRef(null)
  const volSeries     = useRef(null)
  const maSeriesRefs  = useRef([])
  const candleCount   = useRef(0)
  const chartReqId    = useRef(0)

  const [period, setPeriod] = useState('D')
  const [loading, setLoading] = useState(false)
  const [isMock, setIsMock]   = useState(false)

  useEffect(() => {
    if (!chartRef.current) return

    const isMobile = window.innerWidth <= 480
    const initH = wrapperRef.current?.clientHeight || 380

    const chart = createChart(chartRef.current, {
      layout: {
        background:      { color: 'transparent' },
        textColor:       '#9ca3af',
        fontSize:        11,
        attributionLogo: false,
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
        fixRightEdge:   true,
        fixLeftEdge:    false,
        minimumHeight: window.innerWidth <= 480 ? 50 : undefined,
      },
      handleScroll: {
        mouseWheel:       false,
        pressedMouseMove: true,
        horzTouchDrag:    true,
        vertTouchDrag:    false,
      },
      handleScale: {
        mouseWheel:           false,
        pinch:                true,
        axisPressedMouseMove: { time: true, price: false },
      },
      kineticScroll: { mouse: false, touch: true },
      width:  chartRef.current.clientWidth,
      height: window.innerWidth <= 480 ? initH - 30 : initH,
    })

    const candle = chart.addSeries(CandlestickSeries, {
      upColor:          '#ef4444',
      downColor:        '#3b82f6',
      borderUpColor:    '#ef4444',
      borderDownColor:  '#3b82f6',
      wickUpColor:      '#ef4444',
      wickDownColor:    '#3b82f6',
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: {
        type: 'custom',
        formatter: (price) => isMobile ? formatMobilePrice(price) : price.toFixed(2),
      },
    })

    const maSeries = MA_LINES.map(({ color }) => chart.addSeries(LineSeries, {
      color,
      lineWidth:           1.5,
      priceLineVisible:    false,
      lastValueVisible:    false,
      crosshairMarkerVisible: false,
      priceFormat: {
        type: 'custom',
        formatter: (price) => isMobile ? formatMobilePrice(price) : price.toFixed(2),
      },
    }))

    const vol = chart.addSeries(HistogramSeries, {
      color:            'rgba(100,100,100,0.4)',
      priceFormat:      { type: 'volume' },
      priceScaleId:     'volume',
      priceLineVisible: false,
      lastValueVisible: false,
    })

    chart.priceScale('volume').applyOptions({
      scaleMargins:    { top: 0.75, bottom: 0 },
      visible:         false,
      borderVisible:   false,
    })

    chartInstance.current = chart
    candleSeries.current  = candle
    volSeries.current     = vol
    maSeriesRefs.current  = maSeries

    const RIGHT_OFFSET = 3
    const MIN_VISIBLE  = 10

    const handleWheel = (e) => {
      e.preventDefault()
      const ts = chart.timeScale()
      const range = ts.getVisibleLogicalRange()
      const total = candleCount.current
      if (!range || total <= 0) return

      const rightEdge   = total - 1 + RIGHT_OFFSET
      const currentSpan = rightEdge - range.from
      const factor      = e.deltaY > 0 ? 1.18 : 0.85
      let newSpan       = currentSpan * factor

      newSpan = Math.max(MIN_VISIBLE, newSpan)
      newSpan = Math.min(total + RIGHT_OFFSET - 1, newSpan)

      ts.setVisibleLogicalRange({
        from: rightEdge - newSpan,
        to:   rightEdge,
      })
    }

    chartRef.current.addEventListener('wheel', handleWheel, { passive: false })

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

  useEffect(() => {
    chartReqId.current += 1
    candleSeries.current?.setData([])
    volSeries.current?.setData([])
    maSeriesRefs.current.forEach(s => s.setData([]))
    setIsMock(false)
  }, [symbol])

  const loadData = useCallback(async (sym, prd) => {
    if (!sym || !candleSeries.current) return
    const myReq = ++chartReqId.current
    setLoading(true)

    try {
      const { data } = await api.get(`/api/v1/market/chart?symbol=${sym}&period=${prd}&is_mock=${isMockMode}`)

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

      MA_LINES.forEach(({ period: p }, idx) => {
        const series = maSeriesRefs.current[idx]
        if (series) series.setData(calcSMA(candleData, p))
      })

      candleCount.current = candleData.length

      const ts = chartInstance.current?.timeScale()
      if (ts && candleData.length > 0) {
        const visibleCount = Math.min(90, candleData.length)
        const rightEdge    = candleData.length - 1 + 3

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

  useEffect(() => {
    if (symbol) loadData(symbol, period)
  }, [symbol, period, isMockMode, loadData])

  const handlePeriod = (key) => {
    setPeriod(key)
    loadData(symbol, key)
  }

  return (
    <div
      className="trade-candle-card"
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--border-radius-md)',
        padding: '12px',
        border: '0.5px solid var(--border)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="trade-candle-header"
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div
          className="trade-candle-info-row"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <span
            className="trade-mock-badge"
            style={{
              fontSize: 12,
              fontWeight: 400,
              background: 'var(--brand-bg)',
              color: 'var(--brand)',
              border: '1px solid var(--brand-bright)',
              padding: '3px 10px',
              borderRadius: 6,
            }}
          >
            Mock Data
          </span>

          {loading && (
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>로딩 중...</span>
          )}

          <div
            className="trade-ma-legend"
            style={{
              display: 'flex',
              gap: 8,
              marginLeft: 8,
            }}
          >
            {MA_LINES.map(m => (
              <span
                key={m.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 11,
                  color: 'var(--color-text-secondary)',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 2,
                    background: m.color,
                    borderRadius: 1,
                  }}
                />
                {m.label}
              </span>
            ))}
          </div>
        </div>

        <div
          className="trade-period-row"
          style={{
            display: 'flex',
            gap: 4,
          }}
        >
          {PERIODS.map(p => (
            <button
              key={p.key}
              className="trade-period-btn"
              onClick={() => handlePeriod(p.key)}
              style={{
                padding: '3px 10px',
                fontSize: 12,
                borderRadius: 'var(--border-radius-md)',
                background: period === p.key ? 'var(--brand)' : 'var(--bg-primary)',
                color:      period === p.key ? '#fff' : 'var(--text-secondary)',
                border:     period === p.key ? 'none' : '0.5px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={wrapperRef}
        className="trade-candle-plot"
        style={{
          flex: 1,
          minHeight: 200,
          position: 'relative',
          overflow: 'visible',
          width: window.innerWidth <= 480 ? '113%' : '100%',
          marginLeft: window.innerWidth <= 480 ? '-6px' : 0,
        }}
      >
        <div ref={chartRef} style={{ position: 'absolute', left: window.innerWidth <= 480 ? -15 : 8, right: window.innerWidth <= 480 ? 0: 0, top: 0, bottom: 0 }} />
      </div>
    </div>
  )
}

