import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { extractDuplicateAccount, loginWithKakaoCode, type DuplicateAccountInfo } from '@/user/api/authApi'
import { DuplicateAccountDialog } from '@/user/components/DuplicateAccountDialog'
import { finishLogin, warmUpSessionBeforeLogin } from '@/user/services/finishLogin'

/**
 * 카카오 로그인 콜백 — kauth 가 ?code= 로 돌려보내는 착지 페이지.
 * 인가코드를 JWT 로 교환한 뒤 홈으로 이동한다. 실패 시 로그인 페이지로 복귀.
 */
export default function KakaoCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateAccountInfo | null>(null) // 다른 소셜로 가입된 이메일 — 안내 팝업
  const requested = useRef(false) // StrictMode 이중 실행 방지 (인가코드는 1회용)

  useEffect(() => {
    const code = params.get('code')
    if (!code) {
      navigate('/login', { replace: true })
      return
    }
    if (requested.current) return
    requested.current = true

    // 워밍업: 만료된 게스트 access 를 되살려 로그인 요청에 게스트 신원이 실리게 (승격 유실 방지)
    warmUpSessionBeforeLogin()
      .then(() => loginWithKakaoCode(code))
      .then(finishLogin)
      .then((to) => navigate(to, { replace: true }))
      .catch((e) => {
        // 이미 다른 소셜로 가입된 이메일 — 사유·기존 소셜을 팝업으로 안내하고 그 로그인으로 보낸다
        const dup = extractDuplicateAccount(e)
        if (dup) setDuplicate(dup)
        else setError('카카오 로그인에 실패했어요. 다시 시도해주세요.')
      })
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
        <p>카카오 로그인 중…</p>
      )}
    </div>
  )
}
