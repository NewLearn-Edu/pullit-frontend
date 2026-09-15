import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  finishAppleLogin,
  openAppleSignIn,
  shouldUseAppleRedirect,
  startAppleRedirectLogin,
  prepareAppleLogin,
  startGoogleLogin,
  startKakaoLogin,
  startNaverLogin,
} from '@/user/api/authApi'
import { finishLogin, warmUpSessionBeforeLogin } from '@/user/services/finishLogin'
import { extractDuplicateAccount, type DuplicateAccountInfo } from '@/user/api/authApi'
import { DuplicateAccountDialog } from '@/user/components/DuplicateAccountDialog'
import { isEarlybird } from '@/user/services/earlybird'
import { isSignupPending, selectIsMember, useUserStore } from '@/user/stores/userStore'
import { setPostLoginRedirect } from '@/user/utils/postLoginRedirect'
import { weaknessResultPath } from '@/user/services/trialRoutes'
import { useTrialStore } from '@/user/stores/trialStore'
import OnboardingHeader from '@/user/components/OnboardingHeader'
import { isStandaloneApp } from '@/user/utils/standalone'
import { useNavStackStore } from '@/user/stores/navStackStore'
import SocialLoginButtons from '@/user/components/SocialLoginButtons'
import RadarDemoCard from '@/user/components/WeaknessRadar/RadarDemoCard'

/**
 * PI-PAGE-RESULT_SIGNUP · 가입 유도 (맛보기 완주 후 기록 저장 유도 · Figma 2824-5679)
 *
 * 진입은 둘 — 맛보기 결과의 "가입하기"(온보딩 퍼널) · 마이페이지 게스트의 "10초만에 가입하기".
 *
 * 레이아웃은 헤더 / 레이더 카드 / 안내문 / 소셜 아이콘 4개 세로 배치.
 * 맛보기는 세션 없이 진행되므로 users 로우는 이 화면의 소셜 로그인에서 처음 생긴다
 * (큐에 쌓인 풀이 기록 전송은 finishLogin 이 담당).
 * 2026-09-15 게스트(건너뛰기) 폐지 — 회원 영역은 가입해야만 들어갈 수 있다. 이 화면이 퍼널의 유일한 출구.
 *
 * 로그인 동작은 LoginPage 와 동일한 authApi 를 그대로 사용한다
 * (카카오·네이버·구글 = 인가코드 리다이렉트, 애플 = 팝업).
 */
