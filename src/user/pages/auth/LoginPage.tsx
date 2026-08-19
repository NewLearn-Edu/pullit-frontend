import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  loginWithApple,
  startGoogleLogin,
  startKakaoLogin,
  startNaverLogin,
} from '@/user/api/authApi'
import { finishLogin, warmUpSessionBeforeLogin } from '@/user/services/finishLogin'
import { hasCompletedTrial } from '@/user/services/trialGate'
import { useMe } from '@/user/hooks/useMe'
import { isCompleteMember, useUserStore } from '@/user/stores/userStore'
import { setPostLoginRedirect } from '@/user/utils/postLoginRedirect'
import { PageHeader } from '@/user/components/PageHeader/PageHeader'
import SocialLoginButtons from '@/user/components/SocialLoginButtons'
import RadarDemoCard from '@/user/components/WeaknessRadar/RadarDemoCard'
import logoImg from '@/assets/images/logo.png'
import styles from './styles/LoginPage.module.scss'

/**
 * 가입 및 로그인 (단독 페이지 · 리디자인)
 * 흰 배경 중앙에 풀잇 로고 + 소셜 로그인 원형 아이콘 행(SocialLoginButtons 공용).
 * - 카카오: 인가코드 방식 실동작 — 프론트가 토큰 교환 (authApi.startKakaoLogin)
 * - 네이버 · 구글: 인가코드 방식 실동작 — 백엔드가 토큰 교환 (authApi.startNaverLogin / startGoogleLogin)
 * - 애플: Apple JS 팝업 방식 — 리다이렉트 없이 이 페이지에서 로그인 완료 후 홈 이동
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)

  // 이미 로그인한 회원에게 로그인 화면은 무의미 — 홈으로.
  // 게스트는 가입(승격)하러 올 수 있으므로 통과 (조회 전용 useMe — 게스트 생성 없음)
  useMe()
  // 세션 보유자(게스트·프로필 완료 회원)는 랜딩과 동일하게 완주 여부로 분기 —
  // 완주면 홈, 미완(최초 유저)이면 퍼널(/start). 웹앱(start_url=/login)의 관문 역할.
  // 게스트의 가입 전환은 마이페이지 "10초만에 가입하기" → /signup 이 담당한다.
  // 프로필 미완성 회원만 이 화면에 남는다 — 소셜 버튼을 다시 누르면
  // finishLogin 이 /signup/info(추가 정보)로 안내
  const me = useUserStore((s) => s.me)
  useEffect(() => {
    if (!me) return
    if (me.type !== 'GUEST' && !isCompleteMember(me)) return
    let alive = true
    hasCompletedTrial()
      .then((done) => {
        if (alive) navigate(done ? '/home' : '/start', { replace: true })
      })
      .catch(() => {
        if (alive) navigate('/home', { replace: true }) // 판정 불가 — 퍼널 오감금 방지
      })
    return () => {
      alive = false
    }
  }, [me, navigate])

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
      {/* 뒤로가기 — 직전 화면으로 (딥링크로 바로 온 경우 홈 폴백) */}
      <PageHeader backTo="history" />

      <div className={styles.content}>
        <img src={logoImg} alt="풀잇" className={styles.logo} />

        {/* 약점 레이더 데모 — 가입 유도와 같은 카드, 배경 블롭 없이 그래프만 */}
        <RadarDemoCard className={styles.radar} tinted={false} />

        {/* 소셜 로그인 — 원형 아이콘 4개 + "3초만에 가입" 배지 (가입 유도 페이지와 동일) */}
        <SocialLoginButtons
          onKakao={withReturn(startKakaoLogin)}
          onNaver={withReturn(startNaverLogin)}
          onApple={handleAppleLogin}
          onGoogle={withReturn(startGoogleLogin)}
          className={styles.social}
        />

        {error && <p className={styles.error}>{error}</p>}

        {/* 가입 없이 맛보기 진입 — 게스트 세션으로 약점 진단까지 가능 */}
        <button
          type="button"
          onClick={() => navigate('/trial')}
          className={styles.guestLink}
        >
          비회원으로 약점보기
        </button>

        <p className={styles.note}>하루 3문제 1등급 가능해.</p>
      </div>
    </div>
  )
}
