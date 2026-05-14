import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'

export default function BalanceWidget({ refreshKey, refreshTrigger, onBalanceLoad, isMock = true, kisReady = true }) {
  refreshKey = refreshKey ?? refreshTrigger // 두 prop 모두 지원

  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)
  // KIS 토큰 워밍업 지연 대응 — 첫 응답의 예수금/평가금액이 모두 0이면 1회 재시도
  const autoRetried = useRef(false)
  const retryTimer = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const { data } = await api.get(`/api/v1/account/balance?is_mock=${isMock}`)
      setBalance(data)
      onBalanceLoad?.(data.available ?? 0)

      // 모든 금액이 0이면 워밍업 지연으로 판단 → 1회 재시도
      const allZero = (data?.deposit ?? 0) === 0
                   && (data?.available ?? 0) === 0
                   && (data?.total_eval ?? 0) === 0
      if (allZero && !autoRetried.current) {
        autoRetried.current = true
        clearTimeout(retryTimer.current)
        retryTimer.current = setTimeout(() => { load() }, 1500)
      }
    } catch {
      setBalance(null)
    } finally {
      setLoading(false)
    }
  }, [onBalanceLoad, isMock])

  // kisReady=false 동안엔 호출하지 않음 (credentials 확인 전 잘못된 환경 조회 방지)
  useEffect(() => {
    if (!kisReady) return
    load()
  }, [load, refreshKey, isMock, kisReady])

  useEffect(() => { autoRetried.current = false }, [isMock])
  useEffect(() => () => clearTimeout(retryTimer.current), [])

  const plColor = balance
    ? balance.total_profit_loss > 0 ? '#ef4444' : balance.total_profit_loss < 0 ? '#3b82f6' : '#9ca3af'
    : '#9ca3af'

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
          padding: '14px 14px',
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
          }}
        >
          <img
            src="/logo-tab.png"
            alt="Ju-Dy"
            style={{
              width: 22,
              height: 22,
              objectFit: 'contain',
            }}
          />
          잔고 현황
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

      {/* 카드 내용 영역 */}
      {loading ? (
        <p className="muted" style={{ marginTop: 4 }}>불러오는 중...</p>
      ) : !balance ? (
        <p className="muted" style={{ marginTop: 4 }}>잔고를 불러올 수 없습니다.</p>
      ) : (
        <dl
          className="balance-list"
          style={{
            fontSize: 12,
            lineHeight: 1.2,
            marginTop: 6,
          }}
        >
          <div className="balance-row">
            <dt style={{ fontSize: 12 }}>예수금</dt>
            <dd style={{ fontSize: 12, fontWeight: 500 }}>
              {balance.deposit.toLocaleString()}원
            </dd>
          </div>

          <div className="balance-row">
            <dt style={{ fontSize: 12 }}>매수가능금액</dt>
            <dd
              className="highlight"
              style={{
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {balance.available.toLocaleString()}원
            </dd>
          </div>

          <div className="balance-row">
            <dt style={{ fontSize: 12 }}>평가금액</dt>
            <dd style={{ fontSize: 12, fontWeight: 500 }}>
              {balance.total_eval.toLocaleString()}원
            </dd>
          </div>

          <div className="balance-row">
            <dt style={{ fontSize: 12 }}>총손익</dt>
            <dd
              style={{
                color: plColor,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {balance.total_profit_loss > 0 ? '+' : ''}
              {balance.total_profit_loss.toLocaleString()}원
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}