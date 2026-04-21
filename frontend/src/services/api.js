import axios from 'axios'
import { supabase } from './supabase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

// 요청 인터셉터: Supabase 세션 토큰 자동 주입
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// 응답 인터셉터: 에러를 컴포넌트로 전달 (자동 signOut 제거)
// 401이 와도 즉시 로그아웃하지 않음 — 각 위젯이 에러 처리
api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
)

export default api
