import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { verifyAppleRedirectState, type DuplicateAccountInfo } from '@/user/api/authApi'
import { DuplicateAccountDialog } from '@/user/components/DuplicateAccountDialog'
import { finishLogin } from '@/user/services/finishLogin'

/**
 * 애플 로그인 콜백 — 리다이렉트(form_post) 방식 전용 (2026-09-06).
 * 애플 → 백엔드(/api/auth/oauth/apple/redirect)가 코드 교환·쿠키 발급을 끝내고 302 로 여기로 보낸다.
 * 성공이면 쿼리에 error 가 없고 쿠키가 이미 실려 있어 finishLogin 만 하면 된다.
 * 실패는 ?error=코드 (+ 이메일 중복이면 email·provider·providerName) 로 온다.
 * 팝업 방식(iOS·데스크톱)은 이 페이지를 거치지 않는다.
 */
export default function AppleCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateAccountInfo | null>(null)
  const handled = useRef(false) // StrictMode 이중 실행 방지

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const state = params.get('state')
    const code = params.get('error')
    if (!verifyAppleRedirectState(state)) {
      setError('Apple 로그인에 실패했어요. 다시 시도해주세요.')
      return
    }
    if (code === 'user_cancelled_authorize' || code === 'no_code') {
      navigate('/login', { replace: true }) // 애플 화면에서 취소 — 조용히 로그인 화면으로
      return
    }
    if (code === 'U002') {
      // 이미 다른 소셜로 가입된 이메일 — 팝업 경로와 같은 안내
      setDuplicate({
        email: params.get('email') ?? '',
        provider: (params.get('provider') as DuplicateAccountInfo['provider']) ?? null,
        providerName: params.get('providerName'),
      })
      return
    }
    if (code) {
      setError('Apple 로그인에 실패했어요. 다시 시도해주세요.')
      return
    }
    finishLogin()
      .then((to) => navigate(to, { replace: true }))
      .catch(() => setError('Apple 로그인에 실패했어요. 다시 시도해주세요.'))
  }, [params, navigate])

  if (duplicate) {
    return <DuplicateAccountDialog info={duplicate} onClose={() => navigate('/login', { replace: true })} />
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', gap: 12 }}>
      {error ? (
        <>
          <p>{error}</p>
          <button type="button" onClick={() => navigate('/login', { replace: true })}>
            로그인으로 돌아가기
          </button>
        </>
      ) : (
        <p>Apple 로그인 중…</p>
      )}
    </div>
  )
}
