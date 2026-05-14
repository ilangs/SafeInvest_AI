import { useEffect, useState } from 'react';

/**
 * 표준 브레이크포인트 (index.css 토큰과 동기화)
 *  mobile : ~480px
 *  tablet : 481~768px
 *  laptop : 769~1024px
 *  desktop: 1025px~
 */
export const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  laptop: 1024,
};

/** 임의 미디어 쿼리 구독 — 예: useMediaQuery('(max-width: 768px)') */
export function useMediaQuery(query) {
  const get = () =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState(get);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else mql.removeListener(handler);
    };
  }, [query]);

  return matches;
}

/** 헬퍼 — 자주 쓰는 단축형 */
export const useIsMobile  = () => useMediaQuery(`(max-width: ${BREAKPOINTS.mobile}px)`);
export const useIsTablet  = () => useMediaQuery(`(max-width: ${BREAKPOINTS.tablet}px)`);
export const useIsLaptop  = () => useMediaQuery(`(max-width: ${BREAKPOINTS.laptop}px)`);
export const useIsDesktop = () => useMediaQuery(`(min-width: ${BREAKPOINTS.laptop + 1}px)`);
