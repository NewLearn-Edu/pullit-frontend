import { useEffect, useMemo, useRef } from 'react'
import {
  buildHeatmap,
  buildMonthLabels,
  countActiveDays,
  countStreak,
  type HeatmapDay,
} from '../reportData'
import styles from './styles/StreakHeatmapCard.module.scss'

const LEVEL_CLASS = ['lv0', 'lv1', 'lv2', 'lv3', 'lv4'] as const
/** 왼쪽 요일 축 — GitHub 처럼 월·수·금만 표기 */
const DAY_AXIS = ['', '월', '', '수', '', '금', '']

/**
 * 학습 연속일 (Figma 2678-9949 · GitHub 컨트리뷰션 그래프 방식)
 * 최근 1년(53주)을 열 = 주, 행 = 일~토 로 그린다.
 * 좁은 화면에서는 가로 스크롤되며, 진입 시 최신(오른쪽 끝)으로 맞춰진다.
 */
export function StreakHeatmapCard({ today }: { today: Date }) {
  const weeks = useMemo(() => buildHeatmap(today), [today])
  const monthLabels = useMemo(() => buildMonthLabels(weeks), [weeks])
  const streak = useMemo(() => countStreak(weeks), [weeks])
  const activeDays = useMemo(() => countActiveDays(weeks), [weeks])

  // 1년치는 대부분의 화면보다 넓다 — 가장 최근 주가 보이게 오른쪽 끝에서 시작
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [weeks])

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <div className={styles.headTexts}>
          <h2 className={styles.title}>학습 연속일</h2>
          <p className={styles.subtitle}>
            최근 1년간 <b>{activeDays}일</b> 학습했어
          </p>
        </div>
        <span className={styles.badge}>
          {streak}일 연속 <span aria-hidden>🔥</span>
        </span>
      </header>

      {/* 요일 축은 스크롤 밖에 둔다 — 안에 두면 오른쪽 끝으로 스크롤될 때 함께 밀려 사라진다 */}
      <div className={styles.chartRow}>
        <div className={styles.dayAxis}>
          {DAY_AXIS.map((d, i) => (
            <span key={i} className={styles.dayAxisLabel}>
              {d}
            </span>
          ))}
        </div>

        <div ref={scrollRef} className={styles.scroll}>
          <div className={styles.body}>
            {/* 월 라벨 — 달이 바뀌는 주 열 위에만 표시 */}
            <div className={styles.months}>
              {monthLabels.map((m, i) => (
                <span key={i} className={styles.month}>
                  {m ? `${m}월` : ''}
                </span>
              ))}
            </div>

            <div className={styles.weeks}>
              {weeks.map((week, wi) => (
                <div key={wi} className={styles.week}>
                  {week.map((day) => (
                    <Cell key={day.date.toISOString()} day={day} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
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

function Cell({ day }: { day: HeatmapDay }) {
  const label = `${day.date.getFullYear()}.${day.date.getMonth() + 1}.${day.date.getDate()}`
  return (
    <i
      className={`${styles.cell} ${styles[LEVEL_CLASS[day.level]]} ${day.future ? styles.future : ''}`}
      title={day.future ? label : `${label} · 학습량 ${day.level}단계`}
    />
  )
}
