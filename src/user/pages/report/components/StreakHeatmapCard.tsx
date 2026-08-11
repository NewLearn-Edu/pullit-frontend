import { useMemo } from 'react'
import { buildHeatmap, countStreak, type HeatmapDay } from '../reportData'
import styles from './styles/StreakHeatmapCard.module.scss'

const LEVEL_CLASS = ['lv0', 'lv1', 'lv2', 'lv3', 'lv4'] as const

/**
 * 학습 연속일 (Figma 2678-9949)
 * 최근 12주를 4주 블록 3개로 나눈 잔디 — 행 = 주, 열 = 일~토.
 * 우상단 배지는 오늘까지 끊기지 않은 연속 학습일.
 */
export function StreakHeatmapCard({ today }: { today: Date }) {
  const blocks = useMemo(() => buildHeatmap(today), [today])
  const streak = useMemo(() => countStreak(blocks, today), [blocks, today])

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <h2 className={styles.title}>학습 연속일</h2>
        <span className={styles.badge}>
          {streak}일 연속 <span aria-hidden>🔥</span>
        </span>
      </header>

      {/* 블록(4주) 단위로 월 라벨 + 잔디를 함께 세로 정렬 — 라벨과 칸이 어긋나지 않는다 */}
      <div className={styles.blocks}>
        {blocks.map((block, bi) => (
          <div key={bi} className={styles.block}>
            <span className={styles.month}>{block.month}월</span>
            <div className={styles.weeks}>
              {block.weeks.map((week, wi) => (
                <div key={wi} className={styles.week}>
                  {week.map((day) => (
                    <Cell key={day.date.toISOString()} day={day} today={today} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 범례 — 색 단계가 곧 그날의 학습량 */}
      <div className={styles.legend}>
        <span className={styles.legendLabel}>적음</span>
        {LEVEL_CLASS.map((lv) => (
          <i key={lv} className={`${styles.legendCell} ${styles[lv]}`} aria-hidden />
        ))}
        <span className={styles.legendLabel}>많음</span>
      </div>
    </section>
  )
}

function Cell({ day, today }: { day: HeatmapDay; today: Date }) {
  const future = day.date.getTime() > today.getTime()
  const label = `${day.date.getMonth() + 1}월 ${day.date.getDate()}일`
  return (
    <i
      className={`${styles.cell} ${styles[LEVEL_CLASS[day.level]]} ${future ? styles.future : ''}`}
      title={future ? label : `${label} · 학습량 ${day.level}단계`}
    />
  )
}
