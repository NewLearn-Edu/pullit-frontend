import { useCallback, useEffect, useState } from 'react'
import { fetchInviteCode } from '@/user/api/authApi'
import { buildInviteUrl } from '@/user/services/referral'

/**
 * 내 초대 링크 (2026-09-03) — 코드가 실린 링크가 준비됐을 때만 공유를 열게 한다.
 *
 * 예전엔 코드 조회 전·실패 시 코드 없는 /start 로 조용히 폴백해, 팝업이 뜬 직후 초대하기를 누르면
 * 보상이 붙지 않는 링크가 나갔다. 이제 url 은 코드가 있을 때만 존재하고, 공유 직전 ensure() 로
 * 없으면 한 번 더 조회한다. 그래도 없으면 null — 호출부가 안내하고 공유를 열지 않는다.
 */
export function useInviteUrl(enabled = true) {
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (): Promise<string | null> => {
    setLoading(true)
    try {
      const c = await fetchInviteCode()
      if (c) setCode(c)
      return c || null
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) void load()
  }, [enabled, load])

  /** 공유 직전 — 준비된 코드가 있으면 그대로, 없으면 한 번 더 조회 */
  const ensure = useCallback(async (): Promise<string | null> => {
    const c = code ?? (await load())
    return c ? buildInviteUrl(c) : null
  }, [code, load])

  return { url: code ? buildInviteUrl(code) : null, loading, ensure }
}
