import iconClose from '@/assets/auth/icon-close.svg'
import logoPullit from '@/assets/auth/logo-pullit.svg'

interface OnboardingHeaderProps {
  onClose: () => void
}

/**
 * 맛보기 온보딩 계열 화면(약점 결과 · 가입 유도)의 공통 상단바.
 * 로고 + 닫기만 있는 단순 헤더로, 좌우 여백과 최대 폭을 본문과 맞춘다.
 */
export default function OnboardingHeader({ onClose }: OnboardingHeaderProps) {
  return (
    <header className="flex w-full shrink-0 items-center justify-center px-[40px] pb-[40px] pt-[32px] max-md:px-lg max-md:pb-xl max-md:pt-lg">
      <div className="flex w-full max-w-[1280px] items-center justify-between">
        <img src={logoPullit} alt="풀잇" className="h-[20px] w-[40px]" />
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex size-[24px] items-center justify-center"
        >
          <img src={iconClose} alt="" className="size-[24px]" />
        </button>
      </div>
    </header>
  )
}
