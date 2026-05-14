import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'

const LOGO_TAB = '/logo-tab.png'

export default function StockInfoWidget({ symbol, currentPrice, isMock = true }) {
  const [info, setInfo]       = useState(null)
  const [loading, setLoading] = useState(true)
  const reqIdRef              = useRef(0)

  // 종목 변경 시 즉시 비우기 + 이전 요청 무효화
  useEffect(() => {
    reqIdRef.current += 1
    setInfo(null)
  }, [symbol])

  const load = useCallback(async () => {
    if (!symbol) return
    const myReq = ++reqIdRef.current
    setLoading(true)

    try {
      const { data } = await api.get(`/api/v1/market/info?symbol=${symbol}&is_mock=${isMock}`)
      if (myReq !== reqIdRef.current) return
      setInfo(data)
    } catch {
      if (myReq === reqIdRef.current) setInfo(null)
    } finally {
      if (myReq === reqIdRef.current) setLoading(false)
    }
  }, [symbol, isMock])

  useEffect(() => { load() }, [load])

  // 52주 범위 내 현재가 위치 계산
  const rangePos = () => {
    if (!info || !info.w52_high || !info.w52_low) return 50
    const price = currentPrice ?? info.current_price ?? 0
    const range = info.w52_high - info.w52_low
    if (range === 0) return 50
    return Math.min(100, Math.max(0, Math.round(((price - info.w52_low) / range) * 100)))
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
          투자 정보
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

      {/* 카드 내용 영역 */}
      {loading ? (
        <p className="muted" style={{ marginTop: 4 }}>불러오는 중...</p>
      ) : !info ? (
        <p className="muted" style={{ marginTop: 4 }}>정보를 불러올 수 없습니다.</p>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--color-text-primary)',}}>

          {/* 주요 지표 */}
          <table style={{ width: '100%', borderCollapse: 'collapse', lineHeight: 1.85 }}>
            <tbody>
              <InfoRow label="시가총액" value={info.market_cap || '-'} />
              <InfoRow
                label="상한가"
                value={info.upper_limit ? info.upper_limit.toLocaleString() : '-'}
                valueStyle={{ color: 'var(--up)', fontWeight: 600 }}
              />
              <InfoRow
                label="하한가"
                value={info.lower_limit ? info.lower_limit.toLocaleString() : '-'}
                valueStyle={{ color: 'var(--down)', fontWeight: 600 }}
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
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
              52주 범위
            </div>

            <div style={{ position: 'relative', height: 6, borderRadius: 3 }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to right, var(--down), var(--brand-bright), var(--up))',
                  borderRadius: 3,
                }}
              />

              {/* 현재가 마커 */}
              <div
                style={{
                  position: 'absolute',
                  left: `${rangePos()}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: 'var(--bg-card)',
                  border: '2px solid var(--brand-dim)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                  zIndex: 2,
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 5,
                fontSize: 11,
                color: 'var(--color-text-secondary)',
              }}
            >
              <span>{info.w52_low ? info.w52_low.toLocaleString() : '-'}</span>
              <span style={{ color: 'var(--brand-dim)', fontWeight: 700 }}>
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