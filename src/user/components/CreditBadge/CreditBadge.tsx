import { clsx } from 'clsx'
import styles from './styles/CreditBadge.module.scss'

interface CreditBadgeProps {
  credit: number
  /** sm = 모바일 헤더 (🪙 5) · md = 데스크탑 헤딩 (🪙 크레딧 5) */
  size?: 'sm' | 'md'
}

/** 크레딧 코인 — 서비스 크레딧 그래픽(노란 동전 + C)의 미니 버전. 브랜드 고정색 */
function CreditCoin() {
  return (
    <svg className={styles.coin} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="9.2" fill="#F8D558" />
      <circle cx="10" cy="10" r="6.9" stroke="#EC9C40" strokeWidth="1.6" />
      <path
        d="M12.9 7.9a3.4 3.4 0 100 4.2"
        stroke="#E08E39"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** 크레딧 배지 (공용) — C 코인 + 잔액 */
export function CreditBadge({ credit, size = 'sm' }: CreditBadgeProps) {
  return (
    <span
      className={clsx(styles.badge, size === 'sm' ? styles.badgeSm : styles.badgeMd)}
    >
      <CreditCoin />
      {size === 'md' ? `크레딧 ${credit}` : credit}
    </span>
  )
}
