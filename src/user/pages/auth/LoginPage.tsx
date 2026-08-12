import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  loginWithApple,
  startGoogleLogin,
  startKakaoLogin,
  startNaverLogin,
} from '@/user/api/authApi'
import { finishLogin, warmUpSessionBeforeLogin } from '@/user/services/finishLogin'
import { setPostLoginRedirect } from '@/user/utils/postLoginRedirect'
import logoImg from '@/assets/images/logo.png'
import logoApple from '@/assets/auth/logo-apple.svg'
import logoGoogle from '@/assets/auth/logo-google.svg'
import logoKakao from '@/assets/auth/logo-kakao.svg'
import logoNaver from '@/assets/auth/logo-naver.svg'
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
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)

  // 로그인 후 복귀 경로 — 세션 가드가 넘겨준 출발지, 없으면 홈.
  // 랜딩('/')에서 온 경우도 홈으로 보낸다 (로그인했는데 랜딩 복귀는 어색)
  const rawFrom = (location.state as { from?: string } | null)?.from
  const returnTo = rawFrom && rawFrom.startsWith('/') && rawFrom !== '/' ? rawFrom : '/home'

  /**
   * 모든 로그인 시작 전에 복귀 경로를 "항상" 덮어쓴다 —
   * 이전 시도(가입 유도 화면 등)가 남긴 stale 값이 소비되는 문제 방지.
   */
  const withReturn = (startLogin: () => void) => () => {
    setPostLoginRedirect(returnTo)
    startLogin()
  }

  // 애플은 팝업 방식이라 콜백 페이지 없이 여기서 완료·이동까지 처리
  const handleAppleLogin = async () => {
    setError(null)
    setPostLoginRedirect(returnTo)
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

        {/* 카카오 버튼을 가리키는 소구 말풍선 */}
        <p className={styles.bubble}>
          <span aria-hidden>⚡</span>
          10초만에 가입 후 약점보기
        </p>

        <div className={styles.buttons}>
          <button
            type="button"
            onClick={withReturn(startKakaoLogin)}
            className={clsx(styles.socialButton, styles.kakao)}
          >
            <span className={styles.socialIcon}>
              <img src={logoKakao} alt="" />
            </span>
            카카오로 계속하기
          </button>
          <button
            type="button"
            onClick={withReturn(startNaverLogin)}
            className={clsx(styles.socialButton, styles.naver)}
          >
            <span className={styles.socialIcon}>
              {/* 원본 에셋이 상하 반전 상태로 내보내져 렌더 시 되돌린다 (가입 유도 페이지와 동일) */}
              <img src={logoNaver} alt="" style={{ transform: 'scaleY(-1)' }} />
            </span>
            네이버로 계속하기
          </button>
          <button
            type="button"
            onClick={withReturn(startGoogleLogin)}
            className={clsx(styles.socialButton, styles.google)}
          >
            <span className={styles.socialIcon}>
              <img src={logoGoogle} alt="" />
            </span>
            Google로 계속하기
          </button>
          <button
            type="button"
            onClick={handleAppleLogin}
            className={clsx(styles.socialButton, styles.apple)}
          >
            <span className={styles.socialIcon}>
              <img src={logoApple} alt="" />
            </span>
            Apple로 계속하기
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {/* 가입 없이 맛보기 진입 — 게스트 세션으로 약점 진단까지 가능 */}
        <button
          type="button"
          onClick={() => navigate('/taste')}
          className={styles.guestLink}
        >
          비회원으로 약점보기
        </button>

        <p className={styles.note}>하루 3문제 1등급 가능해.</p>
      </div>
    </div>
  )
}
