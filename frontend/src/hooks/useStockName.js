/**
 * useStockName(code)
 * 종목코드 → 기업명을 반환하는 공유 캐시 훅.
 *
 * 조회 순서:
 *  1. 모듈 캐시 (탭 전환 후에도 재요청 없음)
 *  2. GET /api/v1/stocks/{code} → stock_name  (Supabase stocks 테이블)
 *  3. GET /api/v1/market/quote?symbol={code} → name  (KIS API 폴백)
 *
 * 반환: 기업명 string | null (로딩 중 or 미지원 종목)
 */
import { useState, useEffect } from 'react'
import api from '../services/api'

const cache = new Map()    // code → name
const pending = new Set()  // 중복 요청 방지

export function useStockName(code) {
  const key = code ? String(code).padStart(6, '0') : ''
  const [name, setName] = useState(() => cache.get(key) ?? null)

  useEffect(() => {
    if (!key) return
    if (cache.has(key)) { setName(cache.get(key)); return }
    if (pending.has(key)) return

    pending.add(key)

    // 1순위: Supabase stocks 테이블 (전체 2610개 종목)
    api.get(`/api/v1/stocks/${key}`)
      .then(r => {
        const n = r.data?.stock_name
        if (n) { cache.set(key, n); setName(n) }
      })
      .catch(() => {
        // 2순위: KIS 시세 API (DB에 없는 종목용 폴백)
        api.get(`/api/v1/market/quote?symbol=${key}`)
          .then(r => {
            const n = r.data?.name
            if (n) { cache.set(key, n); setName(n) }
          })
          .catch(() => {})
      })
      .finally(() => pending.delete(key))
  }, [key])

  return name
}
