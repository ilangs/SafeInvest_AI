import { useState, useEffect } from 'react'
import { api, getGrade, gradeMessage, fmtPrice, fmtPercent, priceChangeColor } from '../../services/analysisApi.js'
import ExplainBox   from './shared/ExplainBox.jsx'
import GradeBadge   from './shared/GradeBadge.jsx'
import TabOverview  from './tabs/TabOverview.jsx'
import TabSafety    from './tabs/TabSafety.jsx'
import TabFinancial from './tabs/TabFinancial.jsx'
import TabPrice     from './tabs/TabPrice.jsx'
import TabTechnical from './tabs/TabTechnical.jsx'
import TabBeginner  from './tabs/TabBeginner.jsx'
import TabAI        from './tabs/TabAI.jsx'

const TABS = ['① 종합진단','② 안전점검','③ 재무분석','④ 가격추이','⑤ 기술적분석','⑥ 초보자 설명','⑦ AI분석']

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
    <div>
      <button className="an-btn-back" onClick={onBack}>← 홈으로 돌아가기</button>
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

  return (
    <div>
      <button className="an-btn-back" onClick={onBack}>← 홈으로 돌아가기</button>

      <div className="an-glass-card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#fff' }}>
              {stock.stock_name}
              {grade && <GradeBadge label={grade.label} style={{ fontSize: 15, marginLeft: 10 }} />}
            </div>
            <div style={{ fontSize: 14, color: '#93a7cb', marginTop: 6 }}>
              코드 {ticker} &nbsp;|&nbsp; {stock.market} &nbsp;|&nbsp; {stock.sector ?? '-'}
            </div>
            <div style={{ marginTop: 14 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: '#f8fbff' }}>{fmtPrice(close)}</span>
              {diff != null && (
                <span style={{ fontSize: 15, color: col, fontWeight: 800, marginLeft: 10 }}>
                  {sign} {fmtPrice(Math.abs(diff))} ({fmtPercent(pct)})
                </span>
              )}
            </div>
          </div>
          {score && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#9cb0d3', fontSize: 13, fontWeight: 700 }}>안전점수</div>
              <div style={{ fontSize: 52, fontWeight: 950, color: grade.color, lineHeight: 1 }}>
                {score.final_score.toFixed(0)}
              </div>
              <div style={{ color: grade.color, fontSize: 18, fontWeight: 900 }}>점 / 100점</div>
            </div>
          )}
        </div>
      </div>

      {score && (
        <ExplainBox
          title="📌 한 줄 요약"
          body={gradeMessage(score.final_score, stock.stock_name)}
          type={score.final_score >= 65 ? 'good' : score.final_score < 45 ? 'warning' : 'info'}
        />
      )}

      <ExplainBox
        title="⚠️ 투자 유의사항"
        body="이 앱은 투자 추천 서비스가 아닙니다. 안전점수는 재무·거래 위험의 참고 지표일 뿐이며, 점수가 높아도 손실이 날 수 있고 점수가 낮아도 상승할 수 있습니다. 최종 투자 결정은 본인의 책임입니다."
        type="warning"
      />

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
          {activeTab === 5 && <TabBeginner />}
          {activeTab === 6 && <TabAI         ticker={ticker}    stock={stock} score={score} />}
        </div>
      )}
    </div>
  )
}
