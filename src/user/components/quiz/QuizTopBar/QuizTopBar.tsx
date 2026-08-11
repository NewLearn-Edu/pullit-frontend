import styles from './styles/QuizTopBar.module.scss'

interface QuizTopBarProps {
  /** 미전달 시 진행 문구("성적 상승까지 N문제") 없이 과목명만 표시 — 일반 문제풀이 모드 */
  progress?: { current: number; total: number }
  subjectLabel: string
  onClose: () => void
  /** 우측 액션 — 풀이 중에는 정답·해설 접근 금지라 미전달 (2026-08-07 플로우 변경) */
  onPeekExplanation?: () => void
  onPeekAnswer?: () => void
  onSubmit?: () => void
  submitDisabled?: boolean
  submitLabel?: string
  /** 우측 커스텀 액션 (예: 필기 토글) */
  rightExtra?: React.ReactNode
  /** 0~1 — 전달 시 바 하단에 진행 라인 표시 (문제 카드의 진행바 대체) */
  progressRatio?: number
}

/**
 * 문제풀이 화면 최상단 네비게이션 바 (1행).
 * 왼쪽: 닫기. 가운데: 과목명 + 진행바. 우측 액션은 전달된 것만 렌더.
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
  rightExtra,
  progressRatio,
}: QuizTopBarProps) {
  // 현재 문제 포함 남은 문제 수
  const remaining = progress ? Math.max(0, progress.total - progress.current + 1) : 0

  return (
    <header className={styles.header}>
      <div className={styles.row}>
        {/* 좌측: 닫기 */}
        <div className={styles.left}>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* 중앙: 과목명 | 성적 상승까지 N문제 (진행 바는 문제 카드 상단으로 이동) */}
        <div className={styles.center}>
          <span className={styles.subject}>{subjectLabel}</span>
          {progress && (
            <>
              <span aria-hidden className={styles.vDivider} />
              <span className={styles.remaining}>
                성적 상승까지{' '}
                <span className={styles.remainingCount}>{remaining}문제</span>
              </span>
            </>
          )}
        </div>

        {/* 우측: 전달된 액션만 (풀이 화면은 비움 — 정답·해설은 결과 페이지에서) */}
        <div className={styles.right}>
          {onPeekExplanation && (
            <PeekButton onClick={onPeekExplanation} label="해설" icon={<HintIcon />} />
          )}
          {onPeekAnswer && <PeekButton onClick={onPeekAnswer} label="정답" icon={<KeyIcon />} />}
          {onSubmit && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitDisabled}
              className={styles.submitButton}
            >
              {submitLabel}
            </button>
          )}
          {rightExtra}
        </div>
      </div>

      {/* 진행 라인 — 문제 카드에 있던 진행바를 바 하단으로 통합 (2026-08-07 UI 정리) */}
      {progressRatio != null && (
        <div className={styles.progressLine}>
          <div
            className={styles.progressLineFill}
            style={{ width: `${Math.min(1, Math.max(0, progressRatio)) * 100}%` }}
          />
        </div>
      )}
    </header>
  )
}

/**
 * 해설/정답 미리보기 버튼.
 * - 모바일 (< sm): 아이콘만 · 원형 hit area
 * - 데스크탑 (sm+): 텍스트 라벨
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
      className={styles.peekButton}
    >
      <span className={styles.peekIcon}>{icon}</span>
      <span className={styles.peekLabel}>{label}</span>
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
