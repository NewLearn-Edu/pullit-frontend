import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  finishAppleLogin,
  openAppleSignIn,
  prepareAppleLogin,
  startGoogleLogin,
  startKakaoLogin,
  startNaverLogin,
} from '@/user/api/authApi'
import { finishLogin, warmUpSessionBeforeLogin } from '@/user/services/finishLogin'
import { extractDuplicateAccount, type DuplicateAccountInfo } from '@/user/api/authApi'
import { DuplicateAccountDialog } from '@/user/components/DuplicateAccountDialog'
import { flushAttemptQueue } from '@/user/services/attemptQueue'
import { isEarlybird } from '@/user/services/earlybird'
import { selectIsMember, useUserStore } from '@/user/stores/userStore'
import { setPostLoginRedirect } from '@/user/utils/postLoginRedirect'
import { weaknessResultPath } from '@/user/services/trialRoutes'
import { useTrialStore } from '@/user/stores/trialStore'
import SkipHeader from '@/user/components/SkipHeader'
import OnboardingHeader from '@/user/components/OnboardingHeader'
import { isStandaloneApp } from '@/user/utils/standalone'
import SocialLoginButtons from '@/user/components/SocialLoginButtons'
import RadarDemoCard from '@/user/components/WeaknessRadar/RadarDemoCard'

/**
 * PI-PAGE-RESULT_SIGNUP · 가입 유도 (맛보기 완주 후 기록 저장 유도 · Figma 2824-5679)
 *
 * 진입은 둘 — 맛보기 결과의 "가입하기"(온보딩 퍼널) · 마이페이지 게스트의 "10초만에 가입하기".
 *
 * 레이아웃은 헤더(로고 + 건너뛰기) / 레이더 카드 / 안내문 / 소셜 아이콘 4개 세로 배치.
 * 맛보기는 세션 없이 진행되므로 users 로우는 이 화면에서 처음 생긴다 —
 * 건너뛰기 = 게스트 생성 + 큐에 쌓인 풀이 기록 전송 후 홈, 소셜 로그인 = 회원 생성
 * (기록 전송은 finishLogin 이 담당). (2026-08-19 확정)
 *
 * 로그인 동작은 LoginPage 와 동일한 authApi 를 그대로 사용한다
 * (카카오·네이버·구글 = 인가코드 리다이렉트, 애플 = 팝업).
 */
export default function SignupPromptPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isMember = useUserStore(selectIsMember)
  const ensureSession = useUserStore((s) => s.ensureSession)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateAccountInfo | null>(null) // 다른 소셜로 가입된 이메일 — 안내 팝업
  // 건너뛰기 확인 — 게스트 기록의 한계(브라우저 종속·7일 후 삭제)를 고지하고 진행
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false)
  const [skipping, setSkipping] = useState(false)

  /**
   * 건너뛰기 확정 — 게스트 생성 + 맛보기 풀이 기록 전송 후 홈 (여기서 users 로우가 처음 생긴다).
   *
   * 결과 열람권도 여기서 소비한다 (2026-09-06) — 결과 화면은 /signup 으로 나갈 때만 열람권을
   * 남겨두는데(로그인 왕복 대비), 건너뛰기는 그 왕복 없이 퍼널을 아주 떠나는 길이다.
   * 안 지우면 열람권이 세션 내내 살아남아, 나중에 가입할 때 지난 진단 결과가 다시 열렸다.
   */
  const confirmSkip = async () => {
    if (skipping) return
    setSkipping(true)
    useTrialStore.getState().consumeResultPass()
    try {
      await ensureSession() // 게스트 발급 — 실패해도 홈 진입은 막지 않는다
      await flushAttemptQueue().catch(() => {})
    } finally {
      navigate('/home')
    }
  }

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
      {/* 상단바 — 우측 건너뛰기만 (온보딩 공용 SkipHeader).
          홈 화면 웹앱(아이패드·안드로이드)은 회원 전용이라 건너뛰기(게스트) 없이 상단 여백만 둔다 (2026-09-04) */}
      {isStandaloneApp() ? <OnboardingHeader /> : <SkipHeader onSkip={() => setSkipConfirmOpen(true)} />}

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

      {/* 건너뛰기 확인 — 데스크탑 중앙 다이얼로그 · 모바일 바텀시트 */}
      {skipConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="skip-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-[20px] max-md:items-end max-md:p-0"
        >
          <style>{`
            @keyframes pi-modal-fade { from { opacity: 0 } }
            @keyframes pi-modal-pop { from { opacity: 0; transform: scale(0.94) translateY(10px) } }
            @keyframes pi-modal-rise { from { transform: translateY(100%) } }
          `}</style>
          {/* 배경 딤 — 탭하면 닫힘 (= 가입 유도 화면 유지) */}
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setSkipConfirmOpen(false)}
            className="absolute inset-0 animate-[pi-modal-fade_200ms_ease] bg-black/45"
          />
          {/* 크레딧 시트와 같은 문법 — 타이틀 + 완결된 두 줄 안내 + 버튼 스택 */}
          <div className="relative w-full max-w-[400px] animate-[pi-modal-pop_260ms_cubic-bezier(0.22,0.9,0.3,1)] rounded-[20px] bg-white px-[24px] pb-[20px] pt-[28px] max-md:max-w-none max-md:animate-[pi-modal-rise_300ms_cubic-bezier(0.22,0.9,0.3,1)] max-md:rounded-b-none max-md:rounded-t-[24px] max-md:pb-[calc(20px+env(safe-area-inset-bottom))]">
            <h2
              id="skip-confirm-title"
              className="break-keep text-center text-[18px] font-semibold text-[#121417]"
            >
              저장하지 않고 넘어갈까?
            </h2>
            <p className="mt-[10px] break-keep text-center text-[14px] leading-[1.6] text-[#6f686a]">
              지금 나가면 진단 기록은 이 브라우저에만 남고,
              <br />
              <b className="font-semibold text-[#ff385c]">7일이 지나면 사라져</b>
            </p>

            <div className="mt-[20px] flex flex-col gap-[8px]">
              <button
                type="button"
                onClick={() => setSkipConfirmOpen(false)}
                className="h-[54px] rounded-[12px] bg-[#ff385c] text-[16px] font-bold text-white transition-colors hover:bg-[#e6203f]"
              >
                3초만에 저장하기
              </button>
              <button
                type="button"
                onClick={confirmSkip}
                disabled={skipping}
                className="h-[46px] rounded-[12px] text-[15px] font-medium text-[#80858b] transition-colors hover:bg-[#f7f8f9] disabled:opacity-60"
              >
                {skipping ? '이동 중…' : '사라져도 괜찮아'}
              </button>
            </div>
          </div>
        </div>
      )}
      {duplicate && <DuplicateAccountDialog info={duplicate} onClose={() => setDuplicate(null)} />}
    </div>
  )
}
