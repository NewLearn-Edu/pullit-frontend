import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '@/user/components/ConfirmDialog'
import {
  finishAppleLogin,
  openAppleSignIn,
  startGoogleLogin,
  startKakaoLogin,
  startNaverLogin,
  type DuplicateAccountInfo,
} from '@/user/api/authApi'
import { finishLogin, warmUpSessionBeforeLogin } from '@/user/services/finishLogin'

/**
 * "이미 가입된 계정이 있어요" 팝업 (2026-09-06) — 소셜 가입 시 서버가 이메일 중복(409 U002)으로 거절했을 때.
 *
 * 한 이메일 = 한 계정 정책이라 카카오로 가입한 이메일로 네이버 가입을 시도하면 막히는데,
 * 예전엔 콜백 페이지가 사유를 버리고 "로그인에 실패했어요"만 보여줘 왜 안 되는지 알 수 없었다.
 * 어떤 이메일이 어떤 소셜로 가입돼 있는지 보여주고, 그 소셜 로그인으로 바로 보낸다.
 * (OAuth 는 소셜 식별자 기준이라 기존 소셜로 로그인하면 자동으로 그 계정에 들어간다)
 *
 * 로그인 전 복귀 경로(postLoginRedirect)는 실패한 시도가 소비하지 않았으므로 그대로 이어진다.
 */
export function DuplicateAccountDialog({
  info,
  onClose,
}: {
  info: DuplicateAccountInfo
  /** 닫기·바깥 클릭 — 호출부가 머무를지(로그인 페이지) 돌아갈지(콜백 페이지) 정한다 */
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [appleError, setAppleError] = useState<string | null>(null)
  const name = info.providerName

  const continueWithExisting = () => {
    if (info.provider === 'KAKAO') startKakaoLogin()
    else if (info.provider === 'NAVER') startNaverLogin()
    else if (info.provider === 'GOOGLE') startGoogleLogin()
    else if (info.provider === 'APPLE') {
      // 애플은 팝업 방식 — 콜백 페이지 없이 여기서 완료·이동까지.
      // ★ openAppleSignIn 앞에 await 를 두지 말 것 (제스처가 끊기면 안드로이드에서 팝업이 막힌다)
      openAppleSignIn()
        .then(async (res) => {
          await warmUpSessionBeforeLogin()
          await finishAppleLogin(res)
          const to = await finishLogin()
          navigate(to, { replace: true })
        })
        .catch((e) => {
          if ((e as { error?: string })?.error === 'popup_closed_by_user') return
          setAppleError('Apple 로그인에 실패했어요. 다시 시도해주세요.')
        })
    } else navigate('/login', { replace: true })
  }

  return (
    <ConfirmDialog
      title="이미 가입된 계정이 있어요"
      desc={
        <>
          <p className="font-semibold text-[#23272b]">{info.email}</p>
          <p>{name ? `${name}로 가입된 이메일이에요.` : '다른 방법으로 가입된 이메일이에요.'}</p>
          {appleError && <p className="text-danger">{appleError}</p>}
        </>
      }
      confirmLabel={name ? `${name}로 로그인` : '로그인하러 가기'}
      cancelLabel="닫기"
      accent
      onConfirm={continueWithExisting}
      onCancel={onClose}
    />
  )
}
