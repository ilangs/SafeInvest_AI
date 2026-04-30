import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import api from '../../services/api'

const PERIODS = [
  { key: 'D', label: '일봉' },
  { key: 'W', label: '주봉' },
  { key: 'M', label: '월봉' },
]

export default function CandleChart({ symbol, currentPrice, isMockMode = true }) {
  const wrapperRef    = useRef(null)   // flex wrapper — ResizeObserver 대상
  const chartRef      = useRef(null)   // TradingView 컨테이너
  const chartInstance = useRef(null)
  const candleSeries  = useRef(null)
  const volSeries     = useRef(null)
  const [period, setPeriod] = useState('D')
  const [loading, setLoading] = useState(false)
  const [isMock, setIsMock]   = useState(false)

  // 차트 초기화 (마운트 1회)
  useEffect(() => {
    if (!chartRef.current) return

    const initH = wrapperRef.current?.clientHeight || 380

    const chart = createChart(chartRef.current, {
      layout: {
        background:  { color: 'transparent' },
        textColor:   '#9ca3af',
        fontSize:    11,
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
      },
      width:  chartRef.current.clientWidth,
      height: initH,
    })

    // 캔들스틱: 상승=빨강, 하락=파랑 (한국 증시 관례)
    const candle = chart.addSeries(CandlestickSeries, {
      upColor:         '#ef4444',
      downColor:       '#3b82f6',
      borderUpColor:   '#ef4444',
      borderDownColor: '#3b82f6',
      wickUpColor:     '#ef4444',
      wickDownColor:   '#3b82f6',
    })

    // 거래량 히스토그램 (하단 25%)
    const vol = chart.addSeries(HistogramSeries, {
      color:        'rgba(100,100,100,0.4)',
      priceFormat:  { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    })

    chartInstance.current = chart
    candleSeries.current  = candle
    volSeries.current     = vol

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
      chart.remove()
      chartInstance.current = null
      candleSeries.current  = null
      volSeries.current     = null
    }
  }, [])

  // 데이터 로드 — symbol·period 변경 시에만 (폴링 없음)
  const loadData = useCallback(async (sym, prd) => {
    if (!sym || !candleSeries.current) return
    setLoading(true)
    try {
      const { data } = await api.get(`/api/v1/market/chart?symbol=${sym}&period=${prd}&is_mock=${isMockMode}`)
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
      chartInstance.current?.timeScale().fitContent()
    } catch (e) {
      console.error('차트 로드 실패:', e)
    } finally {
      setLoading(false)
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
      <div ref={wrapperRef} style={{ flex: 1, minHeight: 200 }}>
        <div ref={chartRef} style={{ width: '100%' }} />
      </div>
    </div>
  )
}
