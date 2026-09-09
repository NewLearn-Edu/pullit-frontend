import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasEnteredTrialFunnel, trialFunnelEntryPath } from '@/user/services/trialFunnel'

/**
 * 퍼널 화면 공용 — /start 를 거치지 않은 직접 진입(주소 입력·북마크·새 탭)은 /start(들어온 변형)로 (2026-09-09).
 * 완주자를 홈으로 보내는 useTrialFunnelGuard 와 짝. 홈·지도에서 시작한 단원 진단(pendingUnit)은 퍼널이 아니라 제외.
 * @returns 화면을 그려도 되는가 — false 면 리다이렉트 중이니 null 을 그린다
 */
export function useRequireTrialFunnelEntry(enabled = true): boolean {
  const navigate = useNavigate()
  const allowed = !enabled || hasEnteredTrialFunnel()
  useEffect(() => {
    if (!allowed) navigate(trialFunnelEntryPath(), { replace: true })
  }, [allowed, navigate])
  return allowed
}
