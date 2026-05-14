import Navbar from '../components/layout/Navbar'
import ChatWidget from '../components/ai/ChatWidget'

export default function AiChatPage() {
  return (
    <div className="app-layout" style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <Navbar />

      <main className="ai-chat-main" style={{ padding: '44px 24px 64px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          {/* 타이틀 영역 */}
          <div style={{ textAlign: 'center', marginTop: 10, marginBottom: 30 }}>
            <div
              className="ai-chat-title"
              style={{
                fontSize: 40,
                marginBottom: 10,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: '#286346',
              }}
            >
              Financial AI Tutor
            </div>
            <div className="ai-chat-subtitle" style={{ color: '#6B7280', fontSize: 16, lineHeight: 1.6 }}>
              투자 학습과 주식 기초 질문을 쉽고 명확하게 도와드립니다.
            </div>
          </div>

          {/* 챗봇 카드 */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #dbe5de',
              borderRadius: 18,
              boxShadow: '0 30px 80px rgba(31, 79, 58, 0.4)',
              overflow: 'hidden',
            }}
          >
            <ChatWidget />
          </div>

        </div>
      </main>
    </div>
  )
}