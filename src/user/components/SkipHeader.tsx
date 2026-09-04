interface SkipHeaderProps {
  onSkip: () => void
  /** 우측 액션 문구 (기본: 건너뛰기) */
  label?: string
}

/**
 * 온보딩·퍼널 화면 공통 상단바 — 로고 없이 우측 "건너뛰기"만 있는 최소 헤더.
 * 가입 유도처럼 이탈 액션 하나만 필요한 화면에서 공용으로 쓴다.
 *
 * 여백은 Figma 2824-4757 헤더 규격 — 위 44 · 아래 8 · 양옆 20 (전 기기 동일, OnboardingHeader 와 같은 리듬).
 * 노치 기기에서만 safe-area 가 44 를 넘으면 그 값을 따른다 (겹침 방지).
 */
export default function SkipHeader({ onSkip, label = '건너뛰기' }: SkipHeaderProps) {
  return (
    <header className="flex w-full shrink-0 items-center justify-center px-[20px] pb-[8px] pt-[max(44px,var(--safe-top))]">
      <div className="flex w-full max-w-[1280px] items-center justify-end">
        {/* 터치 타깃 확보 — 텍스트는 그대로, 패딩으로 누르는 영역만 키운다 */}
        <button
          type="button"
          onClick={onSkip}
          className="px-[8px] py-[8px] text-[15px] font-medium text-[#80858b] transition-colors hover:text-[#5e6368]"
        >
          {label}
        </button>
      </div>
    </header>
  )
}
