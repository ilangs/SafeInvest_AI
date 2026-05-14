import { useState } from 'react'
import './BeginnerGuide.css'
import Logo from '../common/Logo'

const GUIDE_TABS = [
  '📖 주식이란?',
  '📊 재무제표 읽기',
  '🔢 핵심 지표 해설',
  '⚠️ 투자 위험 이해',
  '✅ 투자 전 체크리스트',
]

export default function BeginnerGuide() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <section className="beginner-guide" style={styles.guideWrap}>
      
      <div style={styles.tabBar}>
        {GUIDE_TABS.map((tab, index) => (
          <button
            key={tab}
            style={{
              ...styles.tabButton,
              ...(activeTab === index ? styles.tabButtonActive : {}),
              border: activeTab === index
                ? '1px solid #2f6f4f'
                : '1px solid #dbe5de',
            }}
            onClick={() => setActiveTab(index)}
            onFocus={(e) => e.currentTarget.blur()}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={styles.contentCard}>
        {activeTab === 0 && <EduStock />}
        {activeTab === 1 && <EduFinancial />}
        {activeTab === 2 && <EduIndicators />}
        {activeTab === 3 && <EduRisks />}
        {activeTab === 4 && <EduChecklist />}
      </div>
    </section>
  )
}

function EduStock() {
  return (
    <div>
      <h3 style={styles.contentTitle}>주식이란 무엇인가요?</h3>

      <p style={styles.text}>
        주식은 <b>기업의 소유권 일부</b>를 나타내는 증서입니다.
      </p>
      <p style={styles.text}>
        예를 들어 삼성전자 주식 1주를 사면, 삼성전자라는 회사의 아주 작은 주인이 되는 것입니다.
      </p>

      <p style={styles.pointTitle}>주식을 사면 어떤 일이 생기나요?</p>

      <ul style={styles.list}>
        <li>🏢 <b>기업이 성장</b>하면 주가가 올라 시세 차익을 얻을 수 있습니다.</li>
        <li>💰 <b>배당금</b>을 받을 수 있습니다.</li>
        <li>📉 <b>기업이 부진</b>하면 주가가 떨어져 손실이 날 수 있습니다.</li>
      </ul>

      <p style={styles.pointTitle}>주식시장이란?</p>

      <p style={styles.text}>
        주식을 사고파는 시장입니다. 한국에는 <b>코스피(KOSPI)</b>와 <b>코스닥(KOSDAQ)</b> 두 시장이 있습니다.
      </p>

      <ul style={styles.list}>
        <li>코스피 : 삼성전자, 현대차 등 대형 우량기업 중심입니다.</li>
        <li>코스닥 : 중소·벤처기업 중심, 변동성이 더 큽니다.</li>
      </ul>

      <WarningBox>
        <b>📌 Check point</b>
        <br />
        주식 투자는 원금 손실이 발생할 수 있습니다. 투자 전 반드시 본인의 재정 상황을 점검하세요.
      </WarningBox>
    </div>
  )
}

function EduFinancial() {
  return (
    <div>
      <h3 style={styles.contentTitle}>재무제표란 무엇인가요?</h3>

      <p style={styles.text}>
        재무제표는 <b>기업의 건강 상태를 보여주는 성적표</b>입니다.
      </p>
      <p style={styles.text}>
        병원에서 혈액검사 결과지를 보듯, 투자자는 재무제표로 기업 상태를 확인합니다.
      </p><br></br>
    <div>
    <img
      src="/Beginner.png"
      alt="재무제표 가이드"
      style={{
        width: '100%',
        borderRadius: 18,
        display: 'block',
      }}
    />
  </div>
    </div>
  )
}

function EduIndicators() {
  const items = [
    {
      name: 'PER (주가수익비율)',
      eng: 'Price Earnings Ratio',
      formula: '주가 ÷ 주당순이익(EPS)',
      desc: '주가가 1년 이익의 몇 배인지 나타냅니다. PER 10이면 지금 주가로 투자금을 회수하는 데 10년 걸린다는 의미입니다.',
      caution: '낮을수록 이익 대비 저렴한 편이나, 업종마다 기준이 다릅니다.',
    },
    {
      name: 'PBR (주가순자산비율)',
      eng: 'Price Book-value Ratio',
      formula: '주가 ÷ 주당순자산(BPS)',
      desc: '주가가 회사 순자산의 몇 배인지 나타냅니다. PBR 1이면 주가 = 장부상 자산가치입니다.',
      caution: '1 미만이면 장부가보다 싸게 살 수 있다는 의미이나, 이유가 있을 수 있습니다.',
    },
    {
      name: 'ROE (자기자본이익률)',
      eng: 'Return On Equity',
      formula: '순이익 ÷ 자기자본 × 100',
      desc: '주주가 맡긴 돈으로 얼마나 이익을 냈는지 보여줍니다. ROE 15%면 100원을 맡겼을 때 15원을 벌었다는 뜻입니다.',
      caution: '높을수록 경영 효율이 좋지만, 부채를 많이 써서 ROE가 높은 경우도 있습니다.',
    },
    {
      name: 'EPS (주당순이익)',
      eng: 'Earnings Per Share',
      formula: '순이익 ÷ 발행주식수',
      desc: '주식 1주당 얼마의 이익을 냈는지 보여줍니다.',
      caution: 'EPS가 매년 증가하는 기업은 꾸준히 이익이 늘고 있다는 신호입니다.',
    },
    {
      name: '부채비율',
      eng: 'Debt Ratio',
      formula: '부채 ÷ 자본 × 100',
      desc: '기업이 자기 돈 대비 얼마나 빚을 지고 있는지 나타냅니다.',
      caution: '일반적으로 200% 이하가 안전하다고 보나 업종마다 다릅니다.',
    },
    {
      name: '배당 수익율',
      eng: 'Dividend Yield',
      formula: '주당배당금 ÷ 주가 × 100',
      desc: '주가 대비 배당금 비율입니다. 3%이면 100만원 투자 시 연 3만원의 배당을 받는다는 의미입니다.',
      caution: '높은 배당수익률이 항상 좋은 것은 아닙니다. 주가가 하락해서 비율이 높아지는 경우도 있습니다.',
    },
  ]

  return (
    <div>
      <h3 style={styles.contentTitle}>주요 투자 지표 해설</h3>

      <p style={styles.text}>
        지표는 <b>참고 도구</b>일 뿐, 하나의 숫자만으로 투자 결정을 내리면 안 됩니다.
      </p>

      <div style={styles.accordionList}>
        {items.map(({ name, eng, formula, desc, caution }) => (
          <SimpleAccordion key={name} title={`${name} (${eng})`}>
            <p style={styles.text}>
              <b>계산법 :</b>{' '}
              <code style={styles.code}>{formula}</code>
            </p>
            <p style={styles.text}>
              <b>쉬운 설명 :</b> {desc}
            </p>
            <WarningBox>
              <b>📌 Check point -</b> {caution}
            </WarningBox>
          </SimpleAccordion>
        ))}
      </div>
    </div>
  )
}

function EduRisks() {
  const items = [
    {
      icon: '🔴',
      title: '자본잠식',
      desc: '기업의 손실이 누적되어 자본금이 줄어드는 상태입니다.',
      caution: '자본잠식률 50% 이상이면 관리종목 지정, 완전자본잠식이면 상장폐지 위험이 있습니다.',
    },
    {
      icon: '🟠',
      title: '높은 부채비율',
      desc: '부채가 자본의 2배(200%)를 넘는 상태입니다.',
      caution: '경기 침체나 금리 상승 시 이자 부담으로 경영이 어려워질 수 있습니다.',
    },
    {
      icon: '🟡',
      title: '연속 영업손실',
      desc: '3년 이상 영업이익이 마이너스인 상태입니다.',
      caution: '본업에서 돈을 못 벌고 있다는 신호로, 관리종목 지정 요건이 됩니다.',
    },
    {
      icon: '⚪',
      title: '매출 감소',
      desc: '매출액이 지속적으로 줄어드는 추세입니다.',
      caution: '사업 경쟁력이 약화되고 있다는 신호일 수 있습니다.',
    },
    {
      icon: '🔴',
      title: '거래정지·관리종목',
      desc: '거래소가 투자자 보호를 위해 지정한 종목입니다.',
      caution: '관리종목은 상장폐지 가능성이 높습니다. 투자 시 각별한 주의가 필요합니다.',
    },
  ]

  return (
    <div>
      <h3 style={styles.contentTitle}>주식 투자의 위험 요소 이해하기</h3>

      {items.map(({ icon, title, desc, caution }) => (
        <div key={title} style={styles.riskItem}>
          <p style={styles.riskTitle}>
            {icon} {title}
          </p>
          <p style={styles.mutedText}><strong>Meaning - </strong>{desc}</p>
          <p style={styles.dangerText}><strong>Warning - </strong> {caution}</p>
        </div>
      ))}

      <WarningBox>
        <b>⚠️ 이 앱의 경고 데이터는 투자 권유가 아닙니다.</b>
        <br />
        경고 표시는 공개 공시 데이터를 기반으로 한 사실 정보입니다.
        <br />
        최종 투자 판단은 반드시 본인이 직접 하시기 바랍니다.
      </WarningBox>
    </div>
  )
}

function EduChecklist() {
  const items = [
    {
      q: '💰 여유 자금인가요?',
      a: '생활비, 비상금을 제외한 여유 자금으로만 투자하세요. 필요한 돈으로 투자하면 손실 시 큰 문제가 생깁니다.',
    },
    {
      q: '🎯 왜 이 종목에 투자하려 하나요?',
      a: '누군가의 추천, 커뮤니티 글, SNS만 보고 투자하는 것은 위험합니다. 직접 재무 데이터를 확인하세요.',
    },
    {
      q: '📅 얼마나 보유할 계획인가요?',
      a: '단기 시세 차익을 노리는 투자는 손실 위험이 큽니다. 장기 투자 관점에서 접근하는 것이 일반적으로 안전합니다.',
    },
    {
      q: '📉 손실이 나면 어떻게 할 건가요?',
      a: '미리 손절 기준을 정해두세요. 손실이 날 때 감정적 판단을 하면 손실이 더 커질 수 있습니다.',
    },
    {
      q: '🏢 이 기업의 사업을 이해하나요?',
      a: '어떻게 돈을 버는지 모르는 기업에는 투자하지 않는 것이 좋습니다.',
    },
    {
      q: '📊 최근 재무 데이터를 직접 확인했나요?',
      a: '이 앱의 종목 검색 기능으로 매출, 영업이익, 부채비율 등 실제 숫자를 직접 확인하세요.',
    },
  ]

  return (
    <div>
      <h3 style={styles.contentTitle}>✅ 투자 전 스스로 확인하는 체크리스트</h3>

      <div style={styles.accordionList}>
        {items.map(({ q, a }, i) => (
          <SimpleAccordion key={i} title={`${i + 1}. ${q}`}>
            <p style={styles.text}>{a}</p>
          </SimpleAccordion>
        ))}
      </div>

      <GoodBox>
        <div
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginBottom: -15,
  }}
>
  <Logo size={22} />
  <b>Ju-Dy 종목분석 사용 방법</b>
</div>
        <br />
        1. 검색창에서 관심 있는 종목명 또는 종목코드를 입력하세요.
        <br />
        2. 재무 데이터, 가격 추이 등 <b>사실 정보</b>를 확인하세요.
        <br />
        3. 경고 항목이 있다면 그 의미를 위의 ‘투자 위험 이해’ 탭에서 확인하세요.
        <br />
        4. 모든 판단은 스스로 내리세요. 이 앱은 판단을 대신하지 않습니다.
      </GoodBox>
    </div>
  )
}

