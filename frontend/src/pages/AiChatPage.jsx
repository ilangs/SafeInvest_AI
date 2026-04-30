import Navbar from '../components/layout/Navbar'
import ChatWidget from '../components/ai/ChatWidget'

export default function AiChatPage() {
  return (
    <div className="app-layout">
      <Navbar />
      <main style={{ padding: '40px 24px 56px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>💬 AI 금융 튜터</div>
            <div style={{ color: '#64748B', fontSize: 16, lineHeight: 1.6 }}>
              금감원 공식 자료를 바탕으로 질문에 답하는 AI에게 궁금한 점을 물어보세요.
            </div>
          </div>

          <div
            style={{
              background: 'white',
              border: '1px solid #E2E8F0',
              borderRadius: 24,
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
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
