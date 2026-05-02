import ExplainBox from '../shared/ExplainBox.jsx'

export default function TabBeginner() {
  const items = [
    { title:'안전점수란?', body:'0~100점 점수로 재무 위험을 요약한 참고 지표입니다. 수익 보장 점수가 아닙니다.', type:'info' },
    { title:'자본잠식이란?', body:'누적 손실이 커져서 자기자본이 마이너스가 된 상태입니다. 상장폐지 위험과 직결될 수 있습니다.', type:'warning' },
    { title:'부채비율이란?', body:'자기자본 대비 빚의 비율입니다. 100% 이하면 안정적, 500% 이상이면 매우 위험합니다.', type:'warning' },
    { title:'3년 연속 적자란?', body:'3년 내내 순손실이 발생했다는 의미입니다. 사업 지속 가능성을 확인해야 합니다.', type:'warning' },
    { title:'거래량이 왜 중요?', body:'거래량이 적으면 사고 싶을 때 사기 어렵고, 팔고 싶을 때 팔기도 어렵습니다.', type:'info' },
    { title:'이 앱의 한계', body:'과거 데이터 기반 분석으로 미래 주가를 예측하지 않습니다. 항상 최신 공시와 뉴스를 함께 확인하세요.', type:'warning' },
  ]
  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>초보자 필독 가이드</h2>
      {items.map(({ title, body, type }) => (
        <div key={title}>
          <ExplainBox title={title} body={body} type={type} />
          <div style={{ height: 8 }} />
        </div>
      ))}
    </div>
  )
}