function InfoBox({ title, eng, desc, formula }) {
  return (
    <div style={styles.infoBox}>
      <b>{title}</b>
      <br />
      <span style={styles.engText}>({eng})</span>
      <p style={styles.text}>{desc}</p>
      <p style={styles.infoFormula}>{formula}</p>
    </div>
  )
}

function SimpleAccordion({ title, children }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={styles.accordion}>
      <button
        className="white-accordion-btn"
        style={styles.accordionButton}
        onClick={() => setOpen(prev => !prev)}
        onFocus={(e) => e.currentTarget.blur()}
      >
        <span>{title}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={styles.accordionBody}>
          {children}
        </div>
      )}
    </div>
  )
}

function WarningBox({ children }) {
  return <div style={styles.warningBox}>{children}</div>
}

function GoodBox({ children }) {
  return <div style={styles.goodBox}>{children}</div>
}

const styles = {
  guideWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
  },
  headerCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '34px 36px',
    boxShadow: 'var(--shadow-lg)',
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    color: 'var(--brand)',
    margin: '0 0 10px',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: 1.7,
    margin: 0,
  },
  tabBar: {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: 10,
},

tabButton: {
  height: 52,

  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',

  fontWeight: 600,
  fontSize: 14.5,

  cursor: 'pointer',
  fontFamily: 'inherit',

  borderRadius: 16,

  outline: 'none',
  boxShadow: 'var(--shadow-sm)',
},

