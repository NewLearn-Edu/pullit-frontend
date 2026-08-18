import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '@/user/components/AppHeader'
import { useTrialStore } from '@/user/stores/trialStore'
import { flushAttemptQueue } from '@/user/services/attemptQueue'

export default function TrialCompletePage() {
  const navigate = useNavigate()
  const { hasCompletedSession, totalEarnedPoints } = useTrialStore()
  // persist rehydrate 전에 판정하면 정상 완주자도 튕긴다
  const hydrated = useTrialStore.persist?.hasHydrated?.() ?? true

  useEffect(() => {
    // 완주 하지 않은 접근은 시작 페이지로 (실제로 푼 과목만 검사)
    if (!hydrated) return
    if (!hasCompletedSession()) {
      navigate('/trial', { replace: true })
    }
  }, [hydrated, hasCompletedSession, navigate])

  // 풀이 중 전송 실패분 회수 — 완주 시점에 한 번 더 시도
  useEffect(() => {
    flushAttemptQueue()
  }, [])

  const total = totalEarnedPoints()

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <AppHeader onClose={() => navigate('/')} />

      <main className="inner flex flex-1 flex-col justify-center py-xxl">
        <div className="mx-auto max-w-[520px] text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-weak-bg text-h2">
            🎯
          </div>
          <h1 className="mt-xl text-h1 font-bold text-foreground">
            8문제 다 풀었어!
          </h1>
          <p className="mt-md text-body text-body">
            수고했어. 이제 네 약점 지도를 볼 준비가 됐어.
          </p>

          <div className="mt-xxl rounded-btn-xl border border-line bg-surface p-xl text-left">
            <div className="flex items-center justify-between">
              <span className="text-body-sm text-body">획득 총점</span>
              <span className="text-h3 font-bold text-foreground">
                {total.toFixed(1)}점
              </span>
            </div>
            <div className="mt-md h-px w-full bg-line" />
            <div className="mt-md flex items-center justify-between">
              <span className="text-body-sm text-body">완주 보상</span>
              <span className="text-body font-semibold text-success">크레딧 +5 지급</span>
            </div>
          </div>

          <div className="mt-xxl space-y-md">
            <Link to="/weakness" className="btn-xl w-full">
              내 약점 보러가기
            </Link>
            <Link
              to="/"
              className="inline-block text-body-sm text-muted underline"
            >
              홈으로
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
