import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import { hasCompletedTrial } from '@/user/services/trialGate'

/**
 * 회원 영역 공용 가드 — 맛보기 미완주면 어디로 들어와도 /start 퍼널로 보낸다.
 * (/home 뿐 아니라 /my·오답노트·리포트 등 회원 영역 전체에 동일 규칙 — 2026-08-24 확정)
 *
 * - 로그인 확인이 끝난(ready) 유저만 판정한다. 익명 처리는 각 페이지의
 *   로그인 리다이렉트가 담당 (여기서 겹치면 로그인 후 복귀 경로가 꼬인다)
 * - 판정 불가(네트워크)면 통과 — 잘못 쫓아내는 것보다 낫다
 * - 페이지는 낙관적으로 먼저 그린다 (판정은 비동기, 홈 게이트와 동일한 UX)
 */
export default function RequireTrialDone() {
  const navigate = useNavigate()
  useMe() // 세션 미조회 상태로 직행해도 판정이 돌게 로드
  const sessionStatus = useUserStore((s) => s.status)

  useEffect(() => {
    if (sessionStatus !== 'ready') return
    let alive = true
    hasCompletedTrial()
      .then((done) => {
        if (alive && !done) navigate('/start', { replace: true })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [sessionStatus, navigate])

  return <Outlet />
}
