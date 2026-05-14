import { warnKorean, warnDesc } from '../../../services/analysisApi.js'

// Supabase BOOLEAN → JS true/false, 과거 SQLite 0/1, 문자열 "true"/"1" 모두 활성으로 인식
const isActiveTruthy = (v) =>
  v === true || v === 1 || v === '1' || v === 'true' || v === 'TRUE'

export default function TabSafety({ score, warnings }) {
  const active = (warnings ?? []).filter(w => isActiveTruthy(w.is_active))
  const inactive = (warnings ?? []).filter(w => !isActiveTruthy(w.is_active))

  const activePointColor = active.length > 0 ? '#c8a64a' : '#6957ef'

  return (
    <div>
      {/* 라인형 탭 가이드 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginTop: 28,
          marginBottom: 33,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 1,
            background: 'var(--border)',
          }}
        />

        <div
          style={{
            fontSize: 15,
            fontWeight: 590,
            color: '#3b3e43',
            whiteSpace: 'normal', // 모바일에서 줄바꿈 허용
            wordBreak: 'keep-all', // 단어 단위 줄바꿈
            textAlign: 'center',
            letterSpacing: '-0.03em',
            padding: '0 10px',
          }}
        >
          이 탭은 재무 데이터 기반으로 확인된 공식 위험 경고를 보여줍니다.
        </div>

        <div
          style={{
            flex: 1,
            height: 1,
            background: 'var(--border)',
          }}
        />
      </div>

      {/* 상단 카드 3개 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 2.6fr',
          gap: 10,
          marginBottom: -10,
          maxWidth: 900,
          margin: '0 auto',
        }}
      >
        {/* 활성 경고 */}
        <div
          className="an-glass-card"
          style={{
            borderLeft: `5px solid ${active.length > 0 ? '#c85a5a' : '#4caf6a'}`,
            padding: '18px 22px',
            borderRadius: 18,
            background: 'var(--bg-card)',
            minHeight: 90,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: 8,
            }}
          >
            활성 경고
          </div>

          <div
            style={{
              fontSize: 30,
              fontWeight: 900,
              color: active.length > 0 ? '#c85a5a' : '#4caf6a',
              lineHeight: 1,
              letterSpacing: '-0.05em',
            }}
          >
            {active.length}건
          </div>
        </div>

        {/* 해제된 경고 */}
        <div
          className="an-glass-card"
          style={{
            borderLeft: '5px solid #98a2b3',
            padding: '18px 22px',
            borderRadius: 18,
            background: 'var(--bg-card)',
            minHeight: 90,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: 8,
            }}
          >
            해제된 경고
          </div>

          <div
            style={{
              fontSize: 30,
              fontWeight: 900,
              color: '#98a2b3',
              lineHeight: 1,
              letterSpacing: '-0.05em',
            }}
          >
            {inactive.length}건
          </div>
        </div>

        {/* 활성 위험 경고 */}
        <div
          className="an-glass-card"
          style={{
            borderLeft: `5px solid ${activePointColor}`,
            padding: '18px 22px',
            borderRadius: 18,
            background: 'var(--bg-card)',
            minHeight: 90,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 13,
                height: 13,
                borderRadius: '50%',
                background: activePointColor,
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            {active.length > 0 ? '활성 위험 경고' : '활성 경고 없음'}
          </div>

          {active.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {active.map((w, i) => (
                <div key={i}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      color: '#7a3b2a',
                      marginBottom: 3,
                    }}
                  >
                    {warnKorean(w.warning_type)}
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {warnDesc(w.warning_type)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              현재 데이터 기준 활성화된 투자 경고가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 위험 유형 설명 */}
      <div
        style={{
          marginTop: 12,
          padding: '24px 26px',
          borderRadius: 20,
        }}
      >
        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            letterSpacing: '-0.03em',
          }}
        >
          <img
            src="/logo-tab.png"
            alt="Ju-Dy"
            style={{
              width: 24,
              height: 24,
              objectFit: 'contain',
            }}
          />
          위험 유형 설명
        </h3>

        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid var(--border)',
          }}
        >
          {[
            {
              type: 'CAPITAL_IMPAIRMENT',
              sev: '매우 심각',
              sevColor: '#d95c5c',
              dot: '#d95c5c',
              detail:
                '누적 손실로 자본이 감소한 상태이며, 심할 경우 관리종목 또는 상장폐지 위험이 있습니다.',
            },
            {
              type: 'CONTINUOUS_LOSS',
              sev: '심각',
              sevColor: '#e38b2c',
              dot: '#e38b2c',
              detail:
                '최근 3년 동안 계속 순손실이 발생했습니다. 사업 지속 가능성을 점검해야 합니다.',
            },
            {
              type: 'HIGH_DEBT',
              sev: '주의',
              sevColor: '#d7b325',
              dot: '#e7c63b',
              detail:
                '자본 대비 빚이 매우 큰 상태입니다. 금리 상승 시 이자 부담으로 경영이 어려워질 수 있습니다.',
            },
            {
              type: 'LOW_REVENUE',
              sev: '주의',
              sevColor: '#d7b325',
              dot: '#e7c63b',
              detail:
                '연간 매출이 작아 사업 안정성이 낮을 수 있습니다.',
            },
          ].map(({ type, sev, sevColor, dot, detail }, idx, arr) => (
            <div
              key={type}
              style={{
                display: 'flex',
                flexWrap: 'wrap', // 모바일 대응을 위한 핵심 속성
                alignItems: 'center',
                gap: '12px 16px',
                padding: '16px 22px',
                borderBottom:
                  idx === arr.length - 1 ? 'none' : '1px solid var(--border-subtle)',
              }}
            >
              {/* 항목 타이틀 영역 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.03em',
                  width: 140, // 타이틀이 차지하는 최소 고정 너비
                  flex: '0 0 auto',
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: dot,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                {warnKorean(type)}
              </div>

              {/* 상세 설명 문구 영역 */}
              <div
                style={{
                  flex: '1 1 200px', // 여유 공간을 채우되, 좁아지면 줄바꿈 처리
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  wordBreak: 'keep-all',
                }}
              >
                {detail}
              </div>

              {/* 배지(심각도) 영역 */}
              <div
                style={{
                  marginLeft: 'auto', // 우측 끝으로 밀어내기
                  color: sevColor,
                  fontWeight: 700,
                  fontSize: 13,
                  background: `${sevColor}12`,
                  border: `1px solid ${sevColor}55`,
                  padding: '5px 12px',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                  flex: '0 0 auto',
                }}
              >
                {sev}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}