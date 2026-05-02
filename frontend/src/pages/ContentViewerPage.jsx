import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'

const EDU_API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export default function ContentViewerPage() {
  const { slno } = useParams()
  const navigate = useNavigate()
  const isSelf = slno?.startsWith('self_')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chatOpen, setChatOpen] = useState(true)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [suggestedQs, setSuggestedQs] = useState([])
  const chatEndRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    const url = isSelf
      ? `${EDU_API}/api/self-contents/${slno}`
      : `${EDU_API}/api/education/contents/${slno}`
    fetch(url).then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false))
  }, [slno, isSelf])

  useEffect(() => {
    if (!data) return
    fetch(`${EDU_API}/api/education/contents/${slno}/suggested-questions`)
      .then(r => r.json())
      .then(d => setSuggestedQs(d.questions || []))
      .catch(() => {})
  }, [data, slno])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: 80, color: '#94A3B8' }}>불러오는 중...</div>
    </div>
  )

  if (!data) return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: 80, color: '#EF4444' }}>콘텐츠를 찾을 수 없습니다.</div>
    </div>
  )

  const content = data.content
  const related = data.related || []

  const sendChat = async (question) => {
    if (!question.trim()) return
    const q = question.trim()
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setInput('')
    setChatLoading(true)
    try {
      const res = await fetch(`${EDU_API}/api/education/chat/contextual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, content_slno: slno, user_age: 28 }),
      })
      const d = await res.json()
      setMessages(prev => [...prev, {
        role: 'ai',
        text: d.answer,
        sources: d.sources || [],
        disclaimer: d.disclaimer,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: '답변을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.' }])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC', fontFamily: "'IBM Plex Sans KR', -apple-system, sans-serif" }}>
      <Navbar />
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 24px 32px', display: 'grid', gridTemplateColumns: chatOpen ? '1fr 380px' : '1fr', gap: 24, paddingTop: 24 }}>

        {/* ── 왼쪽: 콘텐츠 ── */}
        <div>
          {/* 브레드크럼 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13, color: '#64748B' }}>
            <button onClick={() => navigate('/education')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0A3D62', fontFamily: 'inherit', fontSize: 13 }}>교육센터</button>
            <span>›</span>
            {!isSelf && content.topic_code && (
              <>
                <button onClick={() => navigate(`/education/topic/${content.topic_code}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0A3D62', fontFamily: 'inherit', fontSize: 13 }}>주제</button>
                <span>›</span>
              </>
            )}
            <span style={{ color: '#0F172A', fontWeight: 500 }}>콘텐츠</span>
          </div>

          {/* 콘텐츠 메타 */}
          <div style={{ background: 'white', borderRadius: 16, padding: '24px', marginBottom: 20, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ fontSize: 12, background: '#F1F5F9', color: '#475569', padding: '3px 10px', borderRadius: 20 }}>{content.make_type_name || '???'}</span>
              {content.is_self_content && <span style={{ fontSize: 12, background: '#D1FAE5', color: '#047857', padding: '3px 10px', borderRadius: 20 }}>SafeInvest 제작</span>}
              {content.is_playable && <span style={{ fontSize: 12, background: '#EFF6FF', color: '#1D4ED8', padding: '3px 10px', borderRadius: 20 }}>재생 가능</span>}
              {content.playtime && <span style={{ fontSize: 12, background: '#FFF7ED', color: '#C2410C', padding: '3px 10px', borderRadius: 20 }}>{content.playtime || (content.playtime_minutes ? `${content.playtime_minutes}?` : '')}</span>}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', lineHeight: 1.4, marginBottom: 10 }}>{content.title || '?? ??'}</h1>
            <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6 }}>{content.summary || '??? ????.'}</p>
            {content.provider_name && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#94A3B8' }}>
                제공: {content.provider_name} {content.producing_yr && `· ${content.producing_yr}`}
              </div>
            )}
          </div>

          {/* 플레이어 / 뷰어 */}
          <ContentPlayer content={content} />

          {/* 관련 콘텐츠 */}
          {related.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0F172A', marginBottom: 12 }}>관련 콘텐츠</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {related.map(r => (
                  <div key={r.contents_slno} onClick={() => navigate(`/education/content/${r.contents_slno}`)} style={{
                    background: 'white', borderRadius: 12, padding: '14px', border: '1px solid #E2E8F0',
                    cursor: 'pointer', fontSize: 13, color: '#0F172A', fontWeight: 500,
                    transition: 'border-color 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#0A3D62')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
                  >
                    {r.title ? `${r.title.slice(0, 50)}...` : '?? ???'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 오른쪽: AI 튜터 채팅 ── */}
        {chatOpen && (
          <div style={{ position: 'sticky', top: 24, height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* 헤더 */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 15 }}>🤖 AI 튜터</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>이 콘텐츠에 대해 질문하세요</div>
                </div>
                <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 18 }}>×</button>
              </div>

              {/* 메시지 영역 */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.length === 0 && (
                  <div>
                    <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12, lineHeight: 1.5 }}>
                      현재 콘텐츠 내용에 대해 궁금한 것을 물어보세요.
                    </div>
                    {suggestedQs.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>추천 질문</div>
                        {suggestedQs.map((q, i) => (
                          <button key={i} onClick={() => sendChat(q)} style={{
                            display: 'block', width: '100%', textAlign: 'left', marginBottom: 6,
                            background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
                            padding: '10px 14px', fontSize: 12, color: '#475569', cursor: 'pointer',
                            fontFamily: 'inherit', lineHeight: 1.4, transition: 'all 0.15s',
                          }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = '#0A3D62')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
                          >{q}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '85%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.5,
                      background: msg.role === 'user' ? '#0A3D62' : '#F8FAFC',
                      color: msg.role === 'user' ? 'white' : '#0F172A',
                      border: msg.role === 'ai' ? '1px solid #E2E8F0' : 'none',
                    }}>
                      {msg.text}
                      {msg.sources?.length > 0 && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                          <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>참고 자료</div>
                          {msg.sources.slice(0, 2).map((s, si) => (
                            <div key={si} style={{ fontSize: 11, color: '#64748B' }}>• {s.title}</div>
                          ))}
                        </div>
                      )}
                      {msg.disclaimer && (
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 6 }}>{msg.disclaimer}</div>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#94A3B8' }}>
                      답변 생성 중...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* 입력창 */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8 }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat(input)}
                  placeholder="질문을 입력하세요..."
                  style={{
                    flex: 1, padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 10,
                    fontSize: 13, outline: 'none', fontFamily: 'inherit', color: '#0F172A',
                  }}
                />
                <button onClick={() => sendChat(input)} disabled={!input.trim() || chatLoading} style={{
                  background: '#0A3D62', color: 'white', border: 'none', borderRadius: 10,
                  padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: !input.trim() || chatLoading ? 0.5 : 1,
                }}>전송</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 채팅 열기 버튼 (닫혀있을 때) */}
      {!chatOpen && (
        <button onClick={() => setChatOpen(true)} style={{
          position: 'fixed', bottom: 32, right: 32,
          background: '#0A3D62', color: 'white', border: 'none', borderRadius: 50,
          width: 56, height: 56, fontSize: 22, cursor: 'pointer', boxShadow: '0 4px 16px rgba(10,61,98,0.3)',
        }}>🤖</button>
      )}
    </div>
  )
}

