import { useEffect, useMemo, useRef } from 'react'
import { type DailyActivity } from '@/user/api/attemptApi'
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
export function StreakHeatmapCard({
  today,
  activity,
  joinedAt,
}: {
  today: Date
  activity: DailyActivity[]
  /** 가입 시각 — 잔디는 가입 월부터 그린다 (없으면 1년 전체) */
  joinedAt?: string | null
}) {
  // 서버 일별 풀이 수 (푼 날만) — ReportPage 가 한 번 불러 두 카드에 나눠준다
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const day of activity) map[day.date] = day.count
    return map
  }, [activity])

  const weeks = useMemo(() => buildHeatmap(today, counts, joinedAt), [today, counts, joinedAt])
  const monthLabels = useMemo(() => buildMonthLabels(weeks), [weeks])
  const streak = useMemo(() => countStreak(weeks), [weeks])
  const activeDays = useMemo(() => countActiveDays(weeks), [weeks])

  // 판이 가입 월에 고정돼 있는가 — 마지막 열까지 아직 오지 않았으면(미래) 그렇다.
  // 이때 학습 기록은 왼쪽(가입 직후)에 모여 있고, 1년이 차면 최근 1년 창으로 굴러간다.
  const anchoredToJoin = weeks[weeks.length - 1][0].future

  // 좁은 화면에선 잔디가 카드보다 넓다 — 기록이 있는 쪽이 보이게 스크롤 시작점을 잡는다.
  // 가입 월 고정 판은 왼쪽(가입 직후)이, 최근 1년 창은 오른쪽(최신 주)이 기록 쪽이다.
  // 오버플로가 없으면 건드리지 않는다 — 서브픽셀 잔여 스크롤로 첫 라벨이 잘리는 것 방지.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el && el.scrollWidth - el.clientWidth > 8) {
      el.scrollLeft = anchoredToJoin ? 0 : el.scrollWidth
    }
  }, [weeks, anchoredToJoin])

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <div className={styles.headTexts}>
          <h2 className={styles.title}>학습 연속일</h2>
          <p className={styles.subtitle}>
            {/* 가입 1년 미만이면 판 = 가입 이후 전체 — 문구도 그에 맞춘다 */}
            {anchoredToJoin ? '가입하고 ' : '최근 1년간 '}
            <b>{activeDays}일</b> 학습했어
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
      className={`${styles.cell} ${styles[LEVEL_CLASS[day.level]]}`}
      title={day.future ? label : `${label} · 학습량 ${day.level}단계`}
    />
  )
}
