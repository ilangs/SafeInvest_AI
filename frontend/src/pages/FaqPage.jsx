import { useMemo, useState } from 'react'
import Navbar from '../components/layout/Navbar'

const FAQS = [
  { q: '회원가입은 어떻게 하나요?', a: '로그인 페이지에서 회원가입 버튼을 눌러 이메일과 비밀번호를 입력하면 가입할 수 있습니다.' },
  { q: '로그인은 어떻게 하나요?', a: '가입한 이메일과 비밀번호를 입력한 뒤 로그인 버튼을 누르면 됩니다.' },
  { q: '비밀번호를 잊어버리면 어떻게 하나요?', a: '현재는 관리자 또는 서비스 담당자에게 문의하는 방식으로 안내합니다.' },
  { q: '모의투자는 무료인가요?', a: '네, 모의투자 기능은 실제 돈이 사용되지 않는 학습용 기능입니다.' },
  { q: '모의투자에서 실제 돈이 사용되나요?', a: '아니요. 모의투자는 가상 환경에서 진행되며 실제 돈은 사용되지 않습니다.' },
  { q: 'AI 챗봇은 어떤 기능인가요?', a: '주식 및 금융에 대한 질문을 입력하면 AI가 이해하기 쉽게 답변해 주는 기능입니다.' },
  { q: 'AI 답변은 투자 조언인가요?', a: 'AI 답변은 학습과 참고용이며 실제 투자 결정은 본인이 신중하게 판단해야 합니다.' },
  { q: '마켓분석은 무엇인가요?', a: '관심 종목의 시장 정보와 분석 내용을 확인할 수 있는 기능입니다.' },
  { q: '주식매매 기능은 실제 거래인가요?', a: '현재는 학습과 연습을 위한 모의 매매 흐름으로 구성되어 있습니다.' },
  { q: '계좌 연결은 필수인가요?', a: '필수는 아니며 필요할 때 선택적으로 진행할 수 있습니다.' },

  { q: '계좌 연결은 어디서 하나요?', a: '상단 메뉴 또는 홈 화면의 계좌 연결 메뉴에서 확인할 수 있습니다.' },
  { q: '교육센터에서는 무엇을 볼 수 있나요?', a: '주식 기초, 교육 주제, 학습 경로 등 투자 학습에 필요한 내용을 확인할 수 있습니다.' },
  { q: '학습 경로는 어떤 기능인가요?', a: '초보자가 순서대로 투자 개념을 익힐 수 있도록 안내하는 기능입니다.' },
  { q: '서비스 색상은 왜 빨강과 초록을 사용하나요?', a: '홈 화면은 브랜드 색상인 빨강을 사용하고, 나머지 화면은 눈이 편한 초록 계열로 구성했습니다.' },
  { q: '데이터는 실제 시장과 동일한가요?', a: '일부 데이터는 실제 시장 정보를 기반으로 하며, 일부 기능은 시뮬레이션으로 구성될 수 있습니다.' },
  { q: '검색 기능은 어떻게 사용하나요?', a: '검색창에 궁금한 단어를 입력하면 관련된 질문과 답변만 확인할 수 있습니다.' },
  { q: 'FAQ는 클릭해야 열리나요?', a: '아니요. 현재 FAQ는 질문과 답변을 한 번에 확인할 수 있도록 구성되어 있습니다.' },
  { q: '공지사항은 어디서 확인하나요?', a: '상단 메뉴의 공지사항 페이지에서 서비스 관련 안내를 확인할 수 있습니다.' },
  { q: '자유게시판은 어떤 용도인가요?', a: '사용자가 자유롭게 학습 기록이나 투자 관련 의견을 남길 수 있는 공간입니다.' },
  { q: '내 정보는 어디서 확인하나요?', a: '계좌 연결 또는 회원 관련 메뉴에서 필요한 정보를 확인할 수 있습니다.' },

  { q: '서비스는 모바일에서도 사용할 수 있나요?', a: '반응형 화면을 고려해 PC와 모바일 환경에서 사용할 수 있도록 구성하고 있습니다.' },
  { q: '다크모드는 지원하나요?', a: '상단의 토글 버튼을 통해 화면 모드를 전환할 수 있습니다.' },
  { q: 'AI 챗봇 답변이 느릴 때는 어떻게 하나요?', a: '잠시 기다린 뒤 다시 질문하거나 새로고침 후 이용해 주세요.' },
  { q: '투자 초보자도 사용할 수 있나요?', a: '네. 주식 초보자도 쉽게 이해할 수 있도록 학습 중심으로 구성했습니다.' },
  { q: 'Ju-Dy는 어떤 서비스인가요?', a: 'Ju-Dy는 주식 학습, 모의투자, 마켓분석, AI 튜터 기능을 제공하는 투자 학습 서비스입니다.' },
]

