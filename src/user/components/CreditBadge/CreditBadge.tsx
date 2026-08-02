import { clsx } from 'clsx'
import styles from './styles/CreditBadge.module.scss'

interface CreditBadgeProps {
  credit: number
  /** sm = 모바일 헤더 (✦ 5) · md = 데스크탑 헤딩 (✦ 크레딧 5) */
  size?: 'sm' | 'md'
}

/** ✦ 크레딧 배지 (공용) */
export function CreditBadge({ credit, size = 'sm' }: CreditBadgeProps) {
  return (
    <span
      className={clsx(styles.badge, size === 'sm' ? styles.badgeSm : styles.badgeMd)}
    >
      <span className={styles.spark}>✦</span>
      {size === 'md' ? `크레딧 ${credit}` : credit}
    </span>
  )
}