export default function SignupPromptPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isMember = useUserStore(selectIsMember)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateAccountInfo | null>(null) // 다른 소셜로 가입된 이메일 — 안내 팝업
  // 얼리버드 테스트 모드 — 가입 경로 차단 (진단·사전예약만)
  // Apple JS SDK 미리 로드 — 클릭 시점에 스크립트를 받으면 그 대기 동안 제스처가 끊겨
  // 팝업이 막힌다 (안드로이드). 화면 진입 때 받아 둔다 (2026-09-06)
  useEffect(() => {
    void prepareAppleLogin()
  }, [])

  useEffect(() => {
    if (isEarlybird()) navigate('/earlybird', { replace: true })
  }, [navigate])

  // 이미 회원인데 가입 유도가 노출되는 상황 방지
  useEffect(() => {
    if (isMember) navigate('/home', { replace: true })
  }, [isMember, navigate])
  // 가입 진행 중(GUEST·PENDING — 게스트가 소셜 로그인만 누른 상태)은 소셜을 다시 고르게 하지 않고 이어서 프로필 입력으로
  const pending = useUserStore((s) => isSignupPending(s.me))
  useEffect(() => {
    if (pending) navigate('/signup/info', { replace: true })
  }, [pending, navigate])

  // 스크롤 없는 화면 — 드래그 시 러버밴드(밀렸다 튕겨 돌아옴) 차단
  useEffect(() => {
    const html = document.documentElement
    const prevOverscroll = html.style.overscrollBehavior
    const prevBodyOverflow = document.body.style.overflow
    html.style.overscrollBehavior = 'none'
    document.body.style.overflow = 'hidden'
    return () => {
      html.style.overscrollBehavior = prevOverscroll
      document.body.style.overflow = prevBodyOverflow
    }
  }, [])

  /**
   * 로그인 후 복귀 경로 (2026-09-06).
   *
   * 이 화면은 두 곳에서 뜬다 — 맛보기 결과의 "가입하기"(온보딩 퍼널)와
   * 마이페이지 게스트의 "10초만에 가입하기". 예전엔 무조건 결과 화면(/trial/{subject}/weakness)을
   * 찍어서, 마이페이지에서 가입한 게스트가 가입을 마치자마자 지난 진단 결과로 떨어졌다.
   *
   * 판정은 결과 열람권(resultPass) — 결과 화면을 떠날 때 소비되지만 /signup 만 예외로
   * 남겨 둔다 (소셜 로그인이 외부 도메인을 왕복한 뒤 결과로 돌아와야 하므로).
   * 즉 열람권이 살아 있으면 "결과 화면에서 바로 온 것" 이 확실하다.
   */
  const lastSubject = useTrialStore((s) => s.lastSubject)
  const resultPass = useTrialStore((s) => s.resultPass)
  const rawFrom = (location.state as { from?: string } | null)?.from
  const backTo = rawFrom && rawFrom.startsWith('/') && !rawFrom.startsWith('//') ? rawFrom : '/home'
  const returnTo = resultPass ? weaknessResultPath(lastSubject, true) : backTo

  /** 뒤로가기 — 직전 화면(앱 방문 스택)으로, 없으면 결과 화면(열람권 있을 때) 또는 랜딩 */
  const goBack = () => {
    const prev = useNavStackStore.getState().back()
    navigate(prev ?? (resultPass ? weaknessResultPath(lastSubject, true) : '/'), { replace: true })
  }

  /** 소셜 로그인 시작 전 공통 처리 — 로그인 후 복귀 경로를 항상 덮어쓴다 (stale 값 소비 방지) */
  const withReturn = (startLogin: () => void) => () => {
    setPostLoginRedirect(returnTo)
    startLogin()
  }

  // 애플만 팝업 방식이라 콜백 페이지 없이 이 화면에서 완료·이동까지 처리.
  // ★ openAppleSignIn 앞에 await 를 두지 말 것 — 제스처가 끊기면 안드로이드에서 팝업이 막힌다
  const handleAppleLogin = () => {
    setError(null)
    setPostLoginRedirect(returnTo)
    if (shouldUseAppleRedirect()) {
      startAppleRedirectLogin() // 안드로이드 — 팝업 대신 전체 페이지 리다이렉트 (AppleCallbackPage 에서 마무리)
      return
    }
    openAppleSignIn()
      .then(async (res) => {
        // 팝업이 닫힌 뒤라 제스처와 무관 — 여기서부터는 await 로 이어도 된다
        await warmUpSessionBeforeLogin() // 만료된 게스트 access 복구 — 승격 유실 방지
        await finishAppleLogin(res)
        const to = await finishLogin()
        navigate(to, { replace: true })
      })
      .catch((e) => {
        if ((e as { error?: string })?.error === 'popup_closed_by_user') return
        // 이미 다른 소셜로 가입된 이메일 — 사유·기존 소셜을 팝업으로 안내
        const dup = extractDuplicateAccount(e)
        if (dup) setDuplicate(dup)
        else setError('Apple 로그인에 실패했어요. 다시 시도해주세요.')
      })
  }

  return (
    <div className="flex h-dvh touch-none flex-col overflow-hidden overscroll-none bg-white">
      {/* 상단바 — 좌측 뒤로가기만 (2026-09-15). 건너뛰기(게스트)는 폐지.
          뒤로가기 = 직전 화면(보통 약점 결과 · 열람권이 남아 있어 다시 열린다). 직전 화면이 없으면(URL 직접 진입)
          열람권이 있으면 결과 화면, 없으면 랜딩. 앱(홈 화면 웹앱)은 회원 전용이라 뒤로가기를 두지 않는다 */}
      <OnboardingHeader onBack={isStandaloneApp() ? undefined : goBack} />

      <main className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden px-[40px] py-[40px] max-md:px-lg max-md:py-[24px]">
        {/* 레이더 카드 — 배경색 없이 그래프만 (2026-08-25).
            사이징은 로그인과 동일: 폰 = 남는 높이 채움 · 패드/웹 = min(480px, 50dvh) */}
        <RadarDemoCard
          tinted={false}
          className="max-md:min-h-0 max-md:w-auto max-md:max-w-full max-md:flex-1 md:h-[min(480px,50dvh)] md:w-auto md:max-w-full"
        />

        {/* 안내문 + 소셜 버튼 — 전 기기 단일 중앙 컬럼 (카피↔버튼 16px, 로그인과 동일) */}
        <div className="flex w-full max-w-[620px] shrink-0 flex-col items-center gap-[16px]">
          {/* 안내문 — 그래프 아래 타이틀 + 서브카피 (시안 배치) */}
          <div className="flex w-full shrink-0 flex-col gap-[8px] text-center">
            <h1 className="break-keep text-[24px] font-bold text-[#121417] max-md:text-[22px]">
              약점 진단 저장할래?
            </h1>
            <p className="break-keep text-[16px] font-medium leading-[1.4] text-[#5e6368] max-md:text-[15px]">
              가입하면 방금 푼 기록을 저장할 수 있어
            </p>
          </div>

          {/* 소셜 로그인 — 원형 아이콘 4개 + 카카오 위 "3초만에 가입" 말풍선 배지 */}
          <SocialLoginButtons
            onKakao={withReturn(startKakaoLogin)}
            onNaver={withReturn(startNaverLogin)}
            onApple={handleAppleLogin}
            onGoogle={withReturn(startGoogleLogin)}
            className="pb-[16px]"
          />

          {error && <p className="shrink-0 text-[14px] text-danger">{error}</p>}
        </div>
      </main>

      {duplicate && <DuplicateAccountDialog info={duplicate} onClose={() => setDuplicate(null)} />}
    </div>
  )
}
