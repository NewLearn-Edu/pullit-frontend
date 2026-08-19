import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasCompletedTrial } from '@/user/services/trialGate'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'

/**
 * 맛보기 퍼널(/start · /trial · /trial/quiz) 공용 가드 (2026-08-19 개정).
 *
 * 퍼널은 "맛보기 미완 유저 전용"이다 — 익명·미완 유저는 통과,
 * 이미 고정 영역(수학 지수와 로그 · 영어 주제)을 완주한 유저는
 * 게스트든 회원이든 /home 으로 돌려보낸다 (완주자는 퍼널에 갈 일이 없다).
 * 판정 불가(네트워크 등)면 통과 — 퍼널은 다시 나갈 수 있지만 잘못 막으면 첫 경험이 끊긴다.
 */
export function useTrialFunnelGuard(enabled = true) {
  const navigate = useNavigate()
  // 조회 전용(loadMe) — 세션 없는 방문자에게 게스트를 만들지 않는다
  useMe()
  const hasSession = useUserStore((s) => !!s.me)

  useEffect(() => {
    if (!enabled || !hasSession) return
    let alive = true
    hasCompletedTrial()
      .then((done) => {
        if (alive && done) navigate('/home', { replace: true })
      })
      .catch(() => {}) // 판정 불가 — 퍼널 통과 허용
    return () => {
      alive = false
    }
  }, [enabled, hasSession, navigate])
}
