import { useEffect } from 'react'
import { useUserStore } from '@/user/stores/userStore'

/**
 * 화면 표시용 내 정보 — 최초 사용 시 1회 조회. 세션은 소셜 로그인으로만 생긴다 (2026-09-15 게스트 폐지).
 *
 * 랜딩페이지는 이 훅을 쓰지 않으므로 요청이 전혀 나가지 않는다.
 */
export function useMe() {
  const me = useUserStore((s) => s.me)
  const status = useUserStore((s) => s.status)
  const loadMe = useUserStore((s) => s.loadMe)

  useEffect(() => {
    loadMe()
  }, [loadMe])

  return { me, loading: status === 'loading' }
}
