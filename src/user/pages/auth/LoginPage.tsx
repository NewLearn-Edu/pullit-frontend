import { clsx } from 'clsx'
import { startGoogleLogin, startKakaoLogin, startNaverLogin } from '@/user/api/authApi'
import logoImg from '@/assets/images/logo.png'
import styles from './styles/LoginPage.module.scss'

/**
 * 가입 및 로그인 (단독 페이지 · 리디자인)
 * 흰 배경 중앙에 풀잇 로고 + 소셜 로그인 버튼만 배치.
 * - 카카오: 인가코드 방식 실동작 — 프론트가 토큰 교환 (authApi.startKakaoLogin)
 * - 네이버 · 구글: 인가코드 방식 실동작 — 백엔드가 토큰 교환 (authApi.startNaverLogin / startGoogleLogin)
 */
export default function LoginPage() {
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
        </div>

        <p className={styles.note}>하루 3문제 1등급 가능해.</p>
      </div>
    </div>
  )
}
