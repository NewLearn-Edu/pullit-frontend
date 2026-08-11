import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  loginWithApple,
  startGoogleLogin,
  startKakaoLogin,
  startNaverLogin,
} from '@/user/api/authApi'
import { finishLogin, warmUpSessionBeforeLogin } from '@/user/services/finishLogin'
import { selectIsMember, useUserStore } from '@/user/stores/userStore'
import { setPostLoginRedirect } from '@/user/utils/postLoginRedirect'
import WeaknessRadar from '@/user/components/WeaknessRadar/WeaknessRadar'
import logoApple from '@/assets/auth/logo-apple.svg'
import logoGoogle from '@/assets/auth/logo-google.svg'
import logoKakao from '@/assets/auth/logo-kakao.svg'
import logoNaver from '@/assets/auth/logo-naver.svg'

/**
 * 약점 그래프 데모 시나리오 (Figma 2689-12016 기반 목 데이터).
 * 몇 초마다 단원 점수가 바뀌며 그래프가 morph — 잘하던 단원(지수·로그함수)이
 * 약점으로 떨어지는 순간 폴리곤이 줄어들고 펄스가 켜지는 걸 보여준다.
 */
const RADAR_UNIT_NAMES = [
  '지수·로그',
  '지수·로그함수',
  '삼각함수',
  '사인·코사인',
  '등차·등비',
  '수열의 합',
  '수학적 귀납법',
]

const RADAR_SCENARIOS: number[][] = [
  [62, 100, 62, 100, 56, 100, 56], // 기본 (Figma 시안)
  [62, 55, 62, 100, 56, 100, 56], // 지수·로그함수가 약점으로 — 그래프가 줄어든다
  [78, 55, 45, 88, 56, 100, 74], // 삼각함수 악화 · 지수·로그/귀납법 회복
  [62, 100, 62, 64, 82, 62, 56], // 사인·코사인/수열의 합 약점 전환
]

/**
 * PI-PAGE-001 · 가입 유도 (맛보기 완주 후 기록 저장 유도)
 *
 * 레이아웃은 헤더 / 안내문 / 버튼 스택 3단 세로 배치.
 * 안내문은 본문 영역 상단에 붙고 버튼 스택은 화면 하단에 고정되는 온보딩 형태라
 * 웹·패드·모바일 모두 동일 구조를 쓰고 여백·타이포만 단계적으로 줄인다.
 * - 웹/패드(>=768px): 좌우 40px + 최대 1280px 컨테이너, 본문 컬럼 620px
 * - 모바일(<768px): 좌우 16px, 타이틀 22px, 하단 여백에 iOS 홈 인디케이터 safe-area 가산
 *
 * 로그인 동작은 LoginPage 와 동일한 authApi 를 그대로 사용한다
 * (카카오·네이버·구글 = 인가코드 리다이렉트, 애플 = 팝업).
 */
