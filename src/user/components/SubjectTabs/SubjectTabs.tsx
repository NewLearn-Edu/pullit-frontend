import { clsx } from 'clsx'
import { type Subject } from '@/user/stores/tasteStore'
import styles from './styles/SubjectTabs.module.scss'

interface SubjectTabsProps {
  value: Subject
  onChange: (s: Subject) => void
  /** true 면 240px 고정 폭 · 40px 높이 (패널 내부용) */
  compact?: boolean
  /** true 면 내용 폭 알약형 (홈 헤더 — Figma 2431-17022 토글) */
  pill?: boolean
}

/**
 * 수학 | 영어 세그먼트 탭 (공용).
 * 홈 · 오답노트 등 과목 전환이 필요한 화면에서 사용.
 */
export function SubjectTabs({ value, onChange, compact, pill }: SubjectTabsProps) {
  return (
    <div
      className={clsx(styles.tabs, compact && styles.tabsCompact, pill && styles.tabsPill)}
      role="tablist"
      aria-label="과목"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'math'}
        onClick={() => onChange('math')}
        className={clsx(styles.tab, value === 'math' && styles.tabActive)}
      >
        수학
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'english'}
        onClick={() => onChange('english')}
        className={clsx(styles.tab, value === 'english' && styles.tabActive)}
      >
        영어
      </button>
    </div>
  )
}
