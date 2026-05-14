import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'

const LOGO_TAB = '/logo-tab.png'

export default function HoldingsWidget({ refreshKey, refreshTrigger, isMock = true, kisReady = true, onHoldingsLoad }) {
  refreshKey = refreshKey ?? refreshTrigger

  const [holdings, setHoldings] = useState([])
  const [loading, setLoading] = useState(true)
  // KIS 토큰 워밍업 지연으로 첫 호출이 빈 응답인 경우 1회 자동 재시도용
  const autoRetried = useRef(false)
  const retryTimer = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const { data } = await api.get(`/api/v1/account/holdings?is_mock=${isMock}`)
      const list = Array.isArray(data) ? data : []
      setHoldings(list)
      onHoldingsLoad?.(list)

      // 첫 호출이 빈 배열이면 한 번만 자동 재시도 (KIS 토큰 워밍업 지연 대응)
      if (list.length === 0 && !autoRetried.current) {
        autoRetried.current = true
        clearTimeout(retryTimer.current)
        retryTimer.current = setTimeout(() => { load() }, 1500)
      }
    } catch {
      setHoldings([])
      onHoldingsLoad?.([])
    } finally {
      setLoading(false)
    }
  }, [isMock, onHoldingsLoad])

  // kisReady=false 동안엔 호출하지 않음
  useEffect(() => {
    if (!kisReady) return
    load()
  }, [load, refreshKey, isMock, kisReady])

  // isMock 변경 시 재시도 카운터 리셋 (모의 ↔ 실거래 전환 대응)
  useEffect(() => {
    autoRetried.current = false
  }, [isMock])

  // 언마운트 시 타이머 정리
  useEffect(() => () => clearTimeout(retryTimer.current), [])

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
            color: 'var(--text-on-brand)',
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
            background: 'var(--bg-card)',
            border: '1px solid rgba(255, 255, 255, 0.45)',
            color: 'var(--brand)',
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
                    ? 'var(--up)'
                    : h.profit_loss < 0
                      ? 'var(--down)'
                      : 'var(--text-muted)'

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
