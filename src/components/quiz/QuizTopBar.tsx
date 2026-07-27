import { clsx } from 'clsx'

interface QuizTopBarProps {
  progress: { current: number; total: number }
  subjectLabel: string
  onClose: () => void
  onPeekExplanation: () => void
  onPeekAnswer: () => void
  onSubmit: () => void
  submitDisabled: boolean
  submitLabel: string
}

/**
 * 문제풀이 화면 최상단 네비게이션 바 (1행).
 * 왼쪽: 닫기. 가운데: 과목명 + 진행바. 오른쪽: 해설/정답/채점 액션.
 * 타이머는 문제 카드 헤더로 이동됨 (2026-07-23 기획 변경).
 */
export function QuizTopBar({
  progress,
  subjectLabel,
  onClose,
  onPeekExplanation,
  onPeekAnswer,
  onSubmit,
  submitDisabled,
  submitLabel,
}: QuizTopBarProps) {
  // 진행 세그먼트 채움 개수 · 시작 (문제 1) 부터 1개 채워짐 → 현재 문제까지 도달한 것으로 표시
  // progress.current 는 1-indexed 현재 문제 번호 · 그대로 채움 수로 사용
  const filled = Math.min(progress.total, progress.current)
  const remaining = Math.max(0, progress.total - progress.current + 1)

  return (
    <header className="sticky top-0 z-30 w-full border-b border-white/10 bg-foreground">
      {/* Grid 3분할 [좌: 1fr | 중앙: auto | 우: 1fr] · 중앙 그룹이 헤더 중앙에 정확히 정렬 */}
      <div className="grid h-14 w-full min-w-[350px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-sm px-lg sm:gap-lg">
        {/* 좌측: 닫기 */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onClose}
            className="-ml-xs flex h-9 w-9 flex-none items-center justify-center rounded-full text-h4 text-white/80 hover:bg-white/10"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* 중앙: 과목명 | 성적 상승까지 N문제 + 세그먼트 진행바 (한 줄) · 헤더 정중앙 정렬 */}
        <div className="flex min-w-0 items-center justify-center gap-md leading-none">
          <span className="flex-none truncate whitespace-nowrap text-body-sm font-semibold leading-none text-white">
            {subjectLabel}
          </span>
          <span aria-hidden className="h-3 w-px flex-none bg-white/20" />
          <span className="flex-none whitespace-nowrap text-[12px] leading-none text-white/60">
            성적 상승까지 <span className="font-semibold text-white/80 tabular-nums">{remaining}문제</span>
          </span>
          <div className="flex flex-none items-center gap-[3px]">
            {Array.from({ length: progress.total }, (_, i) => {
              const isFilled = i < filled
              return (
                <span
                  key={i}
                  aria-hidden
                  className={clsx(
                    'h-1 w-[22px] rounded-full transition-colors',
                    isFilled ? 'bg-primary' : 'bg-white/15',
                  )}
                />
              )
            })}
          </div>
        </div>

        {/* 우측: 해설 · 정답 · 채점하기
            모바일 = 아이콘만 · 데스크탑 = 텍스트 · 항상 노출 → 모바일에서도 접근 가능 */}
        <div className="flex items-center justify-end gap-xs sm:gap-md">
          <PeekButton onClick={onPeekExplanation} label="해설" icon={<HintIcon />} />
          <PeekButton onClick={onPeekAnswer} label="정답" icon={<KeyIcon />} />
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            className="inline-flex h-9 flex-none items-center justify-center whitespace-nowrap rounded-btn-md bg-primary px-md text-body-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 sm:px-lg"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </header>
  )
}

/**
 * 해설/정답 미리보기 버튼.
 * - 모바일 (< sm): 아이콘만 · h-9 w-9 원형 hit area
 * - 데스크탑 (sm+): 텍스트 라벨 · h-8 rounded
 */
function PeekButton({
  onClick,
  label,
  icon,
}: {
  onClick: () => void
  label: string
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-primary sm:h-8 sm:w-auto sm:rounded-btn-sm sm:px-sm"
    >
      <span className="sm:hidden">{icon}</span>
      <span className="hidden text-body-sm font-semibold sm:inline">
        {label}
      </span>
    </button>
  )
}

function HintIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

