import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import {
  hasCompletedTrial,
  isTrialCompletedCached,
  markTrialCompleted,
} from '@/user/services/trialGate'

/**
 * 회원 영역 공용 가드 (2026-09-02 강화) — 아래 셋 중 하나라도 해당하면
 * 랜딩(/)·/start·/login 밖의 회원 화면은 절대 열리지 않는다.
 *
 *   1. 로그인돼 있지 않음 (세션 없음)
 *   2. 비회원인데 이 브라우저에 게스트 세션 흔적이 없음 → 1 과 같이 익명 처리
 *   3. 맛보기(수학 지수와 로그 · 영어 주제)를 하나도 끝내지 않음
 *
 * - 판정이 끝나기 전에는 화면을 그리지 않는다 (예전엔 낙관적으로 먼저 그려
 *   보호 화면이 잠깐 보이고 API 도 나갔다)
 * - 익명 → /login (돌아올 경로를 state.from 으로 넘긴다)
 * - 미완주 → /start 퍼널
 * - 판정 불가(네트워크)도 통과시키지 않는다 — 한 번 더 시도한 뒤 /start.
 *   완주 확정은 세션 메모리에 캐시해 매 화면 전환마다 재조회하지 않는다
 * - 미완 판정은 결과 화면에서 막 나온 직후(마지막 제출 반영 전)일 수 있어 한 번 재확인
 */
type Verdict = 'checking' | 'done' | 'missing'

const RECHECK_DELAY_MS = 800

export default function RequireTrialDone() {
  const location = useLocation()
  useMe() // 세션 미조회 상태로 직행해도 판정이 돌게 로드 (조회 전용 — 게스트를 만들지 않는다)
  const status = useUserStore((s) => s.status)
  const userId = useUserStore((s) => s.me?.id ?? null)

  const [verdict, setVerdict] = useState<Verdict>(() =>
    userId != null && isTrialCompletedCached(userId) ? 'done' : 'checking',
  )

  useEffect(() => {
    if (status !== 'ready' || userId == null) return
    if (isTrialCompletedCached(userId)) {
      setVerdict('done')
      return
    }
    let alive = true
    let timer = 0
    setVerdict('checking')

    const check = (attempt: number) => {
      hasCompletedTrial()
        .then((done) => {
          if (!alive) return
          if (done) {
            markTrialCompleted(userId)
            setVerdict('done')
            return
          }
          // 미완 — 방금 세트를 끝낸 직후일 수 있어 한 박자 뒤 한 번 더
          if (attempt === 0) timer = window.setTimeout(() => check(1), RECHECK_DELAY_MS)
          else setVerdict('missing')
        })
        .catch(() => {
          if (!alive) return
          if (attempt === 0) timer = window.setTimeout(() => check(1), RECHECK_DELAY_MS)
          else setVerdict('missing') // 판정 불가 — 열어 주지 않는다
        })
    }
    check(0)

    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [status, userId])

  // 세션 조회 전 — 아무것도 그리지 않는다 (힌트 없는 첫 방문은 네트워크 없이 즉시 익명 확정)
  if (status === 'idle' || status === 'loading') return null

  if (status === 'anonymous' || userId == null) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
    )
  }

  if (verdict === 'checking') return null
  if (verdict === 'missing') return <Navigate to="/start" replace />

  return <Outlet />
}
