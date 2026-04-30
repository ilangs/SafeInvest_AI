import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'

export default function HoldingsWidget({ refreshKey, refreshTrigger, isMock = true }) {
  refreshKey = refreshKey ?? refreshTrigger  // 두 prop 모두 지원
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

  useEffect(() => { load() }, [load, refreshKey, isMock])

  return (
    <div className="card">
      <div className="card-header">
        <span>📋 보유종목</span>
        <button className="btn-sm" onClick={load}>새로고침</button>
      </div>
      {loading ? (
        <p className="muted">불러오는 중...</p>
      ) : holdings.length === 0 ? (
        <p className="muted empty-hint">보유 종목이 없습니다.</p>
      ) : (
        <table className="holdings-table">
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
              const plColor = h.profit_loss > 0 ? '#ef4444' : h.profit_loss < 0 ? '#3b82f6' : '#9ca3af'
              const prefix = h.profit_loss > 0 ? '+' : ''
              return (
                <tr key={h.stock_code}>
                  <td><span className="h-name">{h.stock_name}</span><br /><span className="muted">{h.stock_code}</span></td>
                  <td>{h.quantity.toLocaleString()}</td>
                  <td>{h.avg_price.toLocaleString()}</td>
                  <td>{h.current_price.toLocaleString()}</td>
                  <td style={{ color: plColor }}>{prefix}{h.profit_loss.toLocaleString()}</td>
                  <td style={{ color: plColor }}>{prefix}{h.profit_loss_rate.toFixed(2)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
