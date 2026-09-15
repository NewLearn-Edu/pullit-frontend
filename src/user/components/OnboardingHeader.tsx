import iconClose from '@/assets/auth/icon-close.svg'

interface OnboardingHeaderProps {
  /** 좌측 뒤로가기 chevron. 생략하면 없음 (가입 유도 화면 — 결과 화면으로 되돌아간다 · 2026-09-15) */
  onBack?: () => void
  /** 우측 닫기 X. 생략하면 X 없이 상단 여백만 유지한다 (약점 결과 화면 — 하단 CTA 로만 나간다 · 2026-09-04) */
  onClose?: () => void
}

/**
 * 맛보기 온보딩 계열 화면(과목 선택 · 약점 결과 · 가입 정보 · 세트 완료 결과)의 공통 상단바.
 * 우측 닫기 X 만 둔다 (2026-08-18 확정). 좌측 로고는 어떤 화면에도 넣지 않는다 —
 * 시안에 헤더 로고가 없고, 옵션(showLogo)으로 남겨두면 되살아나서 2026-09-02 옵션 자체를 제거했다.
 * 여백은 Figma 2824-4757 헤더 규격 — 위 44 · 아래 8 · 양옆 20 (전 기기 동일, SkipHeader 와 같은 리듬).
 * 노치 기기에서만 safe-area 가 44 를 넘으면 그 값을 따른다 (겹침 방지).
 */
export default function OnboardingHeader({ onBack, onClose }: OnboardingHeaderProps) {
  return (
    <header className="flex w-full shrink-0 items-center justify-center px-[20px] pb-[8px] pt-[max(44px,var(--safe-top))]">
      <div className="flex w-full max-w-[1280px] items-center justify-between">
        {/* 좌측 슬롯 — 뒤로가기가 없어도 자리를 지켜 X 가 오른쪽 끝에 남게 */}
        <div className="flex size-[24px] items-center justify-center">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="뒤로"
              className="flex size-[24px] items-center justify-center text-[#121417]"
            >
              {/* PageHeader 의 chevron 과 같은 패스 */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex size-[24px] items-center justify-center"
          >
            <img src={iconClose} alt="" className="size-[24px]" />
          </button>
        )}
      </div>
    </header>
  )
}
