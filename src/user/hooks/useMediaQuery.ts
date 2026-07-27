import { useEffect, useState } from 'react'

/**
 * matchMedia 를 React 상태로 노출.
 * 브라우저 · 뷰포트 · 입력장치 감지에 두루 활용.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = () => setMatches(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])
  return matches
}

/** 뷰포트 폭 640px 미만 (Tailwind sm breakpoint 이하) */
export function useIsCompact(): boolean {
  return useMediaQuery('(max-width: 639px)')
}

/**
 * 터치 · 펜이 주 입력인 기기 감지 (마우스만 있는 PC 는 false).
 * 아이패드 · 아이폰 · 안드로이드 태블릿/폰 에서 true.
 */
export function useIsTouchDevice(): boolean {
  return useMediaQuery('(pointer: coarse)')
}
