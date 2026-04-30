import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'

const TABS = [
  { key: 'ccld',    label: '체결' },
  { key: 'pending', label: '미체결' },
]

export default function TodayOrdersWidget({ refreshTrigger, isMock = true }) {
  const [tab,     setTab]     = useState('ccld')
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(
        `/api/v1/orders/today?is_mock=${isMock}&order_status=${tab}`
      )
      setOrders(Array.isArray(data) ? data : [])
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [tab, isMock])

  useEffect(() => { load() }, [load, refreshTrigger])

  const fmtTime = (t) => {
    if (!t || t.length < 6) return t || ''
    return `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`
  }

  return (
    <div className="card" style={{ minWidth: 0 }}>

      {/* 헤더 + 탭 */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 10,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          📋 당일 주문내역
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '3px 12px',
                borderRadius: 20,
                border: 'none',
                fontSize: 12,
                fontWeight: tab === t.key ? 700 : 400,
                background: tab === t.key ? '#0A3D62' : 'var(--color-background-tertiary)',
                color:      tab === t.key ? '#fff'    : 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
          <button className="btn-sm" onClick={load} style={{ marginLeft: 4 }}>새로고침</button>
        </div>
      </div>

      {/* 테이블 */}
      {loading ? (
        <p className="muted">불러오는 중...</p>
      ) : orders.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', padding: '16px 0' }}>
          {tab === 'ccld' ? '체결된 주문이 없습니다.' : '미체결 주문이 없습니다.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: 12, color: 'var(--color-text-primary)',
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
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
                      {o.order_time ? ` · ${fmtTime(o.order_time)}` : ''}
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
