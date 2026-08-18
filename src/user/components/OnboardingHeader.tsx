import iconClose from '@/assets/auth/icon-close.svg'

interface OnboardingHeaderProps {
  onClose: () => void
}

/**
 * 맛보기 온보딩 계열 화면(과목 선택 · 약점 결과 · 가입 정보)의 공통 상단바.
 * 로고 없이 우측 닫기 X 만 있는 단순 헤더 (2026-08-18 확정 — 온보딩 헤더에 로고 안 씀).
 * 여백은 Figma 2824-4756 헤더 규격 — pb 8px · 모바일 safe-top 가산 (SkipHeader 와 동일 리듬).
 */
export default function OnboardingHeader({ onClose }: OnboardingHeaderProps) {
  return (
    <header className="flex w-full shrink-0 items-center justify-center px-[40px] pb-[8px] pt-[calc(24px+env(safe-area-inset-top))] max-md:px-lg max-md:pt-[calc(16px+env(safe-area-inset-top))]">
      <div className="flex w-full max-w-[1280px] items-center justify-end">
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
