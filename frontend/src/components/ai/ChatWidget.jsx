import { useState, useRef, useEffect } from 'react'
import api from '../../services/api'
import LinkButton from './LinkButton'

const INIT_MSG = {
  role: 'ai',
  text: '안녕하세요! 저는 건전한 주식 투자를 도와드리는 AI 선생님 세이프입니다. 💚\n주식에 대해 궁금한 점을 자유롭게 물어보세요!',
  sourceUrl: null,
}

export default function ChatWidget() {
  const [messages, setMessages] = useState([INIT_MSG])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)
    try {
      const { data } = await api.post('/api/v1/ai/chat', { question: q })
      setMessages(prev => [...prev, {
        role: 'ai',
        text: data.answer,
        sourceUrl: data.source_url,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: '죄송합니다, 답변을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        sourceUrl: null,
      }])
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="chat-widget">
      <div className="chat-header">
        <span>💚 AI 선생님 세이프</span>
        <span className="chat-hint">건전 투자 Q&A</span>
      </div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`message-row ${m.role}`}>
            {m.role === 'ai' && <span className="avatar">🤖</span>}
            <div className={`message-bubble ${m.role === 'user' ? 'user-bubble' : 'ai-bubble'}`}>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{m.text}</p>
              {m.sourceUrl && (
                <div style={{ marginTop: 8 }}>
                  <LinkButton url={m.sourceUrl} />
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message-row ai">
            <span className="avatar">🤖</span>
            <div className="ai-bubble message-bubble">
              <span className="typing-dots"><span /><span /><span /></span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="주식에 대해 궁금한 것을 물어보세요... (Enter로 전송)"
          rows={2}
          disabled={loading}
        />
        <button className="chat-send-btn" onClick={send} disabled={loading || !input.trim()}>
          전송
        </button>
      </div>
    </div>
  )
}
