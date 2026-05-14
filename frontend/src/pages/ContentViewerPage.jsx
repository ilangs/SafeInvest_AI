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

    fetch(url)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
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

  const labelText = (text) => {
    if (!text) return ''
    return String(text).replaceAll('SafeInvest', 'Ju-Dy')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Navbar />
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>
          불러오는 중...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Navbar />
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--danger)' }}>
          콘텐츠를 찾을 수 없습니다.
        </div>
      </div>
    )
  }

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

      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: d.answer,
          sources: d.sources || [],
          disclaimer: d.disclaimer,
        },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: '답변을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.',
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="cv-layout" style={styles.layout}>
      <Navbar />

      <style>{`
        /* ── ContentViewerPage 반응형 ── */
        @media (max-width: 1024px) {
          .cv-layout .cv-page-grid {
            grid-template-columns: 1fr !important;
          }
          .cv-layout .cv-chat-wrap {
            position: static !important;
            margin-top: 16px !important;
            height: 560px !important;
          }
        }
        @media (max-width: 768px) {
          .cv-layout .cv-page-grid { padding: 20px 16px 32px !important; gap: 16px !important; }
          .cv-layout .cv-content-card { padding: 18px !important; border-radius: 14px !important; }
          .cv-layout .cv-content-title { font-size: 19px !important; }
          .cv-layout .cv-content-summary { font-size: 14px !important; }
          .cv-layout .cv-breadcrumb { font-size: 13px !important; margin-bottom: 12px !important; }
          .cv-layout .cv-breadcrumb button { font-size: 13px !important; }
          .cv-layout .cv-pdf-box { height: 420px !important; }
          .cv-layout .cv-audio-box, .cv-layout .cv-fallback-card { padding: 22px !important; }
        }
        @media (max-width: 480px) {
          .cv-layout .cv-page-grid { padding: 14px 12px 28px !important; }
          .cv-layout .cv-content-card { padding: 14px !important; border-radius: 12px !important; }
          .cv-layout .cv-content-title { font-size: 17px !important; }
          .cv-layout .cv-content-summary { font-size: 13px !important; }
          .cv-layout .cv-related-grid {
            grid-template-columns: 1fr !important;
          }
          /* 챗 영역: 화면 거의 풀스크린 드로어 형태 */
          .cv-layout .cv-chat-wrap {
            position: fixed !important;
            top: auto !important;
            left: 8px !important;
            right: 8px !important;
            bottom: 8px !important;
            margin-top: 0 !important;
            height: 75vh !important;
            z-index: 999;
          }
          .cv-layout .cv-pdf-box { height: 340px !important; }
          .cv-layout .cv-open-chat-btn {
            right: 16px !important;
            bottom: 16px !important;
            width: 52px !important;
            height: 52px !important;
          }
          .cv-layout .cv-open-chat-btn img { width: 30px !important; height: 30px !important; }
        }
      `}</style>

      <div
        className="cv-page-grid"
        style={{
          ...styles.pageGrid,
          gridTemplateColumns: chatOpen ? '1fr 360px' : '1fr',
        }}
      >
        <div>
          <div className="cv-breadcrumb" style={styles.breadcrumb}>
            <button onClick={() => navigate('/education')} style={styles.breadcrumbBtn}>
              교육센터
            </button>
            <span>›</span>
            {!isSelf && content.topic_code && (
              <>
                <button
                  onClick={() => navigate(`/education/topic/${content.topic_code}`)}
                  style={styles.breadcrumbBtn}
                >
                  주제
                </button>
                <span>›</span>
              </>
            )}
            <span style={styles.breadcrumbCurrent}>콘텐츠</span>
          </div>

          <div className="cv-content-card" style={styles.contentCard}>
            <div style={styles.badgeRow}>
              <span style={styles.badgeBlue}>
                {labelText(content.make_type_name) || 'Ju-Dy 영상'}
              </span>

              {content.is_self_content && (
                <span style={styles.badgeGreen}>Team4 제작</span>
              )}

              {content.is_playable && (
                <span style={styles.badgeMint}>재생 가능</span>
              )}

              {content.playtime && (
                <span style={styles.badgeCream}>
                  {content.playtime || (content.playtime_minutes ? `${content.playtime_minutes}분` : '')}
                </span>
              )}
            </div>

            <h1 className="cv-content-title" style={styles.contentTitle}>{labelText(content.title) || '콘텐츠 제목'}</h1>

            <p className="cv-content-summary" style={styles.contentSummary}>
              {labelText(content.summary) || '콘텐츠 요약입니다.'}
            </p>

            {content.provider_name && (
              <div style={styles.provider}>
                제공 : {labelText(content.provider_name)} {content.producing_yr && `· ${content.producing_yr}`}
              </div>
            )}
          </div>

          <ContentPlayer content={content} />

          {related.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={styles.relatedTitle}>관련 콘텐츠</h3>

              <div className="cv-related-grid" style={styles.relatedGrid}>
                {related.map(r => (
                  <div
                    key={r.contents_slno}
                    onClick={() => navigate(`/education/content/${r.contents_slno}`)}
                    style={styles.relatedCard}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#286346')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    {r.title ? `${labelText(r.title).slice(0, 50)}...` : '관련 콘텐츠'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {chatOpen && (
          <div className="cv-chat-wrap" style={styles.chatWrap}>
            <div style={styles.chatBox}>
              <div style={styles.chatHeader}>
                <div style={styles.chatTitleWrap}>
                  <img src="/logo-tab.png" alt="Ju-Dy" style={styles.chatLogo} />
                  <div>
                    <div style={styles.chatTitle}>Ju-Dy</div>
                    <div style={styles.chatSubTitle}>이 콘텐츠 내용에 대해 질문하세요.</div>
                  </div>
                </div>

                <button onClick={() => setChatOpen(false)} style={styles.chatClose}>
                  ×
                </button>
              </div>

              <div style={styles.chatMessages}>
                {messages.length === 0 && (
                  <div>

                    {suggestedQs.length > 0 && (
                      <div>
                        <div style={styles.suggestTitle}>추천 질문</div>

                        {suggestedQs.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => sendChat(q)}
                            style={styles.suggestBtn}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = '#286346')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        ...styles.messageBubble,
                        ...(msg.role === 'user' ? styles.userBubble : styles.aiBubble),
                      }}
                    >
                      {msg.text}

                      {msg.sources?.length > 0 && (
                        <div style={styles.sourcesBox}>
                          <div style={styles.sourcesTitle}>참고 자료</div>
                          {msg.sources.slice(0, 2).map((s, si) => (
                            <div key={si} style={styles.sourceItem}>• {s.title}</div>
                          ))}
                        </div>
                      )}

                      {msg.disclaimer && (
                        <div style={styles.disclaimer}>{msg.disclaimer}</div>
                      )}
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={styles.loadingBubble}>답변 생성 중...</div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              <div style={styles.chatInputArea}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat(input)}
                  placeholder="질문을 입력하세요."
                  style={styles.chatInput}
                />

                <button
                  onClick={() => sendChat(input)}
                  disabled={!input.trim() || chatLoading}
                  style={{
                    ...styles.sendBtn,
                    opacity: !input.trim() || chatLoading ? 0.5 : 1,
                  }}
                >
                  전송
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!chatOpen && (
        <button onClick={() => setChatOpen(true)} className="cv-open-chat-btn" style={styles.openChatBtn}>
          <img src="/logo-tab.png" alt="Ju-Dy" style={styles.openChatImg} />
        </button>
      )}
    </div>
  )
}

function ContentPlayer({ content }) {
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
      <div className="cv-fallback-card" style={styles.fallbackCard}>
        <div style={{ fontSize: 42, marginBottom: 16 }}>📄</div>
        <h3 style={styles.fallbackTitle}>직접 재생이 어려운 콘텐츠입니다</h3>
        <p style={styles.fallbackText}>
          외부 제공 콘텐츠는 AI 요약 및 관련 자료를 통해 학습할 수 있습니다.
        </p>

        {content.url && (
          <a
            href={resolveUrl(content.url)}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.linkBtn}
          >
            원본 사이트에서 보기 →
          </a>
        )}
      </div>
    )
  }

  if (content.make_type_code === '9' || content.is_self_content) {
    const videoUrl = resolveUrl(content.url || content.video_path)

    return (
      <div style={styles.videoBox}>
        <video controls style={styles.video} preload="metadata">
          <source src={videoUrl} type="video/mp4" />
          브라우저가 비디오를 지원하지 않습니다.
        </video>
      </div>
    )
  }

  const url = resolveUrl(content.url || content.external_url || content.file_down_url)

  if (content.make_type_code === '1' && url && !url.includes('youtu') && !isDirectMediaUrl(url)) {
    return (
      <div style={styles.iframeBox}>
        <iframe
          src={url}
          title={content.title || '영상'}
          style={styles.iframe}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  if (content.make_type_code === '1') {
    if (url?.includes('youtu')) {
      const videoId = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1]

      return (
        <div style={styles.iframeBox}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            style={styles.iframe}
            allowFullScreen
            title={content.title}
          />
        </div>
      )
    }

    return (
      <div style={styles.videoBox}>
        <video controls style={{ width: '100%', maxHeight: 500, display: 'block' }}>
          <source src={url} type="video/mp4" />
          브라우저가 비디오를 지원하지 않습니다.
        </video>
      </div>
    )
  }

  if (content.make_type_code === '2') {
    const pdfUrl = url?.includes('fss.or.kr')
      ? `${EDU_API}/api/proxy/fss-file?atchFileId=${new URL(url).searchParams.get('atchFileId')}&disposition=inline`
      : url

    return (
      <div className="cv-pdf-box" style={styles.pdfBox}>
        <iframe src={pdfUrl} style={styles.iframe} title={content.title} />
      </div>
    )
  }

  if (content.make_type_code === '8') {
    return (
      <div className="cv-audio-box" style={styles.audioBox}>
        <h3 style={styles.audioTitle}>오디오북</h3>
        <audio controls style={{ width: '100%' }}>
          <source src={url} />
          브라우저가 오디오를 지원하지 않습니다.
        </audio>
      </div>
    )
  }

  return (
    <div className="cv-fallback-card" style={styles.fallbackCard}>
      <a href={url} target="_blank" rel="noopener noreferrer" style={styles.linkBtn}>
        콘텐츠 열기 →
      </a>
    </div>
  )
}

