import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'

const LOGO_TAB = '/logo-tab.png'

export default function HoldingsWidget({ refreshKey, refreshTrigger, isMock = true }) {
  refreshKey = refreshKey ?? refreshTrigger

  const [holdings, setHoldings] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const { data } = await api.get(`/api/v1/account/holdings?is_mock=${isMock}`)
      setHoldings(data)
    } catch {
      setHoldings([])
    } finally {
      setLoading(false)
    }
  }, [isMock])

  useEffect(() => {
    load()
  }, [load, refreshKey, isMock])

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
          background: '#2f6f4f',
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
            color: '#ffffff',
            fontWeight: 700,
            fontSize: 15,
            whiteSpace: 'nowrap',
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
          보유종목
        </span>

        <button
          className="btn-sm"
          onClick={load}
          style={{
            background: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.45)',
            color: '#2f6f4f',
            fontWeight: 600,
            boxShadow: 'none',
            fontSize: 11,
            padding: '4px 10px',
          }}
        >
          새로고침
        </button>
      </div>

      {loading ? (
        <p className="muted">불러오는 중...</p>
      ) : holdings.length === 0 ? (
        <p className="muted empty-hint">보유 종목이 없습니다.</p>
      ) : (
        <div className="holdings-scroll">
          <table
            className="holdings-table"
            style={{
              fontSize: 13,
            }}
          >
            <thead>
              <tr>
                <th>종목</th>
                <th>수량</th>
                <th>평균가</th>
                <th>현재가</th>
                <th>손익</th>
                <th>수익률</th>
              </tr>
            </thead>

            <tbody>
              {holdings.map(h => {
                const plColor =
                  h.profit_loss > 0
                    ? '#ef4444'
                    : h.profit_loss < 0
                      ? '#3b82f6'
                      : '#9ca3af'

                const prefix = h.profit_loss > 0 ? '+' : ''

                return (
                  <tr key={h.stock_code}>
                    <td>
                      <span className="h-name">{h.stock_name}</span>
                      <br />
                      <span className="muted">{h.stock_code}</span>
                    </td>

                    <td>{h.quantity.toLocaleString()}</td>
                    <td>{h.avg_price.toLocaleString()}</td>
                    <td>{h.current_price.toLocaleString()}</td>
                    <td style={{ color: plColor }}>
                      {prefix}{h.profit_loss.toLocaleString()}
                    </td>
                    <td style={{ color: plColor }}>
                      {prefix}{h.profit_loss_rate.toFixed(2)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
