import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'

// 오늘 날짜를 YYYY-MM-DD 형식으로
function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// YYYYMMDD → YYYY-MM-DD
function fmtDate(s) {
  if (!s || s.length < 8) return s || ''
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

export default function TodayOrdersWidget({ refreshTrigger, isMock = true }) {
  const today = todayStr()
  const [startDate, setStartDate] = useState(today)
  const [endDate,   setEndDate]   = useState(today)
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (s = startDate, e = endDate) => {
    setLoading(true)
    try {
      const { data } = await api.get(
        `/api/v1/orders/history?is_mock=${isMock}&start_date=${s}&end_date=${e}`
      )
      setOrders(Array.isArray(data) ? data : [])
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, isMock])

  // 화면 진입 + refreshTrigger 변경(매매 발생) 시 자동 갱신 — 항상 오늘로 리셋
  useEffect(() => {
    setStartDate(today)
    setEndDate(today)
    load(today, today)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger, isMock])

  const fmtTime = (t) => {
    if (!t || t.length < 6) return t || ''
    return `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`
  }

  const dateInputStyle = {
    padding: '4px 8px',
    fontSize: 12,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    background: 'var(--color-background-secondary)',
    color: 'var(--color-text-primary)',
    outline: 'none',
  }

  return (
    <div className="card" style={{ minWidth: 0 }}>

      {/* 헤더 + 기간 선택 + 조회 버튼 */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          📋 매매내역
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={e => setStartDate(e.target.value)}
            style={dateInputStyle}
          />
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>~</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={today}
            onChange={e => setEndDate(e.target.value)}
            style={dateInputStyle}
          />
          <button
            onClick={() => load()}
            disabled={loading}
            style={{
              padding: '4px 14px',
              fontSize: 12, fontWeight: 600,
              background: '#0F6E56', color: '#fff',
              border: 'none', borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '조회중...' : '조회'}
          </button>
        </div>
      </div>

      {/* 테이블 */}
      {loading ? (
        <p className="muted">불러오는 중...</p>
      ) : orders.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', padding: '16px 0' }}>
          해당 기간 매매내역이 없습니다.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: 12, color: 'var(--color-text-primary)',
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <Th>일시</Th>
                <Th>종목/유형</Th>
                <Th align="right">가격</Th>
                <Th align="right">수량</Th>
                <Th align="center">상태</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}
                >
                  {/* 일시 */}
                  <td style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 500 }}>{fmtDate(o.order_date)}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
                      {fmtTime(o.order_time)}
                    </div>
                  </td>

                  {/* 종목 / 유형 */}
                  <td style={{ padding: '8px 4px' }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>
                      {o.stock_name || o.stock_code}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: o.order_type === '매수' ? '#ef4444' : '#3b82f6',
                      fontWeight: 600,
                    }}>
                      {o.order_type} {o.filled_qty > 0 ? `${o.filled_qty}주` : `${o.quantity}주`}
                    </div>
                  </td>

                  {/* 가격 */}
                  <td style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 500 }}>
                    {o.price ? o.price.toLocaleString() : '-'}
                  </td>

                  {/* 수량 */}
                  <td style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--color-text-secondary)' }}>
                    {o.filled_qty}/{o.quantity}
                  </td>

                  {/* 상태 배지 */}
                  <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                    <StatusBadge status={o.status} filledQty={o.filled_qty} quantity={o.quantity} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children, align = 'left' }) {
  return (
    <th style={{
      textAlign: align,
      padding: '4px 4px 8px',
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--color-text-secondary)',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  )
}

function StatusBadge({ status, filledQty, quantity }) {
  const isFilled    = status === '체결' || filledQty >= quantity
  const isPartial   = !isFilled && filledQty > 0
  const isPending   = !isFilled && filledQty === 0

  const cfg = isFilled
    ? { bg: '#DCFCE7', color: '#166534', label: '체결' }
    : isPartial
    ? { bg: '#FEF3C7', color: '#92400E', label: '부분체결' }
    : { bg: '#F1F5F9', color: '#64748B', label: '미체결' }

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: cfg.bg,
      color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}
