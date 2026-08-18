interface SkipHeaderProps {
  onSkip: () => void
  /** 우측 액션 문구 (기본: 건너뛰기) */
  label?: string
}

/**
 * 온보딩·퍼널 화면 공통 상단바 — 로고 없이 우측 "건너뛰기"만 있는 최소 헤더.
 * 가입 유도처럼 이탈 액션 하나만 필요한 화면에서 공용으로 쓴다.
 *
 * 반응형 규격 (2026-08-07 팀 확정 브레이크포인트):
 * - 모바일(~767): 좌우 16px · iOS 노치 safe-area 가산
 * - 패드·웹(768~): 좌우 40px + 최대 1280px 컨테이너 (온보딩 본문과 동일 규격)
 */
export default function SkipHeader({ onSkip, label = '건너뛰기' }: SkipHeaderProps) {
  return (
    <header className="flex w-full shrink-0 items-center justify-center px-[40px] pb-[8px] pt-[calc(24px+env(safe-area-inset-top))] max-md:px-lg max-md:pt-[calc(16px+env(safe-area-inset-top))]">
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
