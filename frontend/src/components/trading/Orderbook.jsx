import { useEffect, useState, useCallback, useRef } from 'react'
import api from '../../services/api'
import { formatVolume } from '../../utils/format'

const LOGO_TAB = '/logo-tab.png'

const ROW_H = 26
const MID_H = 36
const MAX_H = ROW_H * 5 + MID_H + ROW_H * 5

export default function Orderbook({ symbol, currentPrice, onPriceSelect, isMock = true }) {
  const [data, setData] = useState({ asks: [], bids: [] })
  const [limits, setLimits] = useState({ upper: 0, lower: 0 })

  const scrollRef = useRef(null)
  const midRef = useRef(null)
  const scrolledKey = useRef(null)
  const reqIdRef = useRef(0)

  useEffect(() => {
    reqIdRef.current += 1
    setData({ asks: [], bids: [] })
    setLimits({ upper: 0, lower: 0 })
    scrolledKey.current = null
  }, [symbol])

  const load = useCallback(async () => {
    if (!symbol) return
    const myReqId = ++reqIdRef.current

    try {
      const res = await api.get(
        `/api/v1/market/orderbook?symbol=${symbol}&is_mock=${isMock}`
      )

      if (myReqId === reqIdRef.current) {
        setData(res.data)
      }
    } catch (e) {
      if (myReqId === reqIdRef.current) {
        console.error('호가 로드 실패:', e)
      }
    }
  }, [symbol, isMock])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    if (!symbol) return

    setLimits({ upper: 0, lower: 0 })

    api.get(`/api/v1/market/info?symbol=${symbol}&is_mock=${isMock}`)
      .then(res => setLimits({
        upper: res.data?.upper_limit || 0,
        lower: res.data?.lower_limit || 0,
      }))
      .catch(() => {})
  }, [symbol, isMock])

  useEffect(() => {
    if (!data.asks?.length) return

    const key = `${symbol}:${isMock}`
    if (scrolledKey.current === key) return

    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = scrollRef.current
      const mid = midRef.current
      if (!el || !mid) return

      const elRect = el.getBoundingClientRect()
      const midRect = mid.getBoundingClientRect()

      el.scrollTop += midRect.top - elRect.top - (el.clientHeight - mid.offsetHeight) / 2
      scrolledKey.current = key
    }))

    return () => cancelAnimationFrame(id)
  }, [data, symbol, isMock])

  const asks = data.asks || []
  const bids = data.bids || []
  const upper = limits.upper
  const lower = limits.lower
  const maxVol = Math.max(...asks.map(a => a.volume), ...bids.map(b => b.volume), 1)

  const totalAsk = asks.reduce((s, a) => s + a.volume, 0)
  const totalBid = bids.reduce((s, b) => s + b.volume, 0)
  const total = totalAsk + totalBid || 1
  const askPct = Math.round(totalAsk / total * 100)
  const bidPct = 100 - askPct

  const rowStyle = {
    display: 'grid',
    gridTemplateColumns: '68px 1.4fr 30px',
    alignItems: 'center',
    gap: 10,
    padding: '4px 0',
    cursor: 'pointer',
    borderRadius: 3,
  }

  return (
    <div
      className="card"
      style={{
        minWidth: 0,
        height: '100%',
        border: 'none',
        boxShadow: 'none',
        borderRadius: 0,
        overflow: 'hidden',
      }}
    >
      {/* 카드 상단 제목 바 */}
      <div
        className="card-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--brand)',
          padding: '16px 14px',
          margin: '-16px -16px 7px -16px',
          borderBottom: 'none',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            color: 'var(--text-on-brand)',
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          <img
            src={LOGO_TAB}
            alt="Ju-Dy"
            style={{
              width: 22,
              height: 22,
              objectFit: 'contain',
            }}
          />
          호가창
        </span>

        {data.is_mock && (
          <span
            style={{
              background: 'var(--bg-card)',
              color: 'var(--brand)',
              fontWeight: 600,
              fontSize: 11,
              padding: '4px 10px',
              border: '1px solid rgba(255, 255, 255, 0.45)',
            }}
          >
            mock
          </span>
        )}
      </div>

      {/* 카드 내용 영역 */}
      <div style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>
        {/* 컬럼 레이블 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '70px 1fr 46px',
            gap: 4,
            paddingBottom: 4,
            marginBottom: 10,
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'left', paddingLeft: 25, }}>호가</span>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center' }}>잔량</span>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'right',paddingRight: 9 }}>수량</span>
        </div>

        <div
          ref={scrollRef}
          tabIndex={0}
          className="orderbook-scroll-hide"
          style={{
            maxHeight: MAX_H,
            overflowY: 'auto',
            outline: 'none',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {upper > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '70px 1fr',
                alignItems: 'center',
                gap: 4,
                padding: '5px 0',
                marginBottom: 2,
                background: 'rgba(239,68,68,0.12)',
                borderRadius: 4,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--up)', textAlign: 'right' }}>
                {upper.toLocaleString()}
              </span>
              <span style={{ fontSize: 10, color: 'var(--up)', paddingLeft: 6, fontWeight: 700 }}>상한가</span>
            </div>
          )}

          {[...asks].reverse().map((ask, i) => (
            <div
              key={`ask-${i}`}
              style={rowStyle}
              onClick={() => onPriceSelect?.(ask.price)}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.07)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--up)', textAlign: 'right' }}>
                {ask.price.toLocaleString()}
              </span>

              <div style={{ position: 'relative', height: 13, background: 'rgba(239,68,68,0.08)', borderRadius: 2 }}>
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    height: '100%',
                    width: `${Math.round((ask.volume / maxVol) * 100)}%`,
                    background: 'rgba(239,68,68,0.32)',
                    borderRadius: 2,
                  }}
                />
              </div>

              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'right', paddingRight: 12 }}>
                {formatVolume(ask.volume)}
              </span>
            </div>
          ))}

          <div
            ref={midRef}
            style={{
              textAlign: 'center',
              padding: '6px 0',
              margin: '3px 0',
              borderTop: '1px solid var(--color-border-tertiary)',
              borderBottom: '1px solid var(--color-border-tertiary)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--brand)',
              background: 'var(--brand-bg)',
              borderRadius: 2,
            }}
          >
            {currentPrice ? currentPrice.toLocaleString() : '-'}
          </div>

          {bids.map((bid, i) => (
            <div
              key={`bid-${i}`}
              style={rowStyle}
              onClick={() => onPriceSelect?.(bid.price)}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.07)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--down)', textAlign: 'right' }}>
                {bid.price.toLocaleString()}
              </span>

              <div style={{ position: 'relative', height: 13, background: 'rgba(59,130,246,0.08)', borderRadius: 2 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${Math.round((bid.volume / maxVol) * 100)}%`,
                    background: 'rgba(59,130,246,0.32)',
                    borderRadius: 2,
                  }}
                />
              </div>

              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'right', paddingRight: 12 }}>
                {formatVolume(bid.volume)}
              </span>
            </div>
          ))}

          {lower > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '70px 1fr',
                alignItems: 'center',
                gap: 4,
                padding: '5px 0',
                marginTop: 2,
                background: 'rgba(59,130,246,0.12)',
                borderRadius: 4,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--down)', textAlign: 'right' }}>
                {lower.toLocaleString()}
              </span>
              <span style={{ fontSize: 10, color: 'var(--down)', paddingLeft: 6, fontWeight: 700 }}>하한가</span>
            </div>
          )}
        </div>

        {asks.length > 0 && bids.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: 'var(--up)', fontWeight: 600 }}>매도 {askPct}%</span>
              <span style={{ color: 'var(--down)', fontWeight: 600 }}>매수 {bidPct}%</span>
            </div>

            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden',marginBottom: 10 }}>
              <div style={{ width: `${askPct}%`, background: 'var(--up)', opacity: 0.7 }} />
              <div style={{ width: `${bidPct}%`, background: 'var(--down)', opacity: 0.7 }} />
            </div>
          </div>
        )}

        <div
          style={{
            fontSize: 13,
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
            paddingTop: 8,
          }}
        >
          클릭하면 주문가에 자동 입력됩니다
        </div>
      </div>
    </div>
  )
}