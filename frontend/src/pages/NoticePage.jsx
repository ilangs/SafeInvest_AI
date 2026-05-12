import { useState } from 'react'
import Navbar from '../components/layout/Navbar'

const CATEGORIES = ['전체', '교육센터', '마켓분석', '주식매매', '업데이트', '점검안내']

const NOTICES = [
  {
    id: 15,
    category: '점검안내',
    title: '서비스 임시 점검 안내',
    date: '2026.05.10',
    writer: '관리자',
    content:
      '안정적인 서비스 제공을 위해 임시 점검이 진행될 예정입니다.\n점검 시간 동안 일부 기능 이용이 제한될 수 있습니다.',
  },
  {
    id: 14,
    category: '업데이트',
    title: '공지사항 기능 업데이트',
    date: '2026.05.09',
    writer: '관리자',
    content:
      '공지사항에서 카테고리별 안내를 확인할 수 있도록 기능이 개선되었습니다.\n원하는 항목을 선택해 관련 공지만 빠르게 확인할 수 있습니다.',
  },
  {
    id: 13,
    category: '주식매매',
    title: '모의투자 주문 화면 안내',
    date: '2026.05.08',
    writer: '관리자',
    content:
      '주식매매 메뉴에서 모의 주문 흐름을 연습할 수 있습니다.\n실제 돈은 사용되지 않으며 학습용 환경으로 제공됩니다.',
  },
  {
    id: 12,
    category: '마켓분석',
    title: '마켓분석 화면 이용 안내',
    date: '2026.05.08',
    writer: '관리자',
    content:
      '마켓분석 메뉴에서는 관심 종목의 시장 흐름을 확인할 수 있습니다.\n데이터는 학습과 참고 목적의 분석 화면으로 제공됩니다.',
  },
  {
    id: 11,
    category: '교육센터',
    title: '교육센터 학습 경로 안내',
    date: '2026.05.07',
    writer: '관리자',
    content:
      '교육센터에서는 주식 기초부터 단계별 학습 경로를 확인할 수 있습니다.\n처음 이용하는 사용자는 기본기부터 순서대로 학습해 보세요.',
  },
  {
    id: 10,
    category: '업데이트',
    title: 'AI 금융 튜터 화면 개선 안내',
    date: '2026.05.07',
    writer: '관리자',
    content:
      'AI 금융 튜터 화면의 디자인과 사용성이 개선되었습니다.\n보다 깔끔한 채팅 환경에서 금융 관련 질문을 입력할 수 있습니다.',
  },
  {
    id: 9,
    category: '점검안내',
    title: '마켓 데이터 조회 점검 안내',
    date: '2026.05.06',
    writer: '관리자',
    content:
      '마켓 데이터 조회 기능의 안정화를 위한 점검이 예정되어 있습니다.\n점검 중에는 일부 종목 정보가 일시적으로 표시되지 않을 수 있습니다.',
  },
  {
    id: 8,
    category: '교육센터',
    title: '기본기 콘텐츠 추가 안내',
    date: '2026.05.06',
    writer: '관리자',
    content:
      '교육센터 기본기 영역에 초보자용 학습 콘텐츠가 추가되었습니다.\n주식 용어와 기초 개념을 쉽게 확인할 수 있습니다.',
  },
  {
    id: 7,
    category: '마켓분석',
    title: '관심 종목 분석 기능 안내',
    date: '2026.05.05',
    writer: '관리자',
    content:
      '관심 종목의 재무 안정성과 위험도를 확인할 수 있는 화면을 제공합니다.\n분석 결과는 투자 참고용으로 활용해 주세요.',
  },
  {
    id: 6,
    category: '주식매매',
    title: '모의투자 기능 안내',
    date: '2026.05.05',
    writer: '관리자',
    content:
      '모의투자는 실제 돈이 사용되지 않는 학습용 투자 연습 기능입니다.\n초보자도 부담 없이 매수와 매도 흐름을 경험해 볼 수 있습니다.',
  },
  {
    id: 5,
    category: '교육센터',
    title: '교육센터 콘텐츠 구성 안내',
    date: '2026.05.04',
    writer: '관리자',
    content:
      '교육센터는 기본기, 교육 주제, 학습 경로 중심으로 구성되어 있습니다.\n주식 초보자도 차근차근 학습할 수 있도록 화면을 정리하고 있습니다.',
  },
  {
    id: 4,
    category: '업데이트',
    title: '계좌 연결 메뉴 안내',
    date: '2026.05.04',
    writer: '관리자',
    content:
      '계좌 연결 메뉴에서는 투자 환경과 관련된 기본 정보를 확인할 수 있습니다.\n현재 프로젝트 단계에서는 프론트 화면 중심으로 구성되어 있습니다.',
  },
  {
    id: 3,
    category: '마켓분석',
    title: '시장 정보 표시 방식 안내',
    date: '2026.05.03',
    writer: '관리자',
    content:
      '마켓분석 화면은 사용자가 시장 흐름을 쉽게 파악할 수 있도록 구성되었습니다.\n일부 데이터는 시뮬레이션 형태로 제공될 수 있습니다.',
  },
  {
    id: 2,
    category: '업데이트',
    title: 'AI 금융 튜터 참고 사항',
    date: '2026.05.02',
    writer: '관리자',
    content:
      'AI 금융 튜터는 주식 및 금융 학습을 돕기 위한 기능입니다.\nAI 답변은 학습과 참고용이며 실제 투자 판단은 본인이 신중하게 결정해야 합니다.',
  },
  {
    id: 1,
    category: '업데이트',
    title: 'Ju-Dy 서비스 이용 안내',
    date: '2026.05.01',
    writer: '관리자',
    content:
      'Ju-Dy는 주식 학습, 모의투자, 마켓분석, AI 금융 튜터 기능을 제공하는 투자 학습 서비스입니다.\n처음 이용하시는 분들은 교육센터에서 기본 개념을 먼저 확인해 보세요.',
  },
]

