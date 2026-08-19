import iconClose from '@/assets/auth/icon-close.svg'
import logoNav from '@/assets/landing/logo-nav.svg'

interface OnboardingHeaderProps {
  onClose: () => void
  /** 좌측 풀잇 로고 노출 — 결과 화면(2824-5560)만 사용, 입력 계열 화면은 X 만 */
  showLogo?: boolean
}

/**
 * 맛보기 온보딩 계열 화면(과목 선택 · 약점 결과 · 가입 정보)의 공통 상단바.
 * 기본은 우측 닫기 X 만 (2026-08-18 확정) · 결과 화면은 showLogo 로 좌측 로고 추가.
 * 여백은 Figma 2824-4757 헤더 규격 — 위 44 · 아래 8 · 양옆 20 (전 기기 동일, SkipHeader 와 같은 리듬).
 * 노치 기기에서만 safe-area 가 44 를 넘으면 그 값을 따른다 (겹침 방지).
 */
export default function OnboardingHeader({ onClose, showLogo = false }: OnboardingHeaderProps) {
  return (
    <header className="flex w-full shrink-0 items-center justify-center px-[20px] pb-[8px] pt-[max(44px,env(safe-area-inset-top))]">
      <div
        className={`flex w-full max-w-[1280px] items-center ${showLogo ? 'justify-between' : 'justify-end'}`}
      >
        {showLogo && <img src={logoNav} alt="풀잇" className="h-[20px] w-[41px]" />}
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
