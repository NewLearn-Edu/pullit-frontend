import { clsx } from 'clsx'
import iconChevronRight from '@/assets/icon-chevron-right.svg'
import styles from './styles/CreditBadge.module.scss'

interface CreditBadgeProps {
  credit: number
  /** sm = 모바일 헤더 (🪙 5) · md = 데스크탑 헤딩 (🪙 크레딧 5) */
  size?: 'sm' | 'md'
  /** 있으면 버튼으로 렌더 — 홈에서 누르면 충전 안내 팝업 (2026-09-04) */
  onClick?: () => void
  /** 캔버스 위에 떠 있는 헤더(약점지도)용 그림자 — 흰 필이 배경에 묻히지 않게 (2026-09-06) */
  elevated?: boolean
}

/** 크레딧 코인 — 서비스 크레딧 그래픽(노란 동전 + C)의 미니 버전. 브랜드 고정색 */
export function CreditCoin() {
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

/**
 * 크레딧 배지 (공용) — C 코인 + 잔액.
 * sm 은 헤더 시안(Figma 3368-8858 credit-badge) 규격 — 오답 배지와 같은 72×33 필에
 * 코인 18 · 값 16 SemiBold · 우측 셰브런 12 (누르면 충전 안내가 열린다는 표시).
 */
export function CreditBadge({ credit, size = 'sm', onClick, elevated }: CreditBadgeProps) {
  const className = clsx(
    styles.badge,
    size === 'sm' ? styles.badgeSm : styles.badgeMd,
    onClick && styles.badgeButton,
    elevated && styles.badgeElevated,
  )
  const content = (
    <>
      <CreditCoin />
      {size === 'md' ? `크레딧 ${credit}` : credit}
      {size === 'sm' && <img src={iconChevronRight} alt="" aria-hidden className={styles.chevron} />}
    </>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={`크레딧 ${credit}개 · 충전 안내`} className={className}>
        {content}
      </button>
    )
  }
  return <span className={className}>{content}</span>
}