export default function NoticePage() {
  const [selectedNotice, setSelectedNotice] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const [page, setPage] = useState(1)

  const pageSize = 5

  const filteredNotices =
    selectedCategory === '전체'
      ? NOTICES
      : NOTICES.filter((notice) => notice.category === selectedCategory)

  const totalPages = Math.ceil(filteredNotices.length / pageSize)

  const startIndex = (page - 1) * pageSize

  const currentNotices = filteredNotices.slice(
    startIndex,
    startIndex + pageSize
  )

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
            Notice
          </h1>

          <p
            style={{
              margin: '10px 0 0',
              color: '#6b7280',
              fontSize: 16,
            }}
          >
            Ju-Dy 서비스의 주요 안내사항을 확인할 수 있습니다.
          </p>
        </section>

        {!selectedNotice ? (
          <>
            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                border: '1px solid #dbe5de',
                borderRadius: 16,
                overflow: 'hidden',
                background: '#ffffff',
                boxShadow: '0 14px 36px rgba(31, 79, 58, 0.10)',
                marginBottom: 22,
              }}
            >
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    setSelectedCategory(category)
                    setPage(1)
                  }}
                  style={{
                    height: 52,
                    border: 'none',
                    borderRight: '1px solid #edf2ef',
                    borderBottom: '1px solid #edf2ef',
                    background:
                      selectedCategory === category
                        ? 'linear-gradient(135deg, #1f4f3a 0%, #2f6f4f 55%, #3e8e63 100%)'
                        : '#ffffff',
                    color: selectedCategory === category ? '#ffffff' : '#1f2937',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {category}
                </button>
              ))}
            </section>

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
                  gridTemplateColumns: '80px 1fr 100px 50px',
                  background: 'linear-gradient(135deg, #1f4f3a 0%, #2f6f4f 55%, #3e8e63 100%)',
                  color: '#ffffff',
                  padding: '20px 50px',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                <div style={{ marginLeft: '-5px' }}>번호</div>
                <div>제목</div>
                <div>날짜</div>
                <div>글쓴이</div>
              </div>

              {currentNotices.map((notice) => (
                <article
                  key={notice.id}
                  onClick={() => setSelectedNotice(notice)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 120px 50px',
                    padding: '20px 50px',
                    borderBottom: '1px solid #edf2ef',
                    background: '#ffffff',
                    cursor: 'pointer',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ color: '#2f6f4f', fontWeight: 700, fontSize: 14 }}>
                    {notice.id}
                  </div>

                  <div style={{ color: '#1f2937', fontSize: 14, fontWeight: 700 }}>
                    [{notice.category}] {notice.title}
                  </div>

                  <div style={{ color: '#6b7280', fontSize: 14 }}>
                    {notice.date}
                  </div>

                  <div style={{ color: '#4b5563', fontSize: 14 }}>
                    {notice.writer}
                  </div>
                </article>
              ))}
            </section>

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
                      border:
                        page === num
                          ? '1px solid #2f6f4f'
                          : '1px solid #d1d5db',
                      background:
                        page === num
                          ? '#2f6f4f'
                          : '#ffffff',
                      color:
                        page === num
                          ? '#ffffff'
                          : '#2f6f4f',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
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
                background: 'linear-gradient(135deg, #1f4f3a 0%, #2f6f4f 55%, #3e8e63 100%)',
                color: '#ffffff',
                padding: '18px 22px',
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              공지사항 상세
            </div>

            <div style={{ padding: '26px 24px' }}>
              <h2
                style={{
                  margin: '0 0 12px',
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#1f2937',
                }}
              >
                {selectedNotice.title}
              </h2>

              <div
                style={{
                  display: 'flex',
                  gap: 14,
                  color: '#6b7280',
                  fontSize: 14,
                  marginBottom: 24,
                }}
              >
                <span>{selectedNotice.category}</span>
                <span>{selectedNotice.date}</span>
                <span>{selectedNotice.writer}</span>
              </div>

              <p
                style={{
                  margin: 0,
                  color: '#374151',
                  fontSize: 15,
                  lineHeight: 1.8,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedNotice.content}
              </p>

              <button
                onClick={() => setSelectedNotice(null)}
                style={{
                  marginTop: 28,
                  height: 40,
                  padding: '0 18px',
                  border: '1px solid #2f6f4f',
                  borderRadius: 8,
                  background: '#ffffff',
                  color: '#2f6f4f',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                목록으로
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}