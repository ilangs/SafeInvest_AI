import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'

const LOGO_TAB = '/logo-tab.png'

function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function fmtDate(s) {
  if (!s || s.length < 8) return s || ''
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

export default function TodayOrdersWidget({ refreshTrigger, isMock = true }) {
  const today = todayStr()

  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [orders, setOrders] = useState([])
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

  useEffect(() => {
    const prevMonth = new Date()
    prevMonth.setMonth(prevMonth.getMonth() - 1)

    const prevMonthStr = prevMonth.toISOString().slice(0, 10)
    
    setStartDate(prevMonthStr)
    setEndDate(today)
    load(prevMonthStr, today)
  }, [refreshTrigger, isMock])

  const fmtTime = (t) => {
    if (!t || t.length < 6) return t || ''
    return `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`
  }

  const dateInputStyle = {
    padding: 0,
    fontSize: 15,
    fontWeight: 800,
    border: 'none',
    background: 'transparent',
    color: '#ffffff',
    outline: 'none',
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
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="card-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#2f6f4f',
          padding: '15px 14px',
          margin: '-16px -16px 5px -16px',
          borderBottom: 'none',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            color: '#ffffff',
            fontWeight: 700,
            fontSize: 15,
            whiteSpace: 'nowrap',
          }}
        >
          <img
            src={LOGO_TAB}
            alt="Ju-Dy"
            style={{ width: 22, height: 22, objectFit: 'contain' }}
          />
          매매내역
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={e => setStartDate(e.target.value)}
            style={dateInputStyle}
          />

          <span style={{ fontSize: 15, color: '#ffffff' }}>~</span>

          <input
            type="date"
            value={endDate}
            min={startDate}
            max={today}
            onChange={e => setEndDate(e.target.value)}
            style={dateInputStyle}
          />

          <button
            className="btn-sm"
            onClick={() => load()}
            disabled={loading}
            style={{
              background: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.45)',
              color: '#2f6f4f',
              fontWeight: 600,
              boxShadow: 'none',
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '조회중...' : '조회'}
          </button>
        </div>
      </div>

      <div
        className="holdings-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowX: 'auto',
          overflowY: 'auto',
        }}
      >
        {loading ? (
          <p className="muted">불러오는 중...</p>
        ) : orders.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: '16px 0' }}>
            해당 기간 매매내역이 없습니다.
          </p>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
              color: 'var(--color-text-primary)',
            }}
          >
            <thead>
              <tr>
                <Th>일시</Th>
                <Th>종목/유형</Th>
                <Th align="right">가격</Th>
                <Th align="center">수량</Th>
                <Th align="center">상태</Th>
              </tr>
            </thead>

            <tbody>
              {orders.map((o, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: '0.5px solid rgba(45,63,92,0.18)' }}
                >
                  <td style={{ padding: '0.35rem 1rem', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 500 }}>{fmtDate(o.order_date)}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {fmtTime(o.order_time)}
                    </div>
                  </td>

                  <td style={{ padding: '0.35rem 1rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>
                      {o.stock_name || o.stock_code}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: o.order_type === '매수' ? '#ef4444' : '#3b82f6',
                        fontWeight: 600,
                      }}
                    >
                      {o.order_type} {o.filled_qty > 0 ? `${o.filled_qty}주` : `${o.quantity}주`}
                    </div>
                  </td>

                  <td style={{ textAlign: 'right', padding: '0.35rem 0.8rem', fontWeight: 500 }}>
                    {o.price ? o.price.toLocaleString() : '-'}
                  </td>

                  <td style={{ textAlign: 'center', padding: '0.35rem 0.6rem', color: 'var(--color-text-secondary)' }}>
                    {o.filled_qty}/{o.quantity}
                  </td>

                  <td style={{ textAlign: 'center', padding: '0.35rem 0.6rem' }}>
                    <StatusBadge
                      status={o.status}
                      filledQty={o.filled_qty}
                      quantity={o.quantity}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Th({ children, align = 'left' }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: '0.4rem 1rem',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        whiteSpace: 'nowrap',
        // 스크롤 시 헤더 고정 (HoldingsWidget과 동일 패턴)
        position: 'sticky',
        top: 0,
        zIndex: 1,
        background: 'var(--color-background-primary, #fff)',
        borderBottom: '0.5px solid rgba(45,63,92,0.18)',
      }}
    >
      {children}
    </th>
  )
}

function StatusBadge({ status, filledQty, quantity }) {
  const isFilled = status === '체결' || filledQty >= quantity
  const isPartial = !isFilled && filledQty > 0

  const cfg = isFilled
    ? { bg: '#E8F3EE', color: '#2f6f4f', border: '#C7DED3', label: '체결' }
    : isPartial
      ? { bg: '#FEF3C7', color: '#92400E', border: '#F3D38A', label: '부분체결' }
      : { bg: '#F1F5F9', color: '#64748B', border: '#D7DEE7', label: '미체결' }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  )
}