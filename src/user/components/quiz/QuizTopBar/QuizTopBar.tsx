import styles from './styles/QuizTopBar.module.scss'

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
  // 현재 문제 포함 남은 문제 수
  const remaining = Math.max(0, progress.total - progress.current + 1)

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
          <span aria-hidden className={styles.vDivider} />
          <span className={styles.remaining}>
            성적 상승까지{' '}
            <span className={styles.remainingCount}>{remaining}문제</span>
          </span>
        </div>

        {/* 우측: 해설 · 정답 · 채점하기 */}
        <div className={styles.right}>
          <PeekButton onClick={onPeekExplanation} label="해설" icon={<HintIcon />} />
          <PeekButton onClick={onPeekAnswer} label="정답" icon={<KeyIcon />} />
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            className={styles.submitButton}
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
