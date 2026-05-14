import { useEffect, useState, useCallback } from 'react'

/**
 * 화면 스타일 3-상태 훅
 *  'light'  — 라이트 모드 고정
 *  'dark'   — 다크 모드 고정
 *  'system' — OS 설정 추종 (prefers-color-scheme)
 *
 * 동작:
 *  1) localStorage('theme')에서 마지막 선택 복원 (없으면 'system')
 *  2) <html data-theme="..."> 속성을 항상 light/dark 둘 중 하나로 부착
 *  3) 'system'일 때 OS 변경 이벤트를 구독해 실시간 반영
 *
 * 반환: { theme, effective, setTheme }
 *  - theme: 사용자가 선택한 값 ('light'|'dark'|'system')
 *  - effective: 실제 적용된 값 ('light'|'dark')
 *  - setTheme: 변경 함수
 */

const STORAGE_KEY = 'theme'
const VALID = ['light', 'dark', 'system']

function readStored() {
  if (typeof window === 'undefined') return 'system'
  const v = window.localStorage.getItem(STORAGE_KEY)
  return VALID.includes(v) ? v : 'system'
}

function getSystemPref() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyDOM(effective) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = effective
}

export function useThemeMode() {
  const [theme, setThemeState] = useState(readStored)
  const [systemPref, setSystemPref] = useState(getSystemPref)

  const effective = theme === 'system' ? systemPref : theme

  // OS 변경 감지 (system 모드일 때 즉시 반영용)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => setSystemPref(e.matches ? 'dark' : 'light')
    if (mql.addEventListener) mql.addEventListener('change', handler)
    else mql.addListener(handler)
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler)
      else mql.removeListener(handler)
    }
  }, [])

  // 변경 시 DOM + localStorage 동기화
  useEffect(() => {
    applyDOM(effective)
  }, [effective])

  const setTheme = useCallback((next) => {
    if (!VALID.includes(next)) return
    setThemeState(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch {}
  }, [])

  return { theme, effective, setTheme }
}
