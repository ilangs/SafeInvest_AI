import { useEffect, useState } from 'react'
import Navbar from '../components/layout/Navbar'
import ThemeSelector from '../components/settings/ThemeSelector'
import api from '../services/api'

const EMPTY_FORM = {
  appKey: '',
  appSecret: '',
  accountNo: '',
  submitting: false,
  error: '',
  success: '',
}

export default function MyPage() {
  const [statusList, setStatusList] = useState([])
  const [loading, setLoading] = useState(true)
  const [forms, setForms] = useState({
    true: { ...EMPTY_FORM },
    false: { ...EMPTY_FORM },
  })
  const [guideOpen, setGuideOpen] = useState(false)

  const fetchStatus = async () => {
    const res = await api.get('/api/v1/credentials/status')
    setStatusList(res.data || [])
  }

  const fetchProfile = async () => {
    const res = await api.get('/api/v1/credentials/profile')
    const nextForms = {
      true: { ...EMPTY_FORM },
      false: { ...EMPTY_FORM },
    }

    for (const row of res.data || []) {
      nextForms[row.is_mock] = {
        ...nextForms[row.is_mock],
        appKey: row.app_key || '',
        appSecret: row.app_secret || '',
        accountNo: row.account_no || '',
      }
    }

    setForms(prev => ({
      true: { ...prev.true, ...nextForms.true },
      false: { ...prev.false, ...nextForms.false },
    }))
  }

  useEffect(() => {
    Promise.allSettled([fetchStatus(), fetchProfile()])
      .then(results => {
        results.forEach(result => {
          if (result.status === 'rejected') {
            console.error('KIS 데이터 불러오기 실패', result.reason)
          }
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const getStatus = (isMock) =>
    statusList.find(s => s.is_mock === isMock) || {
      is_connected: false,
      is_mock: isMock,
      account_no_masked: null,
      token_valid: false,
    }

  const updateForm = (isMock, patch) => {
    setForms(prev => ({ ...prev, [isMock]: { ...prev[isMock], ...patch } }))
  }

  const handleConnect = async (isMock) => {
    const f = forms[isMock]
    if (!f.appKey || !f.appSecret || !f.accountNo) {
      updateForm(isMock, { error: 'APP KEY, APP SECRET, 계좌번호를 모두 입력해 주세요.' })
      return
    }

    updateForm(isMock, { submitting: true, error: '', success: '' })
    try {
      const res = await api.post('/api/v1/credentials/connect', {
        app_key: f.appKey,
        app_secret: f.appSecret,
        account_no: f.accountNo,
        is_mock: isMock,
      })
      updateForm(isMock, {
        submitting: false,
        success: res.data.message || '저장되었습니다.',
      })
      await fetchStatus()
      await fetchProfile()
    } catch (e) {
      updateForm(isMock, {
        submitting: false,
        error: e.response?.data?.detail || 'KIS 연결에 실패했습니다.',
      })
    }
  }

  const handleDisconnect = async (isMock) => {
    if (!window.confirm(`${isMock ? '모의투자' : '실거래'} 연결을 삭제할까요?`)) return
    try {
      await api.delete(`/api/v1/credentials/${isMock}`)
      await fetchStatus()
      await fetchProfile()
    } catch (e) {
      console.error('연결 삭제 실패', e)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: "'IBM Plex Sans KR', -apple-system, sans-serif" }}>
      <Navbar />

      <div className="mypage-wrap" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
        {/* 화면 스타일 선택 */}
        <ThemeSelector />

        <div style={{ marginBottom: 28 }}>
          <h1 className="mypage-title" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            KIS 계좌 연결
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            KIS Developers에서 발급받은 APP KEY, APP SECRET, 계좌번호를 입력하고 연결해 주세요.
          </p>
          <a
            href="https://apiportal.koreainvestment.com"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, color: 'var(--info)', fontWeight: 600, textDecoration: 'none' }}
          >
            KIS Developers 바로가기
          </a>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>불러오는 중...</div>
        ) : (
          <>
            <KISCard
              isMock={true}
              status={getStatus(true)}
              form={forms.true}
              onFormChange={(patch) => updateForm(true, patch)}
              onConnect={() => handleConnect(true)}
              onDisconnect={() => handleDisconnect(true)}
            />

            <KISCard
              isMock={false}
              status={getStatus(false)}
              form={forms.false}
              onFormChange={(patch) => updateForm(false, patch)}
              onConnect={() => handleConnect(false)}
              onDisconnect={() => handleDisconnect(false)}
            />

            <div
              style={{
                background: 'var(--bg-card)',
                borderRadius: 16,
                border: '1px solid var(--border)',
                overflow: 'hidden',
                marginTop: 8,
              }}
            >
              <button
                onClick={() => setGuideOpen(o => !o)}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  background: 'none',
                  border: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>KIS 연결 방법</span>
                <span
                  style={{
                    fontSize: 16,
                    color: 'var(--text-muted)',
                    transform: guideOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                >
                  ▾
                </span>
              </button>
              {guideOpen && (
                <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                  <ol style={{ paddingLeft: 20, margin: 0, color: 'var(--text-primary)', fontSize: 13, lineHeight: 2 }}>
                    <li>
                      <a href="https://apiportal.koreainvestment.com" target="_blank" rel="noreferrer" style={{ color: 'var(--info)' }}>
                        apiportal.koreainvestment.com
                      </a>{' '}
                      에 접속합니다.
                    </li>
                    <li>
                      메뉴에서 <strong>OpenAPI</strong> 또는 <strong>앱 등록</strong> 항목을 찾습니다.
                    </li>
                    <li>
                      모의투자는 <strong>모의투자 APP KEY</strong>, 실거래는 <strong>실거래 APP KEY</strong>를 사용합니다.
                    </li>
                    <li>
                      발급받은 <strong>APP KEY</strong> / <strong>APP SECRET</strong> 을 입력합니다.
                    </li>
                    <li>
                      계좌번호는 하이픈 포함 형식도 입력할 수 있습니다. 예 : <code>50123456-01</code>
                    </li>
                  </ol>
                  <div
                    style={{
                      marginTop: 12,
                      padding: '10px 14px',
                      background: 'rgba(245,158,11,0.12)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'var(--warning)',
                    }}
                  >
                    APP SECRET은 암호화되어 DB에 저장됩니다. 화면에는 복원되고, 서버에는 암호문으로 보관합니다.
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function KISCard({ isMock, status, form, onFormChange, onConnect, onDisconnect }) {
  const label = isMock ? '모의투자' : '실거래'
  const btnColor = isMock ? 'var(--info)' : 'var(--danger)'

  return (
    <div
      className="mypage-kis-card"
      style={{
        background: 'var(--bg-card)',
        borderRadius: 16,
        padding: '24px',
        marginBottom: 16,
        border: '1px solid var(--border)',
      }}
    >
      <div className="mypage-kis-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: status.is_connected ? 'var(--success)' : 'var(--text-muted)',
            }}
          />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {label} 연결
          </span>
          {status.is_connected && (
            <span
              style={{
                fontSize: 12,
                background: status.token_valid ? 'var(--brand-bg)' : 'rgba(245,158,11,0.15)',
                color: status.token_valid ? 'var(--brand)' : 'var(--warning)',
                padding: '5px 12px',
                borderRadius: 20,
                fontWeight: 600,
              }}
            >
              {status.token_valid ? '연결됨' : '토큰 갱신 필요'}
            </span>
          )}
        </div>
        {!isMock && (
          <span
            style={{
              fontSize: 12,
              background: 'rgba(220,38,38,0.12)',
              color: 'var(--danger)',
              padding: '5px 12px',
              borderRadius: 20,
              fontWeight: 600,
            }}
          >
            실거래 주의
          </span>
        )}
      </div>

      {status.is_connected ? (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            저장된 계좌번호: <strong style={{ color: 'var(--text-primary)' }}>{status.account_no_masked}</strong>
          </div>
          <button
            onClick={onDisconnect}
            style={{
              padding: '8px 18px',
              background: 'var(--bg-subtle)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            연결 삭제
          </button>
        </div>
      ) : (
        <div>
          {!isMock && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(245,158,11,0.12)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--warning)',
                marginBottom: 14,
              }}
            >
              실거래는 먼저 모의투자 연결이 필요할 수 있습니다.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FormField
              label="APP KEY"
              value={form.appKey}
              onChange={v => onFormChange({ appKey: v })}
              placeholder="KIS Developers에서 발급한 APP KEY"
            />
            <FormField
              label="APP SECRET"
              type="password"
              value={form.appSecret}
              onChange={v => onFormChange({ appSecret: v })}
              placeholder="APP SECRET"
            />
            <FormField
              label="계좌번호"
              value={form.accountNo}
              onChange={v => onFormChange({ accountNo: v })}
              placeholder="예: 50123456-01"
            />
          </div>

          {form.error && (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--danger)', padding: '8px 12px', background: 'rgba(220,38,38,0.10)', borderRadius: 8 }}>
              {form.error}
            </div>
          )}
          {form.success && (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--success)', padding: '8px 12px', background: 'var(--brand-bg)', borderRadius: 8 }}>
              {form.success}
            </div>
          )}

          <button
            onClick={onConnect}
            disabled={form.submitting}
            style={{
              marginTop: 14,
              width: '100%',
              padding: '11px',
              background: form.submitting ? 'var(--text-muted)' : btnColor,
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: form.submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {form.submitting ? '연결 중...' : `${label} 연결`}
          </button>
        </div>
      )}
    </div>
  )
}

function FormField({ label, type = 'text', value, onChange, placeholder }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={type === 'password' ? 'new-password' : 'off'}
        style={{
          width: '100%',
          padding: '9px 12px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          fontSize: 13,
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          color: 'var(--text-primary)',
          background: 'var(--bg-elevated)',
        }}
      />
    </div>
  )
}
