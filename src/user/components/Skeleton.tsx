import { type CSSProperties } from 'react'
import styles from './Skeleton.module.scss'

/**
 * 스켈레톤 블록 — 서버 데이터가 오기 전, 콘텐츠가 설 자리를 같은 크기의
 * 회색 면 + 광택(shimmer)으로 미리 그린다.
 *
 * "빈 상태"를 실데이터처럼 그렸다가 갈아끼우면 미진단 → 점수 같은
 * 오정보 깜빡임이 생긴다 — 로딩 중이라는 사실 자체를 그리는 게 목적.
 * prefers-reduced-motion 에서는 광택 없이 정지 면만 보인다.
 */
export function Skeleton({
  className,
  style,
  radius = 16,
}: {
  className?: string
  style?: CSSProperties
  /** 실물 콘텐츠와 같은 모서리로 — 기본 16px (카드) */
  radius?: number
}) {
  return (
    <span
      className={`${styles.skeleton} ${className ?? ''}`}
      style={{ borderRadius: radius, ...style }}
      aria-hidden
    />
  )
}
