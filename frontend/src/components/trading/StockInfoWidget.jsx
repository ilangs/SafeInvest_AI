import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'

export default function StockInfoWidget({ symbol, currentPrice, isMock = true }) {
  const [info, setInfo]       = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!symbol) return
    setLoading(true)
    try {
      const { data } = await api.get(`/api/v1/market/info?symbol=${symbol}&is_mock=${isMock}`)
      setInfo(data)
    } catch {
      setInfo(null)
    } finally {
      setLoading(false)
    }
  }, [symbol, isMock])

  useEffect(() => { load() }, [load])

  // 52주 범위 내 현재가 위치 (0~100%)
  const rangePos = () => {
    if (!info || !info.w52_high || !info.w52_low) return 50
    const price = currentPrice ?? info.current_price ?? 0
    const range = info.w52_high - info.w52_low
    if (range === 0) return 50
    return Math.min(100, Math.max(0, Math.round(((price - info.w52_low) / range) * 100)))
  }

  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div className="card-header">
        <span>📊 투자정보</span>
        <button className="btn-sm" onClick={load}>새로고침</button>
      </div>

      {loading ? (
        <p className="muted">불러오는 중...</p>
      ) : !info ? (
        <p className="muted">정보를 불러올 수 없습니다.</p>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>

          {/* 주요 지표 */}
          <table style={{ width: '100%', borderCollapse: 'collapse', lineHeight: 1.95 }}>
            <tbody>
              <InfoRow label="시가총액" value={info.market_cap || '-'} />
              <InfoRow
                label="상한가"
                value={info.upper_limit ? info.upper_limit.toLocaleString() : '-'}
                valueStyle={{ color: '#ef4444', fontWeight: 600 }}
              />
              <InfoRow
                label="하한가"
                value={info.lower_limit ? info.lower_limit.toLocaleString() : '-'}
                valueStyle={{ color: '#3b82f6', fontWeight: 600 }}
              />
              <InfoRow
                label="PER"
                value={info.per ? `${Number(info.per).toFixed(2)}배` : '-'}
              />
              <InfoRow
                label="배당수익률"
                value={info.dividend_yield ? `${Number(info.dividend_yield).toFixed(2)}%` : '-'}
              />
            </tbody>
          </table>

          {/* 52주 범위 슬라이더 */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              52주 범위
            </div>
            <div style={{ position: 'relative', height: 6, borderRadius: 3 }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to right, #3b82f6, #10b981, #ef4444)',
                borderRadius: 3,
              }} />
              {/* 현재가 마커 */}
              <div style={{
                position: 'absolute',
                left: `${rangePos()}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 10, height: 10,
                borderRadius: '50%',
                background: '#fff',
                border: '2px solid #0A3D62',
                boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                zIndex: 2,
              }} />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginTop: 5, fontSize: 11, color: 'var(--color-text-secondary)',
            }}>
              <span>{info.w52_low  ? info.w52_low.toLocaleString()  : '-'}</span>
              <span style={{ color: '#0A3D62', fontWeight: 600 }}>
                {(currentPrice ?? info.current_price ?? 0).toLocaleString()}
              </span>
              <span>{info.w52_high ? info.w52_high.toLocaleString() : '-'}</span>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, valueStyle = {} }) {
  return (
    <tr>
      <td style={{ color: 'var(--color-text-secondary)', paddingRight: 8, whiteSpace: 'nowrap' }}>
        {label}
      </td>
      <td style={{ textAlign: 'right', fontWeight: 500, ...valueStyle }}>
        {value}
      </td>
    </tr>
  )
}
