import { useEffect } from 'react'
import { useUserStore } from '@/user/stores/userStore'

/**
 * 화면 표시용 내 정보 — 최초 사용 시 1회 조회하고, 세션이 없어도 게스트를 만들지 않는다.
 * 게스트 발급이 필요한 곳(맛보기 진입)은 useUserStore().ensureSession() 을 직접 쓴다.
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
