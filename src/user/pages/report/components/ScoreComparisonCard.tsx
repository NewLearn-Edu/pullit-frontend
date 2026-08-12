import { useState } from 'react'
import { clsx } from 'clsx'
import { useSheetDrag } from '@/user/hooks/useSheetDrag'
import { getScoreComparison } from '../reportData'
import styles from './styles/ScoreComparisonCard.module.scss'

/**
 * 평균 점수 비교 (Figma 2678-8996 · 2026-08-12 bullet chart 로 개편)
 *
 * 세로 막대 2개(내 점수 vs 평균)는 값 두 개를 보여주려고 카드를 통째로 쓰고,
 * 칩을 눌러가며 단원을 하나씩 봐야 해 비교 자체가 되지 않았다.
 * 가로 막대 + 평균 마커로 바꿔 대분류 전체를 한 화면에서 비교한다.
 */
export function ScoreComparisonCard({ categories }: { categories: string[] }) {
  const [infoOpen, setInfoOpen] = useState(false)
  const infoDrag = useSheetDrag(() => setInfoOpen(false), {
    disabled: () => window.matchMedia('(min-width: 1281px)').matches,
  })

  const rows = categories
    .map((name) => ({ name, score: getScoreComparison(name) }))
    .filter((r): r is { name: string; score: NonNullable<ReturnType<typeof getScoreComparison>> } =>
      r.score != null,
    )

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

      {rows.length > 0 ? (
        <>
          <div className={styles.rows}>
            {rows.map((row, i) => (
              <ScoreRow
                key={row.name}
                name={row.name}
                mine={row.score.mine}
                average={row.score.average}
                delay={i * 90}
              />
            ))}
          </div>

          <div className={styles.legend}>
            <span className={styles.legendMarker} aria-hidden />
            풀잇 평균
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          아직 푼 문제가 없어
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
            <div className={styles.infoFormula}>맞힌 배점 합 ÷ 푼 배점 합 × 100</div>
            <button type="button" onClick={() => setInfoOpen(false)} className={styles.infoClose}>
              확인했어
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/** 한 단원 = 이름·점수·증감 + 가로 막대(내 점수) + 평균 마커 */
function ScoreRow({
  name,
  mine,
  average,
  delay,
}: {
  name: string
  mine: number
  average: number
  delay: number
}) {
  const diff = mine - average
  const above = diff >= 0
  // 마커가 양 끝에 붙으면 라벨이 카드 밖으로 나간다 — 정렬을 바꿔 안쪽으로 접는다
  const markerAlign = average > 88 ? '-100%' : average < 12 ? '0%' : '-50%'

  return (
    <div className={styles.row}>
      <div className={styles.rowHead}>
        <span className={styles.name}>{name}</span>
        <span className={styles.rowRight}>
          <span className={styles.score}>{mine}점</span>
          <span className={clsx(styles.delta, above ? styles.deltaUp : styles.deltaDown)}>
            {above ? '▲' : '▼'} {above ? '+' : ''}
            {diff}
          </span>
        </span>
      </div>

      <div className={styles.trackWrap}>
        <div className={styles.track}>
          <div
            className={clsx(styles.fill, !above && styles.fillBelow)}
            style={{ width: `${Math.min(100, mine)}%`, animationDelay: `${delay}ms` }}
          />
        </div>
        <span className={styles.marker} style={{ left: `${Math.min(100, average)}%` }} aria-hidden />
        <span
          className={styles.markerLabel}
          style={{ left: `${Math.min(100, average)}%`, transform: `translateX(${markerAlign})` }}
        >
          {average}
        </span>
      </div>
    </div>
  )
}
