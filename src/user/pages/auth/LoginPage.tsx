import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  loginWithApple,
  startGoogleLogin,
  startKakaoLogin,
  startNaverLogin,
} from '@/user/api/authApi'
import { finishLogin, warmUpSessionBeforeLogin } from '@/user/services/finishLogin'
import logoImg from '@/assets/images/logo.png'
import styles from './styles/LoginPage.module.scss'

/**
 * 가입 및 로그인 (단독 페이지 · 리디자인)
 * 흰 배경 중앙에 풀잇 로고 + 소셜 로그인 버튼만 배치.
 * - 카카오: 인가코드 방식 실동작 — 프론트가 토큰 교환 (authApi.startKakaoLogin)
 * - 네이버 · 구글: 인가코드 방식 실동작 — 백엔드가 토큰 교환 (authApi.startNaverLogin / startGoogleLogin)
 * - 애플: Apple JS 팝업 방식 — 리다이렉트 없이 이 페이지에서 로그인 완료 후 홈 이동
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  // 애플은 팝업 방식이라 콜백 페이지 없이 여기서 완료·이동까지 처리
  const handleAppleLogin = async () => {
    setError(null)
    try {
      await warmUpSessionBeforeLogin() // 만료된 게스트 access 복구 — 승격 유실 방지
      await loginWithApple()
      const to = await finishLogin()
      navigate(to, { replace: true })
    } catch (e) {
      if ((e as { error?: string })?.error === 'popup_closed_by_user') return
      setError('Apple 로그인에 실패했어요. 다시 시도해주세요.')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <img src={logoImg} alt="풀잇" className={styles.logo} />

        <div className={styles.buttons}>
          <button
            type="button"
            onClick={startKakaoLogin}
            className={clsx(styles.socialButton, styles.kakao)}
          >
            카카오로 계속하기
          </button>
          <button
            type="button"
            onClick={startNaverLogin}
            className={clsx(styles.socialButton, styles.naver)}
          >
            네이버로 계속하기
          </button>
          <button
            type="button"
            onClick={startGoogleLogin}
            className={clsx(styles.socialButton, styles.google)}
          >
            Google로 계속하기
          </button>
          <button
            type="button"
            onClick={handleAppleLogin}
            className={clsx(styles.socialButton, styles.apple)}
          >
            Apple로 계속하기
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <p className={styles.note}>하루 3문제 1등급 가능해.</p>
      </div>
    </div>
  )
}
