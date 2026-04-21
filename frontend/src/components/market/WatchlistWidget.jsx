import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'

export default function WatchlistWidget({ onSelect }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/v1/watchlist')
      setList(data)
    } catch {
      // 인증 오류는 api.js 인터셉터에서 처리
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (code) => {
    try {
      await api.delete(`/api/v1/watchlist/${code}`)
      setList(prev => prev.filter(item => item.stock_code !== code))
    } catch (e) {
      alert('삭제 실패: ' + (e.response?.data?.detail ?? e.message))
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span>★ 관심종목</span>
        <button className="btn-sm" onClick={load}>새로고침</button>
      </div>

      {loading ? (
        <p className="muted">불러오는 중...</p>
      ) : list.length === 0 ? (
        <p className="muted empty-hint">관심종목을 추가해보세요.<br />종목 조회 후 ★ 버튼을 누르세요.</p>
      ) : (
        <ul className="watchlist">
          {list.map(item => (
            <li key={item.stock_code} className="watchlist-item" onClick={() => onSelect?.(item.stock_code)}>
              <span className="wl-name">{item.stock_name || item.stock_code}</span>
              <span className="wl-code">{item.stock_code}</span>
              <button
                className="btn-delete"
                onClick={e => { e.stopPropagation(); handleDelete(item.stock_code) }}
              >✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
