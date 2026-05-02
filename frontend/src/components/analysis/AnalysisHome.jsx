import { useState, useEffect, useRef } from 'react'
import { api, getGrade } from '../../services/analysisApi.js'
import MetricCard from './shared/MetricCard.jsx'
import ExplainBox from './shared/ExplainBox.jsx'
import Expander   from './shared/Expander.jsx'

export default function AnalysisHome({ stocks, recentTickers, onSelect, onRefreshRecent }) {
  const [stats,     setStats]     = useState(null)
  const [query,     setQuery]     = useState('')
  const [dropdown,  setDropdown]  = useState([])
  const [showDrop,  setShowDrop]  = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    api.marketStats().then(setStats).catch(() => {})
  }, [])

  useEffect(() => {
    if (!query.trim()) { setDropdown([]); setShowDrop(false); return }
    const q = query.trim().toLowerCase()
    const matched = stocks.filter(s =>
      s.stock_name?.toLowerCase().includes(q) ||
      s.ticker?.includes(q) ||
      s.sector?.toLowerCase().includes(q)
    ).slice(0, 40)
    setDropdown(matched)
    setShowDrop(matched.length > 0)
  }, [query, stocks])

  const handleSelect = (ticker) => {
    setQuery(''); setShowDrop(false)
    onSelect(ticker)
  }

  const deleteRecent = async (ticker, e) => {
    e.stopPropagation()
    await api.deleteRecent(ticker)
    onRefreshRecent()
  }

  const clearAllRecent = async () => {
    await api.clearRecent()
    onRefreshRecent()
  }

  const recentStocks = recentTickers.filter(Boolean)

  const EDU_TABS = ['📖 주식이란?', '📊 재무제표 읽기', '🔢 핵심 지표 해설', '⚠️ 투자 위험 이해', '✅ 투자 전 체크리스트']

  return (
    <div>
      <div className="an-hero-card">
        <h1 style={{ margin: 0 }}>🛡️ SafeInvest 종목분석</h1>
        <p style={{ fontSize: 20, margin: '10px 0 0', color: '#dbeafe' }}>
          추천보다 먼저, 위험을 확인하세요.
        </p>
        <p style={{ fontSize: 15, marginTop: 10, color: '#94a3b8' }}>
          초보 투자자가 모르는 종목을 덜컥 사기 전에 재무 안정성·적자 지속·부채·거래량·매출 규모를 쉽게 점검합니다.
        </p>
      </div>

      <ExplainBox
        title="⚠️ 중요 안내"
        body="이 앱은 <b>투자 추천이 아니라 위험 확인 도구</b>입니다. 점수가 높아도 손실이 날 수 있고, 점수가 낮아도 상승할 수 있습니다. 최종 투자 결정은 항상 본인의 책임입니다."
        type="warning"
      />

      <hr className="an-hr" />
      <div className="an-grid-4" style={{ marginBottom: 8 }}>
        <MetricCard title="전체 종목 수" value={stats ? stats.total_stocks.toLocaleString() : '…'} help="상장 종목 전체" />
        <MetricCard title="KOSPI"        value={stats ? stats.kospi_count.toLocaleString()   : '…'} help="유가증권시장" accent="#3b82f6" />
        <MetricCard title="KOSDAQ"       value={stats ? stats.kosdaq_count.toLocaleString()  : '…'} help="코스닥시장"   accent="#22c55e" />
        <MetricCard title="활성 위험 경고" value={stats ? stats.active_warnings.toLocaleString() : '…'} help="is_active=1 기준" accent="#ef4444" />
      </div>

      <hr className="an-hr" />
      <p className="an-section-title">📊 안전점수 등급 기준</p>
      <div className="an-grid-5">
        {[
          { pts: '80~100점', grade: '우수', help: '위험 신호가 적은 편',     accent: '#22c55e' },
          { pts: '65~79점', grade: '양호', help: '대체로 안정, 일부 확인',   accent: '#3b82f6' },
          { pts: '45~64점', grade: '보통', help: '좋은 점·위험 요인 혼재',   accent: '#eab308' },
          { pts: '25~44점', grade: '주의', help: '여러 위험 신호 확인 필요', accent: '#f97316' },
          { pts: '0~24점',  grade: '위험', help: '초보자 매우 신중해야 함',  accent: '#ef4444' },
        ].map(({ pts, grade, help, accent }) => (
          <MetricCard key={grade} title={pts} value={grade} help={help} accent={accent} />
        ))}
      </div>

      <hr className="an-hr" />
      <p className="an-section-title">종목 검색</p>
      <ExplainBox
        title="검색 안내"
        body="종목명 또는 종목코드를 입력하여 검색할 수 있습니다. 한 번 분석했던 종목은 <b>최근 검색 종목</b>에 저장되어 다음에 빠르게 다시 열 수 있습니다."
        type="info"
      />

      {recentStocks.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 17, color: '#dbeafe' }}>최근 검색 종목</span>
            <button className="an-btn-ghost" onClick={clearAllRecent} style={{ fontSize: 13 }}>🗑️ 전체 삭제</button>
          </div>
          <div className="an-recent-grid">
            {recentStocks.map(s => (
              <div key={s.ticker} className="an-recent-item">
                <button className="an-recent-btn" onClick={() => handleSelect(s.ticker)}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{s.stock_name}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{s.ticker} · {s.market}</div>
                </button>
                <button className="an-recent-del" onClick={(e) => deleteRecent(s.ticker, e)} title="삭제">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="an-search-wrapper" style={{ marginTop: 16 }}>
        <input
          ref={inputRef}
          className="an-search-input"
          type="text"
          placeholder="종목명 또는 종목코드를 입력하세요"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => dropdown.length > 0 && setShowDrop(true)}
          onBlur={() => setTimeout(() => setShowDrop(false), 180)}
        />
        {showDrop && (
          <div className="an-search-dropdown">
            {dropdown.map(s => (
              <div key={s.ticker} className="an-search-item" onMouseDown={() => handleSelect(s.ticker)}>
                <span style={{ fontWeight: 700 }}>{s.stock_name}</span>
                <span style={{ color: '#94a3b8', fontSize: 13, marginLeft: 8 }}>
                  {s.ticker} · {s.market} · {s.sector ?? '-'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className="an-hr" />
      <p className="an-section-title">📚 주식 투자 기초 지식 — 초보 투자자 필독</p>
      <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
        이 앱은 투자를 권유하지 않습니다. 데이터를 있는 그대로 전달하여 스스로 판단할 수 있도록 돕습니다.
      </p>

      <div className="an-tab-bar">
        {EDU_TABS.map((t, i) => (
          <button key={i} className={`an-tab-btn${activeTab === i ? ' active' : ''}`} onClick={() => setActiveTab(i)}>{t}</button>
        ))}
      </div>

      <div className="an-glass-card">
        {activeTab === 0 && <EduStock />}
        {activeTab === 1 && <EduFinancial />}
        {activeTab === 2 && <EduIndicators />}
        {activeTab === 3 && <EduRisks />}
        {activeTab === 4 && <EduChecklist />}
      </div>
    </div>
  )
}

function EduStock() {
  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>주식이란 무엇인가요?</h3>
      <p>주식은 <b>기업의 소유권 일부</b>를 나타내는 증서입니다.</p>
      <p style={{ marginTop: 14, fontWeight: 700, color: '#93c5fd' }}>주식을 사면 어떤 일이 생기나요?</p>
      <ul style={{ marginLeft: 20, marginTop: 8, lineHeight: 2 }}>
        <li>🏢 <b>기업이 성장</b>하면 주가가 올라 시세 차익을 얻을 수 있습니다.</li>
        <li>💰 <b>배당금</b>을 받을 수 있습니다.</li>
        <li>📉 <b>기업이 부진</b>하면 주가가 떨어져 손실이 날 수 있습니다.</li>
      </ul>
      <p style={{ marginTop: 14, fontWeight: 700, color: '#93c5fd' }}>주식시장이란?</p>
      <p>주식을 사고파는 시장입니다. 한국에는 <b>코스피(KOSPI)</b>와 <b>코스닥(KOSDAQ)</b> 두 시장이 있습니다.</p>
      <div className="an-warning-box" style={{ marginTop: 16 }}>
        <b>⚠️ 중요한 사실</b><br />주식 투자는 원금 손실이 발생할 수 있습니다.
      </div>
    </div>
  )
}

function EduFinancial() {
  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>재무제표란 무엇인가요?</h3>
      <p>재무제표는 <b>기업의 건강 상태를 보여주는 성적표</b>입니다.</p>
      <p style={{ marginTop: 14, fontWeight: 700, color: '#93c5fd' }}>재무제표 3가지 핵심 문서</p>
      <div className="an-grid-3" style={{ marginTop: 12 }}>
        {[
          { title: '📋 재무상태표', eng: 'Balance Sheet', desc: '기업이 가진 재산(자산)과 빚(부채), 자기 돈(자본)을 보여줍니다.', formula: '자산 = 부채 + 자본' },
          { title: '📈 손익계산서', eng: 'Income Statement', desc: '일정 기간 동안 얼마 벌고 얼마 썼는지 보여줍니다.', formula: '매출액 → 영업이익 → 순이익' },
          { title: '💵 현금흐름표', eng: 'Cash Flow', desc: '실제로 현금이 얼마나 들어오고 나갔는지 보여줍니다.', formula: '' },
        ].map(({ title, eng, desc, formula }) => (
          <div key={title} className="an-info-box" style={{ marginTop: 0 }}>
            <b>{title}</b><br />
            <span style={{ color: '#94a3b8', fontSize: 13 }}>({eng})</span>
            <p style={{ marginTop: 8 }}>{desc}</p>
            {formula && <p style={{ marginTop: 4, color: '#93c5fd', fontWeight: 700 }}>{formula}</p>}
          </div>
        ))}
      </div>
      <p style={{ marginTop: 16, fontWeight: 700, color: '#93c5fd' }}>💡 재무제표 보는 순서 (초보자 추천)</p>
      <ol style={{ marginLeft: 20, marginTop: 8, lineHeight: 2 }}>
        <li>매출액이 매년 늘고 있나? (성장성)</li>
        <li>영업이익이 플러스인가? (수익성)</li>
        <li>부채비율이 너무 높지 않나? (안전성)</li>
        <li>현금흐름이 플러스인가? (실제 현금 상황)</li>
      </ol>
    </div>
  )
}

function EduIndicators() {
  const items = [
    { name: 'PER (주가수익비율)', eng: 'Price Earnings Ratio', formula: '주가 ÷ 주당순이익(EPS)', desc: '주가가 1년 이익의 몇 배인지 나타냅니다.', caution: '낮을수록 이익 대비 저렴한 편이나, 업종마다 기준이 다릅니다.' },
    { name: 'PBR (주가순자산비율)', eng: 'Price Book-value Ratio', formula: '주가 ÷ 주당순자산(BPS)', desc: '주가가 회사 순자산의 몇 배인지 나타냅니다.', caution: '1 미만이면 장부가보다 싸게 살 수 있다는 의미이나, 이유가 있을 수 있습니다.' },
    { name: 'ROE (자기자본이익률)', eng: 'Return On Equity', formula: '순이익 ÷ 자기자본 × 100', desc: '주주가 맡긴 돈으로 얼마나 이익을 냈는지 보여줍니다.', caution: '높을수록 경영 효율이 좋지만, 부채를 많이 써서 ROE가 높은 경우도 있습니다.' },
    { name: '부채비율', eng: 'Debt Ratio', formula: '부채 ÷ 자본 × 100', desc: '기업이 자기 돈 대비 얼마나 빚을 지고 있는지 나타냅니다.', caution: '일반적으로 200% 이하가 안전하다고 보나 업종마다 다릅니다.' },
  ]
  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>주요 투자 지표 해설</h3>
      <p style={{ color: '#94a3b8', marginBottom: 16 }}>지표는 <b>참고 도구</b>일 뿐, 하나의 숫자만으로 투자 결정을 내리면 안 됩니다.</p>
      {items.map(({ name, eng, formula, desc, caution }) => (
        <Expander key={name} title={`${name} (${eng})`}>
          <p><b>계산법:</b> <code style={{ background: 'rgba(59,130,246,.15)', padding: '2px 6px', borderRadius: 4 }}>{formula}</code></p>
          <p style={{ marginTop: 8 }}><b>쉬운 설명:</b> {desc}</p>
          <div className="an-warning-box" style={{ marginTop: 8 }}><b>⚠️ 주의:</b> {caution}</div>
        </Expander>
      ))}
    </div>
  )
}

function EduRisks() {
  const items = [
    { icon: '🔴', title: '자본잠식', desc: '기업의 손실이 누적되어 자본금이 줄어드는 상태입니다.', caution: '자본잠식률 50% 이상이면 관리종목 지정, 완전자본잠식이면 상장폐지 위험이 있습니다.' },
    { icon: '🟠', title: '높은 부채비율', desc: '부채가 자본의 2배(200%)를 넘는 상태입니다.', caution: '경기 침체나 금리 상승 시 이자 부담으로 경영이 어려워질 수 있습니다.' },
    { icon: '🟡', title: '연속 영업손실', desc: '3년 이상 영업이익이 마이너스인 상태입니다.', caution: '본업에서 돈을 못 벌고 있다는 신호로, 관리종목 지정 요건이 됩니다.' },
    { icon: '⚪', title: '매출 감소', desc: '매출액이 지속적으로 줄어드는 추세입니다.', caution: '사업 경쟁력이 약화되고 있다는 신호일 수 있습니다.' },
  ]
  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>주식 투자의 위험 요소 이해하기</h3>
      {items.map(({ icon, title, desc, caution }) => (
        <div key={title} style={{ marginBottom: 16 }}>
          <p style={{ fontWeight: 800, fontSize: 16 }}>{icon} {title}</p>
          <p style={{ color: '#94a3b8', marginTop: 4 }}>의미: {desc}</p>
          <p style={{ color: '#ffd0d0', marginTop: 4 }}>주의사항: {caution}</p>
          <hr className="an-hr" style={{ marginTop: 12 }} />
        </div>
      ))}
      <div className="an-warning-box">
        <b>⚠️ 이 앱의 경고 데이터는 투자 권유가 아닙니다.</b><br />
        경고 표시는 공개 공시 데이터를 기반으로 한 사실 정보입니다.
      </div>
    </div>
  )
}

function EduChecklist() {
  const items = [
    { q: '💰 여유 자금인가요?', a: '생활비, 비상금을 제외한 여유 자금으로만 투자하세요.' },
    { q: '🎯 왜 이 종목에 투자하려 하나요?', a: '누군가의 추천, 커뮤니티 글, SNS만 보고 투자하는 것은 위험합니다.' },
    { q: '📅 얼마나 보유할 계획인가요?', a: '단기 시세 차익을 노리는 투자는 손실 위험이 큽니다.' },
    { q: '📉 손실이 나면 어떻게 할 건가요?', a: '미리 손절 기준을 정해두세요.' },
    { q: '🏢 이 기업의 사업을 이해하나요?', a: '어떻게 돈을 버는지 모르는 기업에는 투자하지 않는 것이 좋습니다.' },
    { q: '📊 최근 재무 데이터를 직접 확인했나요?', a: '위 검색 기능으로 매출, 영업이익, 부채비율 등 실제 숫자를 직접 확인하세요.' },
  ]
  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>✅ 투자 전 스스로 확인하는 체크리스트</h3>
      {items.map(({ q, a }, i) => (
        <Expander key={i} title={`${i + 1}. ${q}`}>
          <p>{a}</p>
        </Expander>
      ))}
      <div className="an-good-box" style={{ marginTop: 16 }}>
        <b>💡 SafeInvest AI 사용 방법</b><br />
        1. 위 검색창에서 관심 있는 종목명 또는 종목코드를 입력하세요.<br />
        2. 재무 데이터, 가격 추이 등 <b>사실 정보</b>를 확인하세요.<br />
        3. 경고 항목이 있다면 그 의미를 위의 '투자 위험 이해' 탭에서 확인하세요.<br />
        4. 모든 판단은 스스로 내리세요.
      </div>
    </div>
  )
}