const styles = {
  layout: {
    minHeight: '100vh',
    background: 'var(--bg-primary)',
    fontFamily: "'IBM Plex Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
  },

  pageGrid: {
    maxWidth: 1440,
    margin: '0 auto',
    padding: '28px 24px 36px',
    display: 'grid',
    gap: 24,
  },

  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    fontSize: 15,
    color: 'var(--text-secondary)',
  },

  breadcrumbBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--brand)',
    fontFamily: 'inherit',
    fontSize: 15,
    fontWeight: 600,
    padding: 0,
  },

  breadcrumbCurrent: {
    color: 'var(--text-primary)',
    fontWeight: 600,
  },

  contentCard: {
    background: 'var(--bg-card)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-md)',
  },

  badgeRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 12,
  },

  badgeBlue: {
    fontSize: 12,
    background: 'var(--bg-subtle)',
    color: 'var(--text-secondary)',
    padding: '4px 10px',
    borderRadius: 20,
    fontWeight: 700,
  },

  badgeGreen: {
    fontSize: 12,
    background: 'var(--brand-bg)',
    color: 'var(--brand)',
    padding: '4px 10px',
    borderRadius: 20,
    fontWeight: 700,
  },

  badgeMint: {
    fontSize: 12,
    background: 'rgba(106,90,163,0.14)',
    color: '#8b7ec0',
    padding: '4px 10px',
    borderRadius: 20,
    fontWeight: 700,
  },

  badgeCream: {
    fontSize: 12,
    background: 'rgba(245,158,11,0.15)',
    color: 'var(--warning)',
    padding: '4px 10px',
    borderRadius: 20,
    fontWeight: 700,
  },

  contentTitle: {
    fontSize: 23,
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.4,
    marginBottom: 10,
  },

  contentSummary: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    lineHeight: 1.65,
    margin: 0,
  },

  provider: {
    marginTop: 12,
    fontSize: 13,
    color: 'var(--text-muted)',
  },

  relatedTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 12,
  },

  relatedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12,
  },

  relatedCard: {
    background: 'var(--bg-card)',
    borderRadius: 12,
    padding: 14,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--text-primary)',
    fontWeight: 500,
    transition: 'border-color 0.15s',
  },

  chatWrap: {
    position: 'sticky',
    top: 24,
    marginTop: 37,
    height: 725,
    display: 'flex',
    flexDirection: 'column',
  },

  chatBox: {
    background: 'var(--bg-card)',
    borderRadius: 16,
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-md)',
  },

  chatHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  chatTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  chatLogo: {
    width: 35,
    height: 35,
    objectFit: 'contain',
  },

  chatTitle: {
    fontWeight: 800,
    color: 'var(--text-primary)',
    fontSize: 17,
  },

  chatSubTitle: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginTop: 2,
  },

  chatClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    fontSize: 18,
  },

  chatMessages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  chatGuide: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 12,
    lineHeight: 1.5,
  },

  suggestTitle: {
    fontSize: 13,
    color: 'var(--text-muted)',
    marginBottom: 13,
    fontWeight: 700,
    letterSpacing: '0.04em',
  },

  suggestBtn: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    marginBottom: 6,
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1.4,
    transition: 'all 0.15s',
  },

  messageBubble: {
    maxWidth: '85%',
    padding: '10px 14px',
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 1.5,
  },

  userBubble: {
    background: 'var(--brand)',
    color: 'var(--text-on-brand)',
    border: 'none',
  },

  aiBubble: {
    background: 'var(--bg-subtle)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-subtle)',
  },

  sourcesBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid var(--border-subtle)',
  },

  sourcesTitle: {
    fontSize: 10,
    color: 'var(--text-muted)',
    marginBottom: 4,
  },

  sourceItem: {
    fontSize: 11,
    color: 'var(--text-secondary)',
  },

  disclaimer: {
    fontSize: 10,
    color: 'var(--text-muted)',
    marginTop: 6,
  },

  loadingBubble: {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 12,
    padding: '10px 14px',
    fontSize: 13,
    color: 'var(--text-muted)',
  },

  chatInputArea: {
    padding: '12px 16px',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    gap: 8,
  },

  chatInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 10,
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
    background: 'var(--bg-elevated)',
  },

  sendBtn: {
    background: 'var(--brand)',
    color: 'var(--text-on-brand)',
    border: 'none',
    borderRadius: 10,
    padding: '8px 14px',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 700,
  },

  openChatBtn: {
    position: 'fixed',
    bottom: 32,
    right: 32,
    background: 'var(--brand)',
    border: 'none',
    borderRadius: 50,
    width: 58,
    height: 58,
    cursor: 'pointer',
    boxShadow: '0 8px 22px rgba(40,99,70,0.28)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  openChatImg: {
    width: 35,
    height: 35,
    objectFit: 'contain',
  },

  videoBox: {
    background: '#000000',
    borderRadius: 16,
    overflow: 'hidden',
  },

  video: {
    width: '100%',
    maxHeight: 520,
    display: 'block',
  },

  iframeBox: {
    background: '#000000',
    borderRadius: 16,
    overflow: 'hidden',
    aspectRatio: '16/9',
  },

  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
  },

  pdfBox: {
    background: 'var(--bg-card)',
    borderRadius: 16,
    overflow: 'hidden',
    border: '1px solid var(--border)',
    height: 600,
  },

  audioBox: {
    background: 'var(--bg-card)',
    borderRadius: 16,
    padding: 32,
    border: '1px solid var(--border)',
  },

  audioTitle: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 16,
    color: 'var(--text-primary)',
  },

  fallbackCard: {
    background: 'var(--bg-card)',
    borderRadius: 16,
    padding: 32,
    border: '1px solid var(--border)',
    textAlign: 'center',
  },

  fallbackTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 8,
  },

  fallbackText: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 20,
  },

  linkBtn: {
    display: 'inline-block',
    background: 'var(--brand)',
    color: 'var(--text-on-brand)',
    padding: '10px 24px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: 'none',
  },
}