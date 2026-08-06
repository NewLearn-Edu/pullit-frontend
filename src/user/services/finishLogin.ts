import { refreshSession } from '@/user/api/authApi'
import { flushAttemptQueue } from '@/user/services/attemptQueue'
import { useUserStore } from '@/user/stores/userStore'
import { consumePostLoginRedirect } from '@/user/utils/postLoginRedirect'

/**
 * 소셜 로그인 성공 직후 공통 후처리 (콜백 3종 + 애플 팝업 공용).
 * 1) me 강제 재조회 — 게스트 → USER 승격이 상태에 반영된다 (type · creditBalance 갱신)
 * 2) 미전송 풀이 큐 flush — 게스트 때 실패했던 기록을 승격된 계정으로 마저 저장
 * 3) 복귀 경로 결정 — 맛보기에서 왔으면 보던 결과 화면으로, 아니면 홈
 */
export async function finishLogin(): Promise<string> {
  await useUserStore.getState().loadMe(true)
  await flushAttemptQueue().catch(() => {})
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
