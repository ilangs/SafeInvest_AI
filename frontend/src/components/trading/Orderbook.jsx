import { useEffect, useState, useCallback, useRef } from 'react'
import api from '../../services/api'
import { formatVolume } from '../../utils/format'

// 행 높이: padding 4px×2 + line-height ~18px = 26px (실측 기준)
const ROW_H  = 26
const MID_H  = 36   // 현재가 행 (padding 6px×2 + font 14px + margin 3px×2)
// 초기 표시 = 5행(asks) + 현재가 + 5행(bids)
const MAX_H  = ROW_H * 5 + MID_H + ROW_H * 5   // 296px

export default function Orderbook({ symbol, currentPrice, onPriceSelect, isMock = true }) {
  const [data,   setData]   = useState({ asks: [], bids: [] })
  const [limits, setLimits] = useState({ upper: 0, lower: 0 })

  const scrollRef   = useRef(null)
  const midRef      = useRef(null)
  const scrolledKey = useRef(null)
  // 요청 ID: 종목 변경 시 증가 → 이전 in-flight 응답을 무시하는 데 사용
  const reqIdRef    = useRef(0)

  /* ── 종목 변경 시 즉시 초기화 + 이전 in-flight 요청 무효화 ── */
  useEffect(() => {
    reqIdRef.current += 1        // 이전 요청의 응답이 도착해도 setData 하지 않도록 ID 변경
    setData({ asks: [], bids: [] })
    setLimits({ upper: 0, lower: 0 })
    scrolledKey.current = null
  }, [symbol])

  /* ── 호가 폴링 ──────────────────────────────────────────── */
  const load = useCallback(async () => {
    if (!symbol) return
    const myReqId = ++reqIdRef.current   // 이 요청 고유 ID 획득
    try {
      const res = await api.get(
        `/api/v1/market/orderbook?symbol=${symbol}&is_mock=${isMock}`
      )
      // 이 응답이 가장 최신 요청인 경우에만 상태 반영
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

  /* ── 상한가 / 하한가: 종목 변경 시에만 조회 ─────────────── */
  useEffect(() => {
    if (!symbol) return
    setLimits({ upper: 0, lower: 0 })   // 종목 전환 시 초기화
    api.get(`/api/v1/market/info?symbol=${symbol}&is_mock=${isMock}`)
      .then(res => setLimits({
        upper: res.data?.upper_limit || 0,
        lower: res.data?.lower_limit || 0,
      }))
      .catch(() => {})
  }, [symbol, isMock])

  /* ── 현재가 행 중앙 정렬 (종목·모드 변경 시 1회) ────────── */
  useEffect(() => {
    if (!data.asks?.length) return
    const key = `${symbol}:${isMock}`
    if (scrolledKey.current === key) return

    // 레이아웃 완료 후 getBoundingClientRect로 정확한 위치 계산
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      const el  = scrollRef.current
      const mid = midRef.current
      if (!el || !mid) return
      const elRect  = el.getBoundingClientRect()
      const midRect = mid.getBoundingClientRect()
      el.scrollTop += midRect.top - elRect.top - (el.clientHeight - mid.offsetHeight) / 2
      scrolledKey.current = key
    }))
    return () => cancelAnimationFrame(id)
  }, [data, symbol, isMock])

  /* ── 렌더 데이터 ─────────────────────────────────────────── */
  const asks  = data.asks || []
  const bids  = data.bids || []
  const upper = limits.upper
  const lower = limits.lower
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

  /* ── 매도/매수 총 잔량 비율 ──────────────────────────────── */
  const totalAsk = asks.reduce((s, a) => s + a.volume, 0)
  const totalBid = bids.reduce((s, b) => s + b.volume, 0)
  const total    = totalAsk + totalBid || 1
  const askPct   = Math.round(totalAsk / total * 100)
  const bidPct   = 100 - askPct

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      borderRadius: 'var(--border-radius-md)',
      padding: '10px 10px 8px',
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

      {/* ── 스크롤 영역 ─────────────────────────────────────
          maxHeight = ROW_H×5 + MID_H + ROW_H×5 = 296px
          초기: 5+현재가+5 표시 / 스크롤: 10+상한가, 10+하한가 노출
          스크롤바는 시각적으로 숨김 (휠/키보드 스크롤은 유지)  */}
      <div
        ref={scrollRef}
        tabIndex={0}
        className="orderbook-scroll-hide"
        style={{
          maxHeight:        MAX_H,
          overflowY:        'auto',
          flexShrink:       0,
          outline:          'none',
          scrollbarWidth:   'none',     /* Firefox */
          msOverflowStyle:  'none',     /* IE / 구 Edge */
        }}
      >

        {/* 상한가 */}
        {upper > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: '70px 1fr',
            alignItems: 'center', gap: 4,
            padding: '5px 0', marginBottom: 2,
            background: 'rgba(239,68,68,0.12)', borderRadius: 4,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', textAlign: 'right' }}>
              {upper.toLocaleString()}
            </span>
            <span style={{ fontSize: 10, color: '#ef4444', paddingLeft: 6, fontWeight: 700 }}>상한가</span>
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
                background: 'rgba(239,68,68,0.32)', borderRadius: 2,
              }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
              {formatVolume(ask.volume)}
            </span>
          </div>
        ))}

        {/* 현재가 구분선 */}
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
                background: 'rgba(59,130,246,0.32)', borderRadius: 2,
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
            background: 'rgba(59,130,246,0.12)', borderRadius: 4,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6', textAlign: 'right' }}>
              {lower.toLocaleString()}
            </span>
            <span style={{ fontSize: 10, color: '#3b82f6', paddingLeft: 6, fontWeight: 700 }}>하한가</span>
          </div>
        )}
      </div>

      {/* 매도/매수 총 잔량 비율 바 */}
      {asks.length > 0 && bids.length > 0 && (
        <div style={{ flexShrink: 0, marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>매도 {askPct}%</span>
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>매수 {bidPct}%</span>
          </div>
          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${askPct}%`, background: '#ef4444', opacity: 0.7 }} />
            <div style={{ width: `${bidPct}%`, background: '#3b82f6', opacity: 0.7 }} />
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} /> {/* 남은 공간 채우기 */}

      <div style={{ flexShrink: 0, fontSize: 10, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
        클릭하면 주문가에 자동 입력됩니다
      </div>
    </div>
  )
}
