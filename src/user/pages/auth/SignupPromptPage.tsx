import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  loginWithApple,
  startGoogleLogin,
  startKakaoLogin,
  startNaverLogin,
} from '@/user/api/authApi'
import iconClose from '@/assets/auth/icon-close.svg'
import logoApple from '@/assets/auth/logo-apple.svg'
import logoGoogle from '@/assets/auth/logo-google.svg'
import logoKakao from '@/assets/auth/logo-kakao.svg'
import logoNaver from '@/assets/auth/logo-naver.svg'
import logoPullit from '@/assets/auth/logo-pullit.svg'

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
  const [error, setError] = useState<string | null>(null)

  // 애플만 팝업 방식이라 콜백 페이지 없이 이 화면에서 완료·이동까지 처리
  const handleAppleLogin = async () => {
    setError(null)
    try {
      await loginWithApple()
      navigate('/home', { replace: true })
    } catch (e) {
      if ((e as { error?: string })?.error === 'popup_closed_by_user') return
      setError('Apple 로그인에 실패했어요. 다시 시도해주세요.')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="flex w-full shrink-0 items-center justify-center px-[40px] pb-[40px] pt-[32px] max-md:px-lg max-md:pb-xl max-md:pt-lg">
        <div className="flex w-full max-w-[1280px] items-center justify-between">
          <img src={logoPullit} alt="풀잇" className="h-[20px] w-[40px]" />
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="닫기"
            className="flex size-[24px] items-center justify-center"
          >
            <img src={iconClose} alt="" className="size-[24px]" />
          </button>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col items-center px-[40px] py-[40px] max-md:px-lg max-md:py-xl">
        <div className="flex w-full max-w-[620px] flex-col gap-md text-center">
          <h1 className="break-keep text-[24px] font-bold text-[#121417] max-md:text-[22px]">
            약점 진단 저장할래?
          </h1>
          <p className="break-keep text-[16px] text-[#5e6368] max-md:text-[15px]">
            3초만에 가입으로, 지금까지 푼 기록을 저장하고 이어갈 수 있어
          </p>
        </div>
      </main>

      <footer className="flex w-full shrink-0 flex-col items-center gap-md px-[40px] pb-[48px] pt-[40px] max-md:px-lg max-md:pb-[calc(32px+env(safe-area-inset-bottom))] max-md:pt-xl">
        <button
          type="button"
          onClick={startKakaoLogin}
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center gap-md rounded-[12px] bg-[#fee500] text-[16px] font-medium text-black transition-opacity hover:opacity-90 active:opacity-85"
        >
          <span className="flex size-[20px] items-center justify-center">
            <img src={logoKakao} alt="" className="w-[18px]" />
          </span>
          카카오 로그인
        </button>

        <button
          type="button"
          onClick={startNaverLogin}
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
          onClick={startGoogleLogin}
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center gap-md rounded-[12px] border border-[#ebedf0] bg-white text-[15px] font-medium leading-[1.5] text-[#262626] transition-colors hover:bg-[#f7f8f9]"
        >
          <span className="flex size-[20px] items-center justify-center">
            <img src={logoGoogle} alt="" className="size-[18px]" />
          </span>
          Google로 로그인
        </button>

        {error && <p className="text-[14px] text-danger">{error}</p>}

        <button
          type="button"
          onClick={() => navigate('/home')}
          className="mt-xs text-[15px] font-medium text-[#80858b]"
        >
          건너뛰기
        </button>
      </footer>
    </div>
  )
}
