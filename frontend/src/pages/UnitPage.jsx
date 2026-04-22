import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../services/api'
import TutorCharacter from '../components/ai/TutorCharacter'
import Navbar from '../components/layout/Navbar'

const STAGE_COLORS = { 1: '#3b82f6', 2: '#8b5cf6', 3: '#22c55e' }

function NavBtn({ label, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 14px',
        borderRadius: '8px',
        border: '1px solid #d7e1ee',
        background: '#ffffff',
        color: disabled ? '#94a3b8' : '#1e293b',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '13px',
      }}
    >
      {label}
    </button>
  )
}

export default function UnitPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [unit, setUnit] = useState(null)
  const [allUnits, setAllUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [quizResult, setQuizResult] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSelectedOption(null)
    setQuizResult(null)
    setLoading(true)

    const load = async () => {
      try {
        const [unitRes, unitsRes, progressRes] = await Promise.all([
          api.get(`/api/v1/education/units/${id}`),
          api.get('/api/v1/education/units'),
          api.get('/api/v1/education/progress'),
        ])

        setUnit(unitRes.data)
        setAllUnits(unitsRes.data)

        const done = progressRes.data.find((p) => p.unit_id === id)
        if (done?.completed) setQuizResult({ correct: done.quiz_passed, explanation: null })
      } catch {
        setError('학습 데이터를 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id])

  const currentIndex = allUnits.findIndex((u) => u.id === id)
  const prevUnit = currentIndex > 0 ? allUnits[currentIndex - 1] : null
  const nextUnit = currentIndex < allUnits.length - 1 ? allUnits[currentIndex + 1] : null

  const handleQuizSubmit = async () => {
    if (selectedOption === null || saving) return
    setSaving(true)
    try {
      const res = await api.post(`/api/v1/education/units/${id}/quiz`, {
        selected_index: selectedOption,
      })
      setQuizResult(res.data)
    } catch {
      setQuizResult({ correct: false, explanation: '퀴즈 채점 중 오류가 발생했습니다.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f4f7fb' }}>
        <Navbar />
        <div style={{ textAlign: 'center', padding: '80px', color: '#64748b' }}>로딩 중...</div>
      </div>
    )
  }

  if (error || !unit) {
    return (
      <div style={{ minHeight: '100vh', background: '#f4f7fb' }}>
        <Navbar />
        <div style={{ textAlign: 'center', padding: '80px', color: '#ef4444' }}>
          {error || '학습 정보를 찾지 못했습니다.'}
        </div>
      </div>
    )
  }

  const color = STAGE_COLORS[unit.stage] || '#22c55e'
  const quizDone = quizResult !== null

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fb', color: '#0f172a' }}>
      <Navbar />
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <TutorCharacter
              size={48}
              mood={quizDone && quizResult.correct ? 'happy' : quizDone ? 'thinking' : 'neutral'}
              showBubble={false}
            />
            <div style={{ marginTop: '12px' }}>
              <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '999px', background: `${color}22`, color, border: `1px solid ${color}44` }}>
                {unit.stage}단계
              </span>
              <h1 style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px', color: '#0f172a' }}>
                {unit.title}
              </h1>
              {unit.description && (
                <p style={{ color: '#475569', fontSize: '14px', marginTop: '4px' }}>
                  {unit.description}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, marginTop: '4px' }}>
            <NavBtn label="이전" disabled={!prevUnit} onClick={() => prevUnit && navigate(`/education/${prevUnit.id}`)} />
            <NavBtn label="목록" onClick={() => navigate('/education')} />
            <NavBtn label="다음" disabled={!nextUnit} onClick={() => nextUnit && navigate(`/education/${nextUnit.id}`)} />
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', border: '1px solid #d7e1ee', marginBottom: '24px', lineHeight: '1.8', fontSize: '15px' }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => <h2 style={{ color: '#0f172a', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>{children}</h2>,
              h3: ({ children }) => <h3 style={{ color: '#1e293b', marginTop: '20px', marginBottom: '8px' }}>{children}</h3>,
              strong: ({ children }) => <strong style={{ color: '#16a34a' }}>{children}</strong>,
              blockquote: ({ children }) => (
                <blockquote style={{ borderLeft: `3px solid ${color}`, paddingLeft: '16px', color: '#475569', margin: '16px 0' }}>
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div style={{ overflowX: 'auto', margin: '16px 0' }}>
                  <table style={{ width: '100%', minWidth: '520px', borderCollapse: 'collapse', borderSpacing: 0 }}>
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => <thead>{children}</thead>,
              tbody: ({ children }) => <tbody>{children}</tbody>,
              tr: ({ children }) => <tr>{children}</tr>,
              th: ({ children }) => (
                <th style={{ background: '#f8fafc', padding: '10px 12px', textAlign: 'left', border: '1px solid #d7e1ee', color: '#334155', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td style={{ padding: '10px 12px', border: '1px solid #d7e1ee', color: '#0f172a', verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'keep-all' }}>
                  {children}
                </td>
              ),
              p: ({ children }) => <p style={{ margin: '12px 0', color: '#0f172a' }}>{children}</p>,
            }}
          >
            {unit.content}
          </ReactMarkdown>
        </div>

        {unit.quiz_question && unit.quiz_options && (
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #d7e1ee', marginBottom: '24px' }}>
            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '16px', color: '#0f172a' }}>퀴즈</div>
            <div style={{ marginBottom: '16px', color: '#1e293b', lineHeight: '1.6' }}>{unit.quiz_question}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {unit.quiz_options.map((opt, i) => {
                let bg = '#ffffff'
                let border = '#d7e1ee'
                if (!quizDone && selectedOption === i) {
                  bg = `${color}20`
                  border = color
                }
                if (quizDone && selectedOption === i) {
                  if (quizResult.correct) {
                    bg = '#dcfce7'
                    border = '#16a34a'
                  } else {
                    bg = '#fee2e2'
                    border = '#dc2626'
                  }
                }

                return (
                  <button
                    key={i}
                    onClick={() => !quizDone && setSelectedOption(i)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: `1px solid ${border}`,
                      background: bg,
                      color: '#0f172a',
                      textAlign: 'left',
                      cursor: quizDone ? 'default' : 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    {String.fromCharCode(9312 + i)} {opt}
                  </button>
                )
              })}
            </div>

            {!quizDone && (
              <button
                onClick={handleQuizSubmit}
                disabled={selectedOption === null || saving}
                style={{
                  marginTop: '16px',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  background: selectedOption !== null ? color : '#94a3b8',
                  color: '#ffffff',
                  border: 'none',
                  cursor: selectedOption !== null && !saving ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                  fontSize: '14px',
                }}
              >
                {saving ? '채점 중...' : '정답 확인'}
              </button>
            )}

            {quizDone && (
              <div style={{ marginTop: '16px', padding: '16px', borderRadius: '8px', background: quizResult.correct ? '#dcfce7' : '#fee2e2', border: `1px solid ${quizResult.correct ? '#16a34a' : '#dc2626'}` }}>
                <div style={{ fontWeight: 700, marginBottom: '8px', color: quizResult.correct ? '#16a34a' : '#dc2626' }}>
                  {quizResult.correct ? '정답입니다!' : '오답입니다.'}
                </div>
                {quizResult.explanation && (
                  <div style={{ fontSize: '14px', color: '#334155', lineHeight: '1.6' }}>
                    {quizResult.explanation}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {unit.source_url && (
          <div style={{ marginBottom: '24px' }}>
            <a
              href={unit.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #d7e1ee',
                color: '#2563eb',
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              {unit.source_label || '원문 보기'}
            </a>
          </div>
        )}

        {nextUnit ? (
          <div style={{ textAlign: 'right' }}>
            <button
              onClick={() => navigate(`/education/${nextUnit.id}`)}
              style={{
                padding: '12px 28px',
                borderRadius: '8px',
                background: color,
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              다음 학습: {nextUnit.title}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#16a34a', fontWeight: 700, fontSize: '18px' }}>
            모든 학습을 완료했습니다!
          </div>
        )}
      </div>
    </div>
  )
}
