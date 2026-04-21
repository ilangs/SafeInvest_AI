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

// 응답 인터셉터: 401 시 로그아웃 후 로그인 페이지 이동
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await supabase.auth.signOut()
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

export default api
