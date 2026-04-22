import { useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
} from 'lightweight-charts'
import api from '../../services/api'

const PERIODS = [
  { key: 'D', label: '일' },
  { key: 'W', label: '주' },
  { key: 'M', label: '월' },
]

function toTimeStr(date) {
  if (!date || date.length < 8) return date
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
}

function buildBollinger(candles, length = 20, multiplier = 2) {
  const upper = []
  const middle = []
  const lower = []

  for (let i = length - 1; i < candles.length; i += 1) {
    const window = candles.slice(i - length + 1, i + 1)
    const closes = window.map((c) => c.close)
    const mean = closes.reduce((sum, v) => sum + v, 0) / length
    const variance = closes.reduce((sum, v) => sum + (v - mean) ** 2, 0) / length
    const stdDev = Math.sqrt(variance)

    upper.push({ time: candles[i].time, value: Number((mean + multiplier * stdDev).toFixed(2)) })
    middle.push({ time: candles[i].time, value: Number(mean.toFixed(2)) })
    lower.push({ time: candles[i].time, value: Number((mean - multiplier * stdDev).toFixed(2)) })
  }

  return { upper, middle, lower }
}

export default function ChartWidget({ symbol }) {
  const [period, setPeriod] = useState('D')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isMock, setIsMock] = useState(false)

  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const candleRef = useRef(null)
  const volumeRef = useRef(null)
  const bbUpperRef = useRef(null)
  const bbMiddleRef = useRef(null)
  const bbLowerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#334155',
      },
      grid: {
        vertLines: { color: '#e2e8f0' },
        horzLines: { color: '#e2e8f0' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: '#cbd5e1',
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      timeScale: {
        borderColor: '#cbd5e1',
        timeVisible: false,
      },
    })

    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#ef4444',
      downColor: '#3b82f6',
      borderUpColor: '#ef4444',
      borderDownColor: '#3b82f6',
      wickUpColor: '#ef4444',
      wickDownColor: '#3b82f6',
    })

    volumeRef.current = chart.addSeries(HistogramSeries, {
      color: 'rgba(148, 163, 184, 0.45)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    })

    bbUpperRef.current = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    bbMiddleRef.current = chart.addSeries(LineSeries, {
      color: '#64748b',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    bbLowerRef.current = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
      borderVisible: false,
    })

    chartRef.current = chart

    return () => {
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volumeRef.current = null
      bbUpperRef.current = null
      bbMiddleRef.current = null
      bbLowerRef.current = null
    }
  }, [])

  const loadChart = async (targetSymbol, targetPeriod) => {
    if (!targetSymbol || !candleRef.current) return

    setLoading(true)
    setError('')

    try {
      const { data } = await api.get(`/api/v1/market/chart?symbol=${targetSymbol}&period=${targetPeriod}`)

      const candles = (data?.candles ?? [])
        .map((c) => ({
          time: toTimeStr(c.date),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume ?? 0),
        }))
        .filter((c) => c.time && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
        .sort((a, b) => a.time.localeCompare(b.time))

      candleRef.current.setData(candles)

      volumeRef.current.setData(
        candles.map((c) => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.4)',
        })),
      )

      const bands = buildBollinger(candles, 20, 2)
      bbUpperRef.current.setData(bands.upper)
      bbMiddleRef.current.setData(bands.middle)
      bbLowerRef.current.setData(bands.lower)

      chartRef.current?.timeScale().fitContent()
      setIsMock(Boolean(data?.is_mock))
    } catch {
      setError('차트 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!symbol) return
    loadChart(symbol, period)
    // symbol 변경 시 1회만 로드. 자동 순환 로딩은 하지 않음.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol])

  const handlePeriodClick = (next) => {
    setPeriod(next)
    loadChart(symbol, next)
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="card-header" style={{ marginBottom: '4px', flexShrink: 0 }}>
        <span>
          주가 차트
          {isMock && <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '6px' }}>mock</span>}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {PERIODS.map((item) => (
            <button
              key={item.key}
              onClick={() => handlePeriodClick(item.key)}
              style={{
                padding: '2px 10px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: period === item.key ? '#3b82f6' : '#cbd5e1',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: period === item.key ? 700 : 500,
                background: period === item.key ? '#3b82f6' : '#ffffff',
                color: period === item.key ? '#ffffff' : '#1e293b',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ color: '#64748b', fontSize: '12px', padding: '4px 0' }}>차트 로딩 중...</div>}
      {error && <div style={{ color: '#ef4444', fontSize: '12px', padding: '4px 0' }}>{error}</div>}

      <div ref={containerRef} style={{ flex: '1 1 0', minHeight: 0, width: '100%' }} />
    </div>
  )
}