export default function SignupPromptPage() {
  const navigate = useNavigate()
  const isMember = useUserStore(selectIsMember)
  const [error, setError] = useState<string | null>(null)
  // 건너뛰기 확인 — 게스트 기록의 한계(브라우저 종속·2주 후 삭제)를 고지하고 진행
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false)

  // 약점 그래프 데모 — 3.2초마다 시나리오 순환
  const [scenarioIdx, setScenarioIdx] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(
      () => setScenarioIdx((i) => (i + 1) % RADAR_SCENARIOS.length),
      3200,
    )
    return () => clearInterval(timer)
  }, [])
  const radarUnits = RADAR_UNIT_NAMES.map((name, i) => ({
    name,
    score: RADAR_SCENARIOS[scenarioIdx][i],
  }))

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

  /** 소셜 로그인 시작 전 공통 처리 — 로그인 후 보던 결과 화면으로 복귀 */
  const withReturn = (startLogin: () => void) => () => {
    setPostLoginRedirect('/weakness')
    startLogin()
  }

  // 애플만 팝업 방식이라 콜백 페이지 없이 이 화면에서 완료·이동까지 처리
  const handleAppleLogin = async () => {
    setError(null)
    setPostLoginRedirect('/weakness')
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
    <div className="flex h-dvh touch-none flex-col overflow-hidden overscroll-none bg-white">

      {/* 타이틀 · 그래프 · 로그인 버튼을 한 묶음으로 세로 중앙 정렬 — 그래프 간격은 margin 으로 관리 */}
      {/* 타이틀·그래프·버튼을 촘촘한 한 묶음으로 — 묶음 자체를 세로 중앙 정렬 */}
      <main className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-[40px] pb-[calc(24px+env(safe-area-inset-bottom))] pt-[16px] max-md:px-lg">
        <div className="flex w-full max-w-[620px] shrink-0 flex-col gap-md text-center">
          <h1 className="break-keep text-[24px] font-bold text-[#121417] max-md:text-[22px]">
            약점 진단 저장할래?
          </h1>
          <p className="break-keep text-[16px] text-[#5e6368] max-md:text-[15px]">
            3초만에 가입으로,{' '}
            {/* 모바일에서만 줄바꿈 — 데스크톱은 한 줄 유지 */}
            <br className="hidden max-md:block" />
            지금까지 푼 기록을 저장하고 이어갈 수 있어
          </p>
        </div>

        {/* 약점 레이더 그래프 데모 — 화면이 좁으면 이 블록만 줄어든다 */}
        <div className="my-[30px] flex min-h-0 w-full shrink items-center justify-center max-md:my-[24px]">
          <div className="aspect-[360/336] max-h-full w-full max-w-[430px]">
            <WeaknessRadar units={radarUnits} className="h-full w-full" />
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col items-center gap-md">
        <button
          type="button"
          onClick={withReturn(startKakaoLogin)}
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center gap-md rounded-[12px] bg-[#fee500] text-[16px] font-medium text-black transition-opacity hover:opacity-90 active:opacity-85"
        >
          <span className="flex size-[20px] items-center justify-center">
            <img src={logoKakao} alt="" className="w-[18px]" />
          </span>
          카카오 로그인
        </button>

        <button
          type="button"
          onClick={withReturn(startNaverLogin)}
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center gap-md rounded-[12px] bg-[#03c75a] text-[16px] font-medium text-white transition-opacity hover:opacity-90 active:opacity-85"
        >
          <span className="flex size-[20px] items-center justify-center">
            {/* 원본 에셋이 상하 반전 상태로 내보내져 렌더 시 되돌린다 (Figma 프레임과 동일) */}
            <img src={logoNaver} alt="" className="size-[16px] -scale-y-100" />
          </span>
          네이버 로그인
        </button>

        <button
          type="button"
          onClick={handleAppleLogin}
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center gap-md rounded-[12px] bg-black text-[16px] font-medium text-white transition-opacity hover:opacity-90 active:opacity-85"
        >
          <span className="flex size-[20px] items-center justify-center">
            <img src={logoApple} alt="" className="size-[20px]" />
          </span>
          Apple로 로그인
        </button>

        <button
          type="button"
          onClick={withReturn(startGoogleLogin)}
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center gap-md rounded-[12px] border border-[#ebedf0] bg-white text-[15px] font-medium leading-[1.5] text-[#262626] transition-colors hover:bg-[#f7f8f9]"
        >
          <span className="flex size-[20px] items-center justify-center">
            <img src={logoGoogle} alt="" className="size-[18px]" />
          </span>
          Google로 로그인
        </button>

        {error && <p className="text-[14px] text-danger">{error}</p>}

          {/* 터치 타깃 확보 — 텍스트는 그대로, 패딩으로 누르는 영역만 키운다 */}
          <button
            type="button"
            onClick={() => setSkipConfirmOpen(true)}
            className="px-xl py-[12px] text-[15px] font-medium text-[#80858b]"
          >
            건너뛰기
          </button>
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
          <div className="relative w-full max-w-[400px] animate-[pi-modal-pop_260ms_cubic-bezier(0.22,0.9,0.3,1)] rounded-[20px] bg-white px-[24px] pb-[20px] pt-[28px] max-md:max-w-none max-md:animate-[pi-modal-rise_300ms_cubic-bezier(0.22,0.9,0.3,1)] max-md:rounded-b-none max-md:rounded-t-[24px] max-md:pb-[calc(20px+env(safe-area-inset-bottom))]">
            <div className="mx-auto flex size-[52px] items-center justify-center rounded-full bg-[#fff1f2] text-[24px]">
              ⏳
            </div>
            <h2
              id="skip-confirm-title"
              className="mt-[14px] break-keep text-center text-[20px] font-bold text-[#121417]"
            >
              저장하지 않고 넘어갈까?
            </h2>
            <p className="mt-[8px] break-keep text-center text-[14px] text-[#80858b]">
              가입하지 않으면 진단 기록이
            </p>

            <ul className="mt-[16px] flex flex-col gap-[10px] rounded-[14px] bg-[#f7f8f9] px-[18px] py-[16px]">
              <li className="flex items-start gap-[8px] text-[14.5px] leading-[1.55] text-[#40464c]">
                <span className="mt-[7px] size-[4px] shrink-0 rounded-full bg-[#a6abb1]" aria-hidden />
                <span className="break-keep">
                  <b className="font-semibold text-[#121417]">이 브라우저에만 남아</b> — 다른 기기나
                  브라우저에서는 볼 수 없어
                </span>
              </li>
              <li className="flex items-start gap-[8px] text-[14.5px] leading-[1.55] text-[#40464c]">
                <span className="mt-[7px] size-[4px] shrink-0 rounded-full bg-[#a6abb1]" aria-hidden />
                <span className="break-keep">
                  <b className="font-semibold text-[#ff385c]">2주가 지나면 모두 사라져</b> — 다시
                  오면 처음부터 시작해야 해
                </span>
              </li>
            </ul>

            <div className="mt-[20px] flex flex-col gap-[8px]">
              <button
                type="button"
                onClick={() => setSkipConfirmOpen(false)}
                className="h-[54px] rounded-[12px] bg-[#ff385c] text-[16px] font-bold text-white transition-opacity hover:opacity-90 active:opacity-85"
              >
                3초만에 저장하기
              </button>
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="h-[46px] rounded-[12px] text-[15px] font-medium text-[#80858b] transition-colors hover:bg-[#f7f8f9]"
              >
                사라져도 괜찮아
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
