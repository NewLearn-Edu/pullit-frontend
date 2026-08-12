import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { type Subject } from '@/user/stores/tasteStore'
import {
  buildWeekly,
  DAY_LABELS,
  WEEKLY_METRICS,
  type WeeklyMetric,
} from '../reportData'
import styles from './styles/WeeklyLearningCard.module.scss'

/** 가로 그리드 4줄 (0 · 1/3 · 2/3 · 상단) */
const GRID_RATIOS = [0, 0.33, 0.66, 1]

/**
 * 이번 주 학습 (Figma 2678-9670)
 * 지표 3개(푼 문제·정답률·학습 시간)를 세그먼트로 전환하며 일~토 추이를 본다.
 * 라인은 오늘까지만 그려지고, 마지막 지점 위에 값 툴팁이 붙는다.
 */
export function WeeklyLearningCard({ subject, today }: { subject: Subject; today: Date }) {
  const [metric, setMetric] = useState<WeeklyMetric>('solved')
  const config = WEEKLY_METRICS.find((m) => m.key === metric)!
  const points = useMemo(() => buildWeekly(subject, today), [subject, today])

  /** 값이 있는 지점만 (x,y) 백분율 좌표로 — 일=0%, 토=100% */
  const coords = points
    .map((p, i) =>
      p ? { x: (i / 6) * 100, y: 100 - (Math.min(p.values[metric], config.max) / config.max) * 100 } : null,
    )
    .filter((c): c is { x: number; y: number } => c != null)

  const last = coords[coords.length - 1]
  const lastValue = points.filter(Boolean).slice(-1)[0]?.values[metric] ?? 0

  // 꺾은선 · 면적 패스 (viewBox 0~100 정규 좌표계)
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${last.x} 100 L ${coords[0].x} 100 Z`
      : ''

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <h2 className={styles.title}>이번 주 학습</h2>
      </header>

      {/* 지표 세그먼트 — 활성만 흰 알약으로 떠오른다 */}
      <div className={styles.segment} role="tablist" aria-label="지표 선택">
        {WEEKLY_METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={m.key === metric}
            onClick={() => setMetric(m.key)}
            className={clsx(styles.segmentItem, m.key === metric && styles.segmentItemActive)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className={styles.chartWrap}>
        <div className={styles.chart}>
          {/* 점선 그리드 */}
          {GRID_RATIOS.map((r) => (
            <span key={r} className={styles.grid} style={{ bottom: `${r * 100}%` }} aria-hidden />
          ))}

          {/* 면적 + 선 — 비균등 스케일이라 선 굵기는 non-scaling-stroke 로 고정 */}
          <svg
            className={styles.svg}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="weekly-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff385c" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#ff385c" stopOpacity="0" />
              </linearGradient>
            </defs>
            {areaPath && <path d={areaPath} fill="url(#weekly-area)" />}
            {coords.length > 1 && (
              <path
                d={linePath}
                fill="none"
                stroke="#ff385c"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* 데이터 지점 — 마지막만 채움 원으로 강조 */}
          {coords.map((c, i) => (
            <span
              key={i}
              className={clsx(styles.dot, i === coords.length - 1 && styles.dotLast)}
              style={{ left: `${c.x}%`, bottom: `${100 - c.y}%` }}
              aria-hidden
            />
          ))}

          {/* 마지막 지점 값 툴팁 — 차트 밖으로 나가지 않게 좌우 끝에서 정렬을 바꾸고,
              점이 상단권이면 위로 뚫고 나가 세그먼트와 겹치지 않게 점 아래로 뒤집는다 */}
          {last && (
            <span
              className={styles.tooltip}
              style={{
                left: `${last.x}%`,
                ...(last.y < 30
                  ? { top: `calc(${last.y}% + 14px)` }
                  : { bottom: `calc(${100 - last.y}% + 16px)` }),
                transform: `translateX(${last.x > 85 ? '-100%' : last.x < 15 ? '0%' : '-50%'})`,
              }}
            >
              {formatValue(lastValue, metric)}
            </span>
          )}
        </div>

        <div className={styles.days}>
          {DAY_LABELS.map((d, i) => (
            <span key={d} className={clsx(styles.day, i === today.getDay() && styles.dayToday)}>
              {d}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function formatValue(value: number, metric: WeeklyMetric): string {
  const unit = WEEKLY_METRICS.find((m) => m.key === metric)?.unit ?? ''
  return `${value}${unit}`
}
