import { useState } from 'react'
import { api } from '../../../services/analysisApi.js'
import ExplainBox from '../shared/ExplainBox.jsx'

export default function TabAI({ ticker, stock, score }) {
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const runAI = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await api.aiAnalysis(ticker)
      setResult(res.result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>AI 분석</h2>
      <ExplainBox
        title="AI 분석 안내"
        body="AI 설명은 참고용이며 투자 추천이 아닙니다. API 키가 없거나 오류가 발생하면 제공되지 않습니다."
        type="info"
      />

      <div style={{ marginTop: 20 }}>
        <button className="an-btn-primary" onClick={runAI} disabled={loading}>
          {loading ? '🤖 AI 분석 중...' : '🤖 AI로 쉽게 설명 받기'}
        </button>
      </div>

      {loading && (
        <div className="an-loading" style={{ padding: '40px 0' }}>
          <div className="an-spinner" />
          <p>AI가 종목을 분석하고 있습니다...</p>
        </div>
      )}

      {error && (
        <ExplainBox
          title="⚠️ AI 분석 오류"
          body={`AI 분석 중 오류가 발생했습니다: ${error}`}
          type="warning"
        />
      )}

      {result && (
        <div
          className="an-glass-card"
          style={{ marginTop: 20, lineHeight: 1.85, fontSize: 16, color: '#dbeafe', whiteSpace: 'pre-wrap' }}
        >
          {result}
        </div>
      )}
    </div>
  )
}
