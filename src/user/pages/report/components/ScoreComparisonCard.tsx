import { useState } from 'react'
import { clsx } from 'clsx'
import { useSheetDrag } from '@/user/hooks/useSheetDrag'
import { getScoreComparison } from '../reportData'
import styles from './styles/ScoreComparisonCard.module.scss'

/** 막대 최대 높이(px) — 100점 기준. 차트 영역 153px 안에서 배지·라벨을 뺀 값 */
const MAX_BAR_H = 100

interface ScoreComparisonCardProps {
  /** 대분류(수학) · 능력(영어) 칩 목록 */
  categories: string[]
  category: string
  onCategoryChange: (category: string) => void
}

/**
 * 평균 점수 비교 (Figma 2678-8996)
 * 대분류 칩으로 범위를 고르고, 풀잇 평균 vs 내 점수를 막대 2개로 비교한다.
 * 헤더 ⓘ 는 점수 산식 안내 — 모바일은 바텀시트, 데스크탑은 중앙 다이얼로그.
 */
export function ScoreComparisonCard({
  categories,
  category,
  onCategoryChange,
}: ScoreComparisonCardProps) {
  const [infoOpen, setInfoOpen] = useState(false)
  const infoDrag = useSheetDrag(() => setInfoOpen(false), {
    disabled: () => window.matchMedia('(min-width: 1281px)').matches,
  })

  const score = getScoreComparison(category)

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <h2 className={styles.title}>평균 점수 비교</h2>
        <button
          type="button"
          aria-label="점수 계산 방식 안내"
          onClick={() => setInfoOpen(true)}
          className={styles.infoButton}
        >
          i
        </button>
      </header>

      {/* 대분류 칩 — 활성은 검정 채움, 비활성은 흰 배경 + 얇은 테두리 */}
      <div className={styles.chips}>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onCategoryChange(c)}
            className={clsx(styles.chip, c === category && styles.chipActive)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 막대 2개 — 배지(점수) · 막대 · 라벨 세로 스택 */}
      {score ? (
        <div className={styles.chart}>
          <ScoreBar label="풀잇 평균" value={score.average} />
          <ScoreBar label="내 점수" value={score.mine} highlight />
        </div>
      ) : (
        <div className={styles.empty}>
          아직 이 단원은 푼 문제가 없어
          <span className={styles.emptySub}>3문제만 풀면 평균과 비교해줄게</span>
        </div>
      )}

      {infoOpen && (
        <div className={styles.infoDim} onClick={() => setInfoOpen(false)}>
          <div
            role="dialog"
            aria-label="점수 계산 방식"
            {...infoDrag.sheetProps}
            className={clsx(styles.infoSheet, infoDrag.dragging && styles.infoSheetDragging)}
            onClick={(e) => e.stopPropagation()}
          >
            <span className={styles.infoHandle} aria-hidden />
            <h3 className={styles.infoTitle}>점수는 이렇게 계산해</h3>
            <p className={styles.infoDesc}>
              맞힌 문제의 배점을 모두 더한 뒤, 푼 문제의 배점 합으로 나눈 값이야.
              어려운 문제를 맞힐수록 점수가 크게 오르고, 오답 다시 풀기는 점수에 반영되지 않아.
            </p>
            <div className={styles.infoFormula}>
              맞힌 배점 합 ÷ 푼 배점 합 × 100
            </div>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              className={styles.infoClose}
            >
              확인했어
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function ScoreBar({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  // 점수 비례 높이 — 0점이어도 막대가 보이도록 최소 6px
  const height = Math.max(6, Math.round((Math.min(100, value) / 100) * MAX_BAR_H))
  return (
    <div className={styles.barColumn}>
      <span className={clsx(styles.badge, highlight && styles.badgeHighlight)}>{value}점</span>
      <div
        className={clsx(styles.bar, highlight && styles.barHighlight)}
        style={{ height: `${height}px` }}
      />
      <span className={styles.barLabel}>{label}</span>
    </div>
  )
}