tabButtonActive: {
  background: 'linear-gradient(135deg, var(--brand-dim) 0%, var(--brand) 55%, var(--brand-bright) 100%)',
  color: 'var(--text-on-brand)',
  borderColor: 'var(--brand)',

  outline: 'none',
  boxShadow: 'var(--shadow-md)',
},
  contentCard: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '34px 36px',
    boxShadow: 'var(--shadow-lg)',
  },
  contentTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: 'var(--brand-dim)',
    margin: '0 0 18px',
  },
  pointTitle: {
    marginTop: 18,
    marginBottom: 8,
    fontWeight: 800,
    color: 'var(--brand)',
    fontSize: 16,
  },
  text: {
    fontSize: 15,
    color: 'var(--text-primary)',
    lineHeight: 1.8,
    margin: '6px 0',
  },
  mutedText: {
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: 1.7,
    margin: '4px 0',
  },
  dangerText: {
    color: 'var(--danger)',
    fontSize: 15,
    lineHeight: 1.7,
    margin: '4px 0',
  },
  list: {
    marginLeft: 20,
    marginTop: 8,
    lineHeight: 2,
    color: 'var(--text-primary)',
    fontSize: 15,
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 14,
    marginTop: 12,
  },
  infoBox: {
    marginTop: 0,
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 18,
    color: 'var(--text-primary)',
  },
  engText: {
    color: 'var(--text-muted)',
    fontSize: 13,
  },
  infoFormula: {
    marginTop: 4,
    color: 'var(--brand)',
    fontWeight: 800,
    lineHeight: 1.6,
  },
  accordionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 16,
  },
  accordion: {
    border: '1px solid var(--border)',
    borderRadius: 14,
    overflow: 'hidden',
    background: 'var(--bg-card)',
  },
  accordionButton: {
    width: '100%',
    border: 'none',
    background: 'var(--bg-subtle)',
    padding: '15px 18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 800,
    color: 'var(--brand-dim)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 15,
    textAlign: 'left',
    outline: 'none',
    boxShadow: 'none',
  },
  accordionBody: {
    padding: '16px 18px',
    borderTop: '1px solid var(--border)',
  },
  code: {
    background: 'var(--brand-bg)',
    color: 'var(--brand-dim)',
    padding: '2px 6px',
    borderRadius: 4,
    fontWeight: 700,
  },
  warningBox: {
    marginTop: 16,
    padding: '10px 14px',
    borderRadius: 14,
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.40)',
    color: 'var(--text-primary)',
    fontSize: 14,
    lineHeight: 1.7,
  },
  goodBox: {
    marginTop: 16,
    padding: '16px 18px',
    borderRadius: 14,
    background: 'var(--brand-bg)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-primary)',
    fontSize: 14,
    lineHeight: 1.8,
  },
  riskItem: {
    marginBottom: 16,
    paddingBottom: 14,
    borderBottom: '1px solid var(--border)',
  },
  riskTitle: {
    fontWeight: 800,
    fontSize: 16,
    color: 'var(--brand-dim)',
    margin: 0,
  },
}