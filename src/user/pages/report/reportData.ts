import { type DailyActivity } from '@/user/api/attemptApi'

/**
 * 학습 리포트 데이터 (Figma 2678-8990)
 *
 * POC 목 데이터 — 결정적(deterministic)으로 생성해 렌더마다 값이 흔들리지 않는다.
 * 실 API 연동 시 이 파일의 build* 함수만 서버 응답 매핑으로 교체하면 된다.
 */

// ── 학습 연속일 (히트맵) ─────────────────────────────────────────────────────

/** 하루치 학습량 — level 0(없음) ~ 4(많음) */
export interface HeatmapDay {
  date: Date
  level: 0 | 1 | 2 | 3 | 4
  /** 아직 오지 않은 날 — 빈 자리로 표시 */
  future: boolean
}

/** 한 주(일~토 7칸) — GitHub 잔디와 동일하게 열 = 주, 행 = 요일 */
export type HeatmapWeek = HeatmapDay[]

/** 최대 1년 = 53주 (GitHub 컨트리뷰션 그래프와 동일한 상한) */
export const HEATMAP_WEEKS = 53

/**
 * 그날 푼 문제 수 → 색 단계. 1세트 = 3문제라 세트 단위로 딱 떨어진다:
 * 1세트 이하 = 1, 2세트 = 2, 3세트 = 3, 4세트 이상 = 4.
 */
export function activityLevel(count: number): HeatmapDay['level'] {
  if (count <= 0) return 0
  if (count <= 3) return 1
  if (count <= 6) return 2
  if (count <= 9) return 3
  return 4
}

/** Date → 서버 날짜 키 "YYYY-MM-DD" (로컬 기준 — toISOString 은 UTC 라 하루 밀린다) */
export function dateKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

/**
 * 잔디 — 항상 53주(1년) 판을 통째로 그린다 (GitHub 컨트리뷰션 그래프 방식).
 *
 * 가입 1년 미만이면 판의 시작이 가입 월 1일이 든 주 — 오늘 이후는 빈 칸으로
 * 남아 있다가 시간이 지나며 채워진다. 가입 1년이 넘으면 이번 주가 마지막 열인
 * 최근 1년 창으로 굴러간다. joinedAt 이 없으면(로딩 전·게스트) 최근 1년 창.
 * counts = 서버 일별 풀이 수 맵 (푼 날만 있음, 없는 날 = 0).
 */
export function buildHeatmap(
  today: Date,
  counts: Record<string, number>,
  joinedAt?: string | null,
): HeatmapWeek[] {
  // 기본(최근 1년 창)의 시작 — 이번 주 토요일에서 53주를 거슬러 올라간 일요일
  const trailingStart = new Date(today)
  trailingStart.setHours(0, 0, 0, 0)
  trailingStart.setDate(trailingStart.getDate() + (6 - trailingStart.getDay()) - (HEATMAP_WEEKS * 7 - 1))

  let start = trailingStart
  if (joinedAt) {
    const joined = new Date(joinedAt)
    const monthStart = new Date(joined.getFullYear(), joined.getMonth(), 1)
    monthStart.setDate(monthStart.getDate() - monthStart.getDay()) // 그 주 일요일
    if (monthStart.getTime() > trailingStart.getTime()) start = monthStart
  }

  return Array.from({ length: HEATMAP_WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      const future = date.getTime() > today.getTime()
      return {
        date,
        level: future ? (0 as const) : activityLevel(counts[dateKey(date)] ?? 0),
        future,
      }
    }),
  )
}

/**
 * 열(주)마다 표시할 월 라벨 — 그 달의 첫 주에만 값이 있고 나머지는 null.
 * 첫 열은 시작 월(가입 월) 라벨을 붙이되, 두어 열 안에서 달이 바뀌면
 * 라벨끼리 겹치므로 그때는 생략한다.
 */
export function buildMonthLabels(weeks: HeatmapWeek[]): Array<number | null> {
  let prev = -1
  const labels = weeks.map((week, i) => {
    const month = week[0].date.getMonth()
    if (i === 0) {
      prev = month
      return null
    }
    if (month !== prev) {
      prev = month
      return month + 1
    }
    return null
  })
  // 첫 열 = 시작 주 — 주 후반(토요일) 기준 달이 그 열의 대표 달이다
  const firstMonth = weeks[0]?.[6].date.getMonth()
  if (firstMonth != null && labels[1] == null && labels[2] == null) {
    labels[0] = firstMonth + 1
  }
  return labels
}

/**
 * 연속 학습일 — level > 0 인 날이 끊기지 않은 길이.
 * 오늘은 아직 안 풀었을 수 있으므로 오늘이 비어 있으면 어제부터 센다
 * (하루가 끝나기 전까지는 연속이 깨진 게 아니다).
 */
export function countStreak(weeks: HeatmapWeek[]): number {
  const flat = weeks.flat().filter((d) => !d.future)
  let end = flat.length - 1
  if (end >= 0 && flat[end].level === 0) end-- // 오늘 미학습 — 판정 보류
  let streak = 0
  for (let i = end; i >= 0; i--) {
    if (flat[i].level === 0) break
    streak++
  }
  return streak
}

/** 1년간 학습한 날 수 — 헤더 부제용 */
export function countActiveDays(weeks: HeatmapWeek[]): number {
  return weeks.flat().filter((d) => !d.future && d.level > 0).length
}

// ── 이번 주 학습 (라인 차트) ─────────────────────────────────────────────────

export type WeeklyMetric = 'solved' | 'minutes'

export interface WeeklyMetricConfig {
  key: WeeklyMetric
  label: string
  /** 툴팁·값 표기 단위 */
  unit: string
  /** y축 상한 최솟값 — 실제 상한은 max(이 값, 이번 주 최댓값) */
  max: number
}

/** 시안 3368-9029 — 지표 2개 (정답률은 빠졌다) */
export const WEEKLY_METRICS: WeeklyMetricConfig[] = [
  { key: 'solved', label: '푼 문제 수', unit: '문제', max: 12 },
  { key: 'minutes', label: '학습 시간', unit: '분', max: 60 },
]

export interface WeeklyPoint {
  /** 0=일 ~ 6=토 */
  day: number
  values: Record<WeeklyMetric, number>
}

/**
 * 이번 주(일~토) 일별 지표 — 누적이 아니라 그날그날의 값.
 * 서버 일별 학습량(daily-activity)에서 이번 주 구간만 뽑는다.
 * 오늘 이후는 null 로 잘라 라인이 오늘까지만 그려지게 한다.
 */
export function buildWeekly(
  activity: DailyActivity[],
  today: Date,
): Array<WeeklyPoint | null> {
  const byDate = new Map(activity.map((d) => [d.date, d]))
  const sunday = new Date(today)
  sunday.setHours(0, 0, 0, 0)
  sunday.setDate(sunday.getDate() - sunday.getDay())

  return Array.from({ length: 7 }, (_, day) => {
    if (day > today.getDay()) return null
    const date = new Date(sunday)
    date.setDate(sunday.getDate() + day)
    const found = byDate.get(dateKey(date))
    return {
      day,
      values: {
        solved: found?.count ?? 0,
        minutes: found ? Math.round(found.timeSpentMs / 60000) : 0,
      },
    }
  })
}

export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
