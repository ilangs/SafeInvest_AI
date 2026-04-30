import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'

export default function BalanceWidget({ refreshKey, refreshTrigger, onBalanceLoad, isMock = true }) {
  refreshKey = refreshKey ?? refreshTrigger  // 두 prop 모두 지원
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/api/v1/account/balance?is_mock=${isMock}`)
      setBalance(data)
      onBalanceLoad?.(data.available ?? 0)   // 매수가능금액을 부모로 전달
    } catch {
      setBalance(null)
    } finally {
      setLoading(false)
    }
  }, [onBalanceLoad, isMock])

  useEffect(() => { load() }, [load, refreshKey, isMock])

  const plColor = balance
    ? balance.total_profit_loss > 0 ? '#ef4444' : balance.total_profit_loss < 0 ? '#3b82f6' : '#9ca3af'
    : '#9ca3af'

  return (
    <div className="card">
      <div className="card-header">
        <span>💰 잔고 현황</span>
        <button className="btn-sm" onClick={load}>새로고침</button>
      </div>
      {loading ? (
        <p className="muted">불러오는 중...</p>
      ) : !balance ? (
        <p className="muted">잔고를 불러올 수 없습니다.</p>
      ) : (
        <dl className="balance-list">
          <div className="balance-row">
            <dt>예수금</dt>
            <dd>{balance.deposit.toLocaleString()}원</dd>
          </div>
          <div className="balance-row">
            <dt>매수가능금액</dt>
            <dd className="highlight">{balance.available.toLocaleString()}원</dd>
          </div>
          <div className="balance-row">
            <dt>평가금액</dt>
            <dd>{balance.total_eval.toLocaleString()}원</dd>
          </div>
          <div className="balance-row">
            <dt>총손익</dt>
            <dd style={{ color: plColor }}>
              {balance.total_profit_loss > 0 ? '+' : ''}{balance.total_profit_loss.toLocaleString()}원
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}