function ContentPlayer({ content }) {
  // 상대경로(/static/...)는 백엔드 주소 붙이기
  const resolveUrl = (url) => {
    if (!url) return url
    if (url.startsWith('/static/') || url.startsWith('/api/')) {
      return `${EDU_API}${url}`
    }
    return url
      .replace(/&amp;/g, '&')
      .replace(/&#38;/g, '&')
      .replace(/&#x26;/g, '&')
  }

  const isDirectMediaUrl = (url) => {
    if (!url) return false
    return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url)
  }

  if (content.learning_mode === 'ai_summary') {
    return (
      <div style={{ background: 'white', borderRadius: 16, padding: '32px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>직접 재생이 어려운 콘텐츠입니다</h3>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
          금감원 VOD 또는 외부 제공 콘텐츠는 AI 요약 및 관련 자료를 통해 학습할 수 있습니다.
        </p>
        {content.url && (
          <a href={resolveUrl(content.url)} target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-block', background: '#0A3D62', color: 'white', padding: '10px 24px',
            borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>원본 사이트에서 보기 →</a>
        )}
      </div>
    )
  }

  // 자체 제작 영상 (make_type_code === '9') — /static/videos/*.mp4
  if (content.make_type_code === '9' || content.is_self_content) {
    const videoUrl = resolveUrl(content.url || content.video_path)
    return (
      <div style={{ background: '#000', borderRadius: 16, overflow: 'hidden' }}>
        <video
          controls
          style={{ width: '100%', maxHeight: 520, display: 'block' }}
          preload="metadata"
        >
          <source src={videoUrl} type="video/mp4" />
          브라우저가 비디오를 지원하지 않습니다.
        </video>
      </div>
    )
  }

  // 외부 재생 가능 영상 (YouTube / 일반 mp4)
  const url = resolveUrl(content.url || content.external_url || content.file_down_url)

  if (content.make_type_code === '1' && url && !url.includes('youtu') && !isDirectMediaUrl(url)) {
    return (
      <div style={{ background: 'black', borderRadius: 16, overflow: 'hidden', aspectRatio: '16/9' }}>
        <iframe
          src={url}
          title={content.title || '영상'}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  if (content.make_type_code === '1') {
    // YouTube
    if (url?.includes('youtu')) {
      const videoId = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1]
      return (
        <div style={{ background: 'black', borderRadius: 16, overflow: 'hidden', aspectRatio: '16/9' }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allowFullScreen title={content.title}
          />
        </div>
      )
    }
    // 직접 mp4
    return (
      <div style={{ background: 'black', borderRadius: 16, overflow: 'hidden' }}>
        <video controls style={{ width: '100%', maxHeight: 500, display: 'block' }}>
          <source src={url} type="video/mp4" />
          브라우저가 비디오를 지원하지 않습니다.
        </video>
      </div>
    )
  }

  if (content.make_type_code === '2') {
    // PDF
    const pdfUrl = url?.includes('fss.or.kr')
      ? `${EDU_API}/api/proxy/fss-file?atchFileId=${new URL(url).searchParams.get('atchFileId')}&disposition=inline`
      : url
    return (
      <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: '1px solid #E2E8F0', height: 600 }}>
        <iframe src={pdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} title={content.title} />
      </div>
    )
  }

  if (content.make_type_code === '8') {
    return (
      <div style={{ background: 'white', borderRadius: 16, padding: '32px', border: '1px solid #E2E8F0' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>🎧 오디오북</h3>
        <audio controls style={{ width: '100%' }}>
          <source src={url} />
          브라우저가 오디오를 지원하지 않습니다.
        </audio>
      </div>
    )
  }

  return (
    <div style={{ background: 'white', borderRadius: 16, padding: '24px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{
        display: 'inline-block', background: '#0A3D62', color: 'white', padding: '12px 28px',
        borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none',
      }}>콘텐츠 열기 →</a>
    </div>
  )
}
