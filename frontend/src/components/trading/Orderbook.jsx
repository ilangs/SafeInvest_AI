import { useEffect, useState, useCallback, useRef } from 'react'
import api from '../../services/api'
import { formatVolume } from '../../utils/format'

export default function Orderbook({ symbol, currentPrice, onPriceSelect, isMock = true }) {
  const [data, setData] = useState({ asks: [], bids: [], upper_limit: 0, lower_limit: 0 })

  const scrollRef      = useRef(null)
  const midRef         = useRef(null)
  // "종목코드:isMock" 조합 — 어느 하나라도 바뀌면 재중앙정렬
  const scrolledKey    = useRef(null)

  const load = useCallback(async () => {
    if (!symbol) return
    try {
      const res = await api.get(`/api/v1/market/orderbook?symbol=${symbol}&is_mock=${isMock}`)
      setData(res.data)
    } catch (e) {
      console.error('호가 로드 실패:', e)
    }
  }, [symbol, isMock])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load])

  // 종목·모드가 바뀌었을 때만 현재가 행을 중앙으로 스크롤 (폴링 갱신 시에는 건너뜀)
  useEffect(() => {
    if (!data.asks?.length) return
    const key = `${symbol}:${isMock}`
    if (scrolledKey.current === key) return   // 이미 이 조합으로 스크롤했으면 건너뜀

    // rAF 이중 호출: 첫 번째는 React 렌더 완료, 두 번째는 브라우저 레이아웃 완료 보장
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!scrollRef.current || !midRef.current) return
        const el  = scrollRef.current
        const mid = midRef.current
        el.scrollTop = mid.offsetTop - el.clientHeight / 2 + mid.offsetHeight / 2
        scrolledKey.current = key
      })
    })
  }, [data, symbol, isMock])

  const asks  = data.asks  || []
  const bids  = data.bids  || []
  const upper = data.upper_limit || 0
  const lower = data.lower_limit || 0

  const maxVol = Math.max(...asks.map(a => a.volume), ...bids.map(b => b.volume), 1)

  const rowStyle = {
    display: 'grid',
    gridTemplateColumns: '70px 1fr 46px',
    alignItems: 'center',
    gap: 4,
    padding: '4px 0',
    cursor: 'pointer',
    borderRadius: 3,
  }

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      borderRadius: 'var(--border-radius-md)',
      padding: '10px 10px 6px',
      border: '0.5px solid var(--color-border-tertiary)',
      display: 'flex', flexDirection: 'column',
      height: '100%', boxSizing: 'border-box',
    }}>
      {/* 헤더 */}
      <div style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
        호가창
        {data.is_mock && <span style={{ marginLeft: 4, color: '#94a3b8', fontSize: 10 }}>mock</span>}
      </div>

      {/* 컬럼 레이블 */}
      <div style={{
        flexShrink: 0,
        display: 'grid', gridTemplateColumns: '70px 1fr 46px',
        gap: 4, paddingBottom: 4,
        borderBottom: '0.5px solid var(--color-border-tertiary)',
        marginBottom: 2,
      }}>
        <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', textAlign: 'right' }}>호가</span>
        <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', textAlign: 'center' }}>잔량</span>
        <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', textAlign: 'right' }}>수량</span>
      </div>

      {/* 스크롤 영역
          maxHeight = 5행(asks)×21px + 현재가행 32px + 5행(bids)×21px = 242px → 260px 고정
          → 초기에 5+5만 보이고, 스크롤하면 10+10 + 상한가/하한가까지 노출           */}
      <div ref={scrollRef} style={{ maxHeight: 260, overflowY: 'auto' }}>

        {/* 상한가 */}
        {upper > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: '70px 1fr',
            alignItems: 'center', gap: 4,
            padding: '5px 0', marginBottom: 2,
            background: 'rgba(239,68,68,0.10)', borderRadius: 4,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', textAlign: 'right' }}>
              {upper.toLocaleString()}
            </span>
            <span style={{ fontSize: 10, color: '#ef4444', paddingLeft: 6, fontWeight: 600 }}>상한가</span>
          </div>
        )}

        {/* 매도 호가: ask10(맨위) → ask1(현재가 직전) */}
        {[...asks].reverse().map((ask, i) => (
          <div
            key={`ask-${i}`}
            style={rowStyle}
            onClick={() => onPriceSelect?.(ask.price)}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.07)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: 13, fontWeight: 500, color: '#ef4444', textAlign: 'right' }}>
              {ask.price.toLocaleString()}
            </span>
            <div style={{ position: 'relative', height: 13, background: 'rgba(239,68,68,0.08)', borderRadius: 2 }}>
              <div style={{
                position: 'absolute', right: 0, top: 0, height: '100%',
                width: `${Math.round((ask.volume / maxVol) * 100)}%`,
                background: 'rgba(239,68,68,0.30)', borderRadius: 2,
              }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
              {formatVolume(ask.volume)}
            </span>
          </div>
        ))}

        {/* 현재가 중앙 구분선 */}
        <div ref={midRef} style={{
          textAlign: 'center', padding: '6px 0', margin: '3px 0',
          borderTop: '1px solid var(--color-border-tertiary)',
          borderBottom: '1px solid var(--color-border-tertiary)',
          fontSize: 14, fontWeight: 700, color: '#0F6E56',
          background: 'rgba(15,110,86,0.05)', borderRadius: 2,
        }}>
          {currentPrice ? currentPrice.toLocaleString() : '-'}
        </div>

        {/* 매수 호가: bid1(현재가 직후) → bid10(맨아래) */}
        {bids.map((bid, i) => (
          <div
            key={`bid-${i}`}
            style={rowStyle}
            onClick={() => onPriceSelect?.(bid.price)}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.07)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: 13, fontWeight: 500, color: '#3b82f6', textAlign: 'right' }}>
              {bid.price.toLocaleString()}
            </span>
            <div style={{ position: 'relative', height: 13, background: 'rgba(59,130,246,0.08)', borderRadius: 2 }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: `${Math.round((bid.volume / maxVol) * 100)}%`,
                background: 'rgba(59,130,246,0.30)', borderRadius: 2,
              }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
              {formatVolume(bid.volume)}
            </span>
          </div>
        ))}

        {/* 하한가 */}
        {lower > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: '70px 1fr',
            alignItems: 'center', gap: 4,
            padding: '5px 0', marginTop: 2,
            background: 'rgba(59,130,246,0.10)', borderRadius: 4,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6', textAlign: 'right' }}>
              {lower.toLocaleString()}
            </span>
            <span style={{ fontSize: 10, color: '#3b82f6', paddingLeft: 6, fontWeight: 600 }}>하한가</span>
          </div>
        )}
      </div>

      {/* 매도/매수 총 잔량 비율 바 */}
      {asks.length > 0 && bids.length > 0 && (() => {
        const totalAsk = asks.reduce((s, a) => s + a.volume, 0)
        const totalBid = bids.reduce((s, b) => s + b.volume, 0)
        const total    = totalAsk + totalBid || 1
        const askPct   = Math.round(totalAsk / total * 100)
        const bidPct   = 100 - askPct
        return (
          <div style={{ flexShrink: 0, marginTop: 8 }}>
            {/* 비율 수치 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>매도 {askPct}%</span>
              <span style={{ color: '#3b82f6', fontWeight: 600 }}>매수 {bidPct}%</span>
            </div>
            {/* 비율 바 */}
            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${askPct}%`, background: '#ef4444', opacity: 0.7 }} />
              <div style={{ width: `${bidPct}%`, background: '#3b82f6', opacity: 0.7 }} />
            </div>
          </div>
        )
      })()}

      <div style={{ flexShrink: 0, fontSize: 10, color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: 6 }}>
        클릭하면 주문가에 자동 입력됩니다
      </div>
    </div>
  )
}
