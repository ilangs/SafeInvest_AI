import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import TutorCharacter from '../components/ai/TutorCharacter'
import ChatWidget from '../components/ai/ChatWidget'
import Navbar from '../components/layout/Navbar'

const STAGE_LABELS = {
  1: '1단계: 기업 읽기',
  2: '2단계: 재무 해석',
  3: '3단계: 투자 판단',
}

const STAGE_COLORS = {
  1: '#3b82f6',
  2: '#8b5cf6',
  3: '#22c55e',
}

export default function EducationPage() {
  const navigate = useNavigate()
  const [units, setUnits] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [unitsRes, progressRes] = await Promise.all([
          api.get('/api/v1/education/units'),
          api.get('/api/v1/education/progress'),
        ])
        setUnits(unitsRes.data)
        const map = {}
        for (const p of progressRes.data) map[p.unit_id] = p
        setProgress(map)
      } catch {
        setError('교육 데이터를 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const completedCount = Object.values(progress).filter((p) => p.completed).length
  const totalCount = units.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const unitsByStage = (stage) => units.filter((u) => u.stage === stage)

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fb', color: '#0f172a' }}>
      <Navbar />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>투자 학습 모듈</h1>
          <p style={{ color: '#475569', marginBottom: '16px' }}>기초부터 실전까지 단계별로 학습하고 퀴즈로 점검해 보세요.</p>
          <TutorCharacter mood="neutral" />
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', marginBottom: '28px', border: '1px solid #d7e1ee' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: 600, color: '#1e293b' }}>진도율</span>
            <span style={{ color: '#16a34a', fontWeight: 700 }}>{completedCount}/{totalCount} 완료 ({pct}%)</span>
          </div>
          <div style={{ background: '#e2e8f0', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #22c55e, #16a34a)', borderRadius: '999px' }} />
          </div>
        </div>

        {loading && <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>로딩 중...</div>}
        {error && <div style={{ color: '#ef4444', textAlign: 'center', padding: '40px' }}>{error}</div>}

        {!loading && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {[1, 2, 3].map((stage) => {
              const stageUnits = unitsByStage(stage)
              const stageDone = stageUnits.filter((u) => progress[u.id]?.completed).length
              const color = STAGE_COLORS[stage]
              return (
                <div key={stage} style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #d7e1ee', overflow: 'hidden' }}>
                  <div style={{ background: `${color}15`, padding: '16px 20px', borderBottom: `1px solid ${color}44` }}>
                    <div style={{ fontWeight: 700, fontSize: '16px', color }}>{STAGE_LABELS[stage]}</div>
                    <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>{stageDone}/{stageUnits.length} 완료</div>
                  </div>

                  <div style={{ padding: '12px' }}>
                    {stageUnits.map((unit) => {
                      const done = progress[unit.id]?.completed
                      return (
                        <button
                          key={unit.id}
                          onClick={() => navigate(`/education/${unit.id}`)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            width: '100%',
                            padding: '12px',
                            marginBottom: '6px',
                            background: done ? `${color}15` : '#ffffff',
                            border: `1px solid ${done ? `${color}44` : '#d7e1ee'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: '#0f172a',
                            textAlign: 'left',
                          }}
                        >
                          <span
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              border: `2px solid ${done ? color : '#94a3b8'}`,
                              background: done ? color : 'transparent',
                              color: done ? '#ffffff' : '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              flexShrink: 0,
                            }}
                          >
                            {done ? '✓' : unit.unit_number}
                          </span>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{unit.title}</div>
                            {unit.description && <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{unit.description}</div>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: '38px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <TutorCharacter size={40} mood="neutral" showBubble={false} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px', color: '#0f172a' }}>AI 튜터 Q&A</div>
              <div style={{ fontSize: '13px', color: '#475569' }}>학습 중 궁금한 점을 바로 질문해 보세요.</div>
            </div>
          </div>
          <ChatWidget />
        </div>
      </div>
    </div>
  )
}
