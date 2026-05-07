import { useState, useEffect } from 'react'
import Navbar from '../components/layout/Navbar'
import api from '../services/api'

const PAGE_SIZE = 5

function formatDate(isoDate) {
  if (!isoDate) return ''
  return isoDate.replace(/-/g, '.')
}

export default function StudyLogPage() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const [selectedLog, setSelectedLog] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [writing, setWriting] = useState(false)
  const [saving, setSaving] = useState(false)

  const [writeForm, setWriteForm] = useState({ title: '', tag: '', mood: '', content: '' })

  // ── 목록 로드 ──────────────────────────────────────────────────────────────

  const fetchLogs = async (targetPage = page) => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/v1/study-logs', {
        params: { page: targetPage, size: PAGE_SIZE },
      })
      setLogs(data.logs)
      setTotal(data.total)
      setTodayCount(data.today_count)
      setTotalPages(data.total_pages)
    } catch {
      // 에러 시 빈 목록 유지
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs(page)
  }, [page])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedLog, editing, writing, page])

  // ── 작성 ──────────────────────────────────────────────────────────────────

  const handleWriteSave = async () => {
    if (!writeForm.title.trim() || !writeForm.content.trim()) return
    setSaving(true)
    try {
      await api.post('/api/v1/study-logs', {
        title:   writeForm.title   || '새 스터디 로그',
        content: writeForm.content,
        tag:     writeForm.tag     || '학습기록',
        mood:    writeForm.mood    || '기록',
      })
      setWriteForm({ title: '', tag: '', mood: '', content: '' })
      setWriting(false)
      setPage(1)
      await fetchLogs(1)
    } finally {
      setSaving(false)
    }
  }

  // ── 수정 ──────────────────────────────────────────────────────────────────

  const handleEditStart = () => {
    setEditForm({ ...selectedLog })
    setEditing(true)
  }

  const handleEditSave = async () => {
    setSaving(true)
    try {
      const { data } = await api.put(`/api/v1/study-logs/${editForm.id}`, {
        title:   editForm.title,
        content: editForm.content,
        tag:     editForm.tag,
        mood:    editForm.mood,
      })
      const updated = data
      setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
      setSelectedLog(updated)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  // ── 삭제 ──────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    try {
      await api.delete(`/api/v1/study-logs/${selectedLog.id}`)
      goToList()
      const newTotal = total - 1
      const maxPage = Math.max(Math.ceil(newTotal / PAGE_SIZE), 1)
      const targetPage = page > maxPage ? maxPage : page
      setPage(targetPage)
      await fetchLogs(targetPage)
    } catch {
      // 실패 시 목록 재조회
      await fetchLogs(page)
    }
  }

  // ── 네비게이션 ────────────────────────────────────────────────────────────

  const goToList = () => {
    setSelectedLog(null)
    setEditing(false)
    setWriting(false)
  }

  // ── 작성 화면 ─────────────────────────────────────────────────────────────

  if (writing) {
    return (
      <div className="app-layout">
        <Navbar />
        <main style={styles.page}>
          <section style={styles.header}>
            <h1 style={styles.title}>Study Log</h1>
            <p style={styles.subtitle}>주식 공부 기록과 투자 학습 일기를 자유롭게 남깁니다.</p>
          </section>

          <section style={styles.writeCard}>
            <input
              style={styles.editInput}
              placeholder="제목을 입력하세요."
              value={writeForm.title}
              onChange={(e) => setWriteForm({ ...writeForm, title: e.target.value })}
            />

            <div style={styles.rowInputs}>
              <input
                style={{ ...styles.editInputSmall, flex: 1 }}
                placeholder="태그 예: 차트공부"
                value={writeForm.tag}
                onChange={(e) => setWriteForm({ ...writeForm, tag: e.target.value })}
              />
              <input
                style={{ ...styles.editInputSmall, flex: 1 }}
                placeholder="오늘의 상태 예: 복습, 반성, 연습"
                value={writeForm.mood}
                onChange={(e) => setWriteForm({ ...writeForm, mood: e.target.value })}
              />
            </div>

            <textarea
              style={styles.editTextarea}
              placeholder="오늘 공부한 내용이나 투자 복기 내용을 입력하세요."
              value={writeForm.content}
              onChange={(e) => setWriteForm({ ...writeForm, content: e.target.value })}
            />

            <p style={styles.aiNote}>💬 AI 코멘트는 저장 후 자동으로 생성됩니다.</p>

            <div style={styles.buttonRow}>
              <button style={styles.greenBtn} onClick={handleWriteSave} disabled={saving}>
                {saving ? '저장 중...' : '등록'}
              </button>
              <button style={styles.grayBtn} onClick={goToList} disabled={saving}>
                취소
              </button>
            </div>
          </section>
        </main>
      </div>
    )
  }

  // ── 상세 / 수정 화면 ──────────────────────────────────────────────────────

  if (selectedLog) {
    return (
      <div className="app-layout">
        <Navbar />
        <main style={styles.page}>
          <section style={styles.header}>
            <h1 style={styles.title}>Study Log</h1>
            <p style={styles.subtitle}>주식 공부 기록과 투자 학습 일기를 자유롭게 남깁니다.</p>
          </section>

          <section style={editing ? styles.writeCard : styles.detailCard}>
            {editing ? (
              <>
                <input
                  style={styles.editInput}
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />

                <div style={styles.rowInputs}>
                  <input
                    style={{ ...styles.editInputSmall, flex: 1 }}
                    placeholder="태그"
                    value={editForm.tag || ''}
                    onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })}
                  />
                  <input
                    style={{ ...styles.editInputSmall, flex: 1 }}
                    placeholder="오늘의 상태"
                    value={editForm.mood || ''}
                    onChange={(e) => setEditForm({ ...editForm, mood: e.target.value })}
                  />
                </div>

                <textarea
                  style={styles.editTextarea}
                  value={editForm.content}
                  onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                />

                <div style={styles.buttonRow}>
                  <button style={styles.greenBtn} onClick={handleEditSave} disabled={saving}>
                    {saving ? '저장 중...' : '저장'}
                  </button>
                  <button style={styles.grayBtn} onClick={() => setEditing(false)} disabled={saving}>
                    취소
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={styles.detailTop}>
                  <span style={styles.badge}>{selectedLog.tag}</span>
                  <span style={styles.date}>{formatDate(selectedLog.log_date)}</span>
                </div>

                <h2 style={styles.detailTitle}>{selectedLog.title}</h2>

                <p style={styles.mood}>오늘의 상태 : {selectedLog.mood}</p>

                <div style={styles.contentBox}>{selectedLog.content}</div>

                {selectedLog.ai_comment && (
                  <div style={styles.aiBox}>
                    <strong>AI 한줄 코멘트</strong>
                    <p>{selectedLog.ai_comment}</p>
                  </div>
                )}

                <div style={styles.buttonRow}>
                  <button style={styles.greenBtn} onClick={handleEditStart}>수정</button>
                  <button style={styles.redBtn} onClick={handleDelete}>삭제</button>
                  <button style={styles.grayBtn} onClick={goToList}>목록으로</button>
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    )
  }

  // ── 목록 화면 ─────────────────────────────────────────────────────────────

  return (
    <div className="app-layout">
      <Navbar />
      <main style={styles.page}>
        <section style={styles.header}>
          <h1 style={styles.title}>Study Log</h1>
          <p style={styles.subtitle}>주식 공부 기록과 투자 학습 일기를 자유롭게 남깁니다.</p>
        </section>

        <section style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <strong>오늘의 기록</strong>
            <span>{todayCount}개</span>
          </div>
          <div style={styles.summaryCard}>
            <strong>전체 기록</strong>
            <span>{total}개</span>
          </div>
          <button style={styles.writeSummaryCard} onClick={() => setWriting(true)}>
            <strong>글쓰기</strong>
            <span>Click</span>
          </button>
        </section>

        <section style={styles.logList}>
          {loading ? (
            <p style={styles.emptyText}>불러오는 중...</p>
          ) : logs.length === 0 ? (
            <p style={styles.emptyText}>첫 번째 학습 일기를 작성해 보세요!</p>
          ) : (
            logs.map((log) => (
              <article
                key={log.id}
                style={styles.logRow}
                onClick={() => setSelectedLog(log)}
              >
                <span style={styles.badge}>{log.tag}</span>
                <h3 style={styles.rowTitle}>{log.title}</h3>
                <span style={styles.date}>{formatDate(log.log_date)}</span>
              </article>
            ))
          )}
        </section>

        {totalPages > 1 && (
          <div style={styles.pagination}>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                style={{ ...styles.pageBtn, ...(page === i + 1 ? styles.pageBtnActive : {}) }}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: '56px 24px 80px',
    background: '#f5f5f5',
  },
  header: {
    textAlign: 'center',
    marginBottom: 34,
  },
  title: {
    fontSize: 40,
    fontWeight: 800,
    color: '#2f6f4f',
    marginBottom: 10,
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 16,
  },
  summaryGrid: {
    maxWidth: 800,
    margin: '0 auto 28px',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 14,
  },
  summaryCard: {
    background: 'linear-gradient(135deg, #1f4f3a 0%, #2f6f4f 55%, #3e8e63 100%)',
    color: '#ffffff',
    borderRadius: 16,
    padding: '18px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 14px 34px rgba(47,111,79,0.18)',
  },
  writeSummaryCard: {
    background: 'linear-gradient(135deg, #1f4f3a 0%, #2f6f4f 55%, #3e8e63 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 16,
    padding: '18px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 14px 34px rgba(47,111,79,0.18)',
    cursor: 'pointer',
    fontSize: 16,
    fontFamily: 'inherit',
  },
  logList: {
    maxWidth: 800,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  logRow: {
    background: '#ffffff',
    border: '1px solid #dbe5de',
    borderLeft: '6px solid #2f6f4f',
    borderRadius: 16,
    padding: '12px 20px',
    display: 'grid',
    gridTemplateColumns: '110px 1fr 110px',
    alignItems: 'center',
    gap: 16,
    cursor: 'pointer',
    boxShadow: '0 12px 30px rgba(47,111,79,0.09)',
  },
  badge: {
    background: '#eef6f0',
    color: '#2f6f4f',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    textAlign: 'center',
  },
  rowTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: 400,
    margin: 0,
  },
  date: {
    color: '#6b7280',
    fontSize: 15,
    textAlign: 'right',
    paddingRight: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 15,
    padding: '40px 0',
  },
  pagination: {
    marginTop: 26,
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
  },
  pageBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#ffffff',
    color: '#2f6f4f',
    fontWeight: 700,
    cursor: 'pointer',
  },
  pageBtnActive: {
    background: '#2f6f4f',
    color: '#ffffff',
    border: '1px solid #2f6f4f',
    outline: 'none',
    boxShadow: 'none',
  },
  detailCard: {
    maxWidth: 800,
    margin: '0 auto',
    background: '#ffffff',
    border: '1px solid #dbe5de',
    borderRadius: 20,
    padding: 34,
    boxShadow: '0 18px 44px rgba(47,111,79,0.12)',
  },
  writeCard: {
    maxWidth: 800,
    margin: '0 auto',
    background: '#eef6f0',
    border: '1px solid #dbe5de',
    borderRadius: 20,
    padding: 34,
    boxShadow: '0 18px 44px rgba(47,111,79,0.12)',
  },
  detailTop: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  detailTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: '#111827',
    marginBottom: 12,
  },
  mood: {
    color: '#2f6f4f',
    fontWeight: 700,
    marginBottom: 22,
  },
  contentBox: {
    whiteSpace: 'pre-wrap',
    color: '#374151',
    lineHeight: 1.9,
    fontSize: 15,
    padding: 22,
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    marginBottom: 20,
  },
  aiBox: {
    background: '#eef6f0',
    border: '1px solid #dbe5de',
    borderRadius: 14,
    padding: 18,
    color: '#1f2937',
    lineHeight: 1.7,
    marginBottom: 24,
  },
  buttonRow: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
  },
  greenBtn: {
    background: '#2f6f4f',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  redBtn: {
    background: '#c83a3a',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  grayBtn: {
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    padding: '10px 18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  rowInputs: {
    display: 'flex',
    gap: 12,
    marginBottom: 12,
  },
  editInput: {
    width: '100%',
    padding: 14,
    borderRadius: 10,
    border: '1px solid #d1d5db',
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 16,
    background: '#ffffff',
    boxSizing: 'border-box',
  },
  editInputSmall: {
    padding: 12,
    borderRadius: 10,
    border: '1px solid #d1d5db',
    fontSize: 15,
    background: '#ffffff',
    boxSizing: 'border-box',
  },
  editTextarea: {
    width: '100%',
    minHeight: 220,
    padding: 14,
    borderRadius: 10,
    border: '1px solid #d1d5db',
    fontSize: 15,
    lineHeight: 1.8,
    marginBottom: 16,
    resize: 'vertical',
    background: '#ffffff',
    boxSizing: 'border-box',
  },
  aiNote: {
    color: '#6b7280',
    fontSize: 13,
    marginBottom: 16,
  },
}
