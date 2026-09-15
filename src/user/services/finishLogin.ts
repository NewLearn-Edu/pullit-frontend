import { refreshSession } from '@/user/api/authApi'
import { dropOnboardingTrialAttempts, flushAttemptQueue } from '@/user/services/attemptQueue'
import { hasCompletedTrial } from '@/user/services/trialGate'
import { claimUtmVisit } from '@/user/services/visitMetrics'
import { startPath } from '@/user/services/startVariants'
import { isSignupPending, useUserStore } from '@/user/stores/userStore'
import { consumePostLoginRedirect } from '@/user/utils/postLoginRedirect'

/**
 * 소셜 로그인 성공 직후 공통 후처리 (콜백 3종 + 애플 팝업 공용).
 * 1) me 강제 재조회 — 로그인 결과(type · creditBalance)가 상태에 반영된다
 * 2) 미전송 풀이 큐 flush — 가입 전 익명으로 푼 맛보기 기록을 이 계정으로 저장.
 *    단, 이미 맛보기를 완주한 회원(세션 끊긴 뒤 /start 로 다시 푼 경우)이면 온보딩 맛보기 건은 버린다 (2026-09-15) —
 *    안 그러면 같은 3문항이 원장에 또 쌓여 푼 문제 수가 6 이 됐다. 판정 불가(네트워크)면 보내고 서버 멱등 가드에 맡긴다
 * 3) 복귀 경로 결정 — 프로필 미완성 → 추가 정보 · 맛보기 미완 → 퍼널 · 그 외 복귀 경로/홈
 */
export async function finishLogin(): Promise<string> {
  const me = await useUserStore.getState().loadMe(true)
  const pending = isSignupPending(me)
  // 가입 중인 계정은 이 맛보기가 첫 진단이라 완주 판정을 건너뛴다 (전부 보낸다)
  const completed = pending ? null : await hasCompletedTrial().catch(() => null)
  if (completed) dropOnboardingTrialAttempts()
  await flushAttemptQueue().catch(() => {})
  claimUtmVisit(me?.id) // 신규 가입 — 여기서 처음 users 행이 생긴다 (이미 귀속됐으면 서버가 무시)

  // 가입 진행 중(USER·PENDING 직가입 / 남은 GUEST·PENDING)은 추가 정보 화면부터.
  // 복귀 경로는 소비하지 않고 남겨둬 프로필 완료 후 이어서 사용한다
  if (pending) {
    return '/signup/info'
  }

  return resolvePostAuthDestination(completed)
}

/**
 * 인증 완료 후 목적지 — 맛보기(수학 지수와 로그 · 영어 주제) 미완 유저는
 * 무조건 퍼널(/start → /trial → /quiz)부터. 완료 유저만 복귀 경로/홈.
 * 판정 불가(네트워크 등)면 홈 — 유저를 퍼널에 잘못 가두지 않는다.
 */
export async function resolvePostAuthDestination(known?: boolean | null): Promise<string> {
  // finishLogin 이 이미 판정했으면 재조회하지 않는다. 판정 불가(null)였으면 여기서 다시 시도
  const completed = known ?? (await hasCompletedTrial().catch(() => true))
  if (!completed) return startPath() // 유저가 들어온 /start 변형 유지

  const back = consumePostLoginRedirect()
  return back ?? '/home'
}

/**
 * 소셜 로그인 시작 직전 세션 워밍업 — 게스트 승격 유실 방지.
 *
 * access 쿠키(30분)가 만료된 채 로그인하면 서버가 승격 대상 게스트를 못 찾아
 * 새 계정이 생기고 맛보기 기록이 조용히 유실된다. refresh 쿠키(14일)로 access 를
 * 미리 되살려 두면 이어지는 로그인 요청에 게스트 신원이 실린다. 실패는 무시
 * (첫 방문·게스트 없음이면 원래 동작 그대로).
 */
export function warmUpSessionBeforeLogin(): Promise<void> {
  return refreshSession().catch(() => {})
}