export default function FaqPage() {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const pageSize = 5

  const filteredFaqs = useMemo(() => {
    const text = keyword.trim().toLowerCase()

    if (!text) return FAQS

    return FAQS.filter((item) =>
      `${item.q} ${item.a}`.toLowerCase().includes(text)
    )
  }, [keyword])

  const totalPages = Math.ceil(filteredFaqs.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const currentFaqs = filteredFaqs.slice(startIndex, startIndex + pageSize)

  const handleSearchChange = (e) => {
    setKeyword(e.target.value)
    setPage(1)
  }

  return (
    <div className="app-layout" style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <Navbar />

      <main
        style={{
          maxWidth: 900,
          width: '100%',
          margin: '0 auto',
          padding: '52px 24px 72px',
          boxSizing: 'border-box',
        }}
      >
        {/* 페이지 제목 */}
        <section style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 40,
              fontWeight: 800,
              color: '#286346',
              letterSpacing: '-0.04em',
            }}
          >
            FAQ
          </h1>

          <p
            style={{
              margin: '10px 0 0',
              color: '#6b7280',
              fontSize: 16,
            }}
          >
            자주 묻는 질문을 검색하고 빠르게 확인할 수 있습니다.
          </p>
        </section>

        {/* 검색 영역 */}
        <section
          style={{
            width: '100%',
            marginBottom: 22,
            boxSizing: 'border-box',
          }}
        >
          <input
            value={keyword}
            onChange={handleSearchChange}
            placeholder="궁금한 내용을 검색하세요. 예: 회원가입, 모의투자, 계좌 연결"
            style={{
              width: '100%',
              height: 48,
              border: '1px solid #d1d5db',
              borderRadius: 10,
              padding: '0 16px',
              fontSize: 15,
              outline: 'none',
              color: '#1f2937',
              background: '#f3f6f4',
              boxSizing: 'border-box',
              boxShadow: '0 10px 24px rgba(31, 79, 58, 0.08)',
            }}
          />
        </section>

        {/* FAQ 게시판 */}
        <section
          style={{
            width: '100%',
            background: '#ffffff',
            border: '1px solid #dbe5de',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: '0 18px 45px rgba(31, 79, 58, 0.14)',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr',
              background: 'linear-gradient(135deg, #1f4f3a 0%, #2f6f4f 55%, #3e8e63 100%)',
              color: '#ffffff',
              padding: '20px 33px',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            <div style={{ paddingLeft: 11 }}>번호</div>
            <div>질문 및 답변</div>
          </div>

          {currentFaqs.length > 0 ? (
            currentFaqs.map((item, index) => (
              <article
                key={`${item.q}-${index}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 1fr',
                  padding: '18px 33px',
                  borderBottom: '1px solid #edf2ef',
                  background: '#ffffff',
                }}
              >
                <div
                  style={{
                    color: '#2f6f4f',
                    fontWeight: 700,
                    fontSize: 14,
                    paddingLeft: 16,
                  }}
                >
                  {filteredFaqs.length - (startIndex + index)}
                </div>

                <div>
                  <h3
                    style={{
                      margin: '0 0 8px',
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#1f2937',
                    }}
                  >
                    Q. {item.q}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color: '#4b5563',
                      fontSize: 14,
                      lineHeight: 1.7,
                    }}
                  >
                    A. {item.a}
                  </p>
                </div>
              </article>
            ))
          ) : (
            <div
              style={{
                padding: '42px 20px',
                textAlign: 'center',
                color: '#6b7280',
              }}
            >
              검색 결과가 없습니다.
            </div>
          )}
        </section>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
              marginTop: 24,
              flexWrap: 'wrap',
            }}
          >
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => setPage(num)}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  border: page === num ? '1px solid #2f6f4f' : '1px solid #d1d5db',
                  background: page === num ? '#2f6f4f' : '#ffffff',
                  color: page === num ? '#ffffff' : '#2f6f4f',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {num}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}