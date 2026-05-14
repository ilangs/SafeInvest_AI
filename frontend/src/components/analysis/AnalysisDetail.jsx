import { useState, useEffect } from 'react'
import { api, getGrade, gradeMessage, fmtPrice, fmtPercent, priceChangeColor } from '../../services/analysisApi.js'
import GradeBadge   from './shared/GradeBadge.jsx'
import TabOverview  from './tabs/TabOverview.jsx'
import TabSafety    from './tabs/TabSafety.jsx'
import TabFinancial from './tabs/TabFinancial.jsx'
import TabPrice     from './tabs/TabPrice.jsx'
import TabTechnical from './tabs/TabTechnical.jsx'


const TABS = ['① 종합진단','② 안전점검','③ 재무분석','④ 가격추이 ','⑤ 기술적분석']

export default function AnalysisDetail({ ticker, stocks, onBack }) {
  const [activeTab, setActiveTab] = useState(0)
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)

  const stock = stocks.find(s => s.ticker === ticker)

  useEffect(() => {
    setLoading(true); setActiveTab(0)
    Promise.all([
      api.stockScore(ticker),
      api.stockFinancials(ticker),
      api.stockPrices(ticker),
      api.stockWarnings(ticker),
      api.latestPrice(ticker),
    ]).then(([score, financials, prices, warnings, latestP]) => {
      setData({ score, financials, prices, warnings, latestP })
    }).catch(console.error)
     .finally(() => setLoading(false))
  }, [ticker])

  if (!stock) return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <button
        className="an-btn-back"
        onClick={onBack}
        style={{
          background: '#fdfdfd',
          color: '#2f5f43',
          border: '1px solid rgba(47, 95, 67, 0.22)',
          borderRadius: 10,
          padding: '10px 16px',
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
          marginBottom: 10,
        }}
      >
        ← Market Home
      </button>
      <div className="an-warning-box">종목 정보를 찾을 수 없습니다.</div>
    </div>
  )

  const { score, financials, prices, warnings, latestP } = data ?? {}
  const grade = score ? getGrade(score.final_score) : null

  const close = latestP?.close
  const prev  = latestP?.prev_close
  const diff  = (close != null && prev != null) ? close - prev : null
  const pct   = (diff != null && prev) ? diff / prev * 100 : null
  const sign  = diff > 0 ? '▲' : diff < 0 ? '▼' : '-'
  const col   = priceChangeColor(diff)

  const stockName = stock.stock_name || stock.name || ticker

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <button
        className="an-btn-back"
        onClick={onBack}
        style={{
          background: '#fdfdfd',
          color: '#2f5f43',
          border: '1px solid rgba(47, 95, 67, 0.22)',
          borderRadius: 10,
          padding: '10px 16px',
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
          marginBottom: 10,
        }}
      >
        ← Market Home
      </button>

      <div
        className="an-glass-card"
        style={{
          marginBottom: 18,
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          padding: '23px 24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 38, fontWeight: 800, color: '#000000', letterSpacing: '-0.02em' }}>
              <span style={{ letterSpacing: '0.02em' }}>{stockName}</span>
              {grade && <GradeBadge label={grade.label} style={{ fontSize: 15, marginLeft: 10, padding: '5px 10px',}} />}
            </div>

            <div style={{ fontSize: 14, color: '#5f6f86', marginTop: 8, fontWeight: 700 }}>
              코드 {ticker} &nbsp;|&nbsp; {stock.market} &nbsp;|&nbsp; {stock.sector ?? '-'}
            </div>

            <div style={{ marginTop: 9, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 34, fontWeight: 950, color: '#1f2937', letterSpacing: '-0.03em' }}>
                {fmtPrice(close)}
              </span>

              {diff != null && (
                <span style={{ fontSize: 16, color: col, fontWeight: 900 }}>
                  {sign} {fmtPrice(Math.abs(diff))} ({fmtPercent(pct)})
                </span>
              )}
            </div>
          </div>

          {score && (
            <div style={{ textAlign: 'right', minWidth: 120 }}>
              <div style={{ color: '#5f6f86', fontSize: 13, fontWeight: 800 }}>안전점수</div>
              <div style={{ fontSize: 54, fontWeight: 950, color: grade.color, lineHeight: 1 }}>
                {score.final_score.toFixed(0)}
              </div>
              <div style={{ color: grade.color, fontSize: 18, fontWeight: 900 }}>점 / 100점</div>
            </div>
          )}
        </div>
      </div>

      {score && (
        <div
          style={{
            background: '#f2faf4',
            border: '1px solid rgba(47, 95, 67, 0.18)',
            borderRadius: 14,
            padding: '18px 20px',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <img
              src="/logo-tab.png"
              alt="Ju-Dy"
              style={{
                width: 22,
                height: 22,
                objectFit: 'contain',
              }}
            />
            <strong style={{ color: '#2f5f43', fontSize: 15 }}>
              Check Point
            </strong>
          </div>

          <div style={{ color: '#26352c', fontSize: 15, lineHeight: 1.7 }}>
            <strong>{stockName}</strong> : {gradeMessage(score.final_score, stockName).replace(`<b>${stockName}</b>:`, '').replace(`${stockName}:`, '').trim()}
          </div>
        </div>
      )}

      <div className="an-tab-bar" style={{ marginTop: 24 }}>
        {TABS.map((t, i) => (
          <button key={i} className={`an-tab-btn${activeTab === i ? ' active' : ''}`} onClick={() => setActiveTab(i)}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="an-loading"><div className="an-spinner" /><p>데이터 로딩 중...</p></div>
      ) : (
        <div>
          {activeTab === 0 && <TabOverview   score={score}      financials={financials} warnings={warnings} />}
          {activeTab === 1 && <TabSafety     score={score}      warnings={warnings} />}
          {activeTab === 2 && <TabFinancial  financials={financials} />}
          {activeTab === 3 && <TabPrice      prices={prices}    score={score} />}
          {activeTab === 4 && <TabTechnical  prices={prices} />}
          {activeTab === 5 && <TabAI         ticker={ticker}    stock={stock} score={score} />}
        </div>
      )}
    </div>
  )
}