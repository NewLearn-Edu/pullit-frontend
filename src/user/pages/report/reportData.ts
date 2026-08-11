import { type Subject } from '@/user/stores/tasteStore'

/**
 * 학습 리포트 데이터 (Figma 2678-8990)
 *
 * POC 목 데이터 — 결정적(deterministic)으로 생성해 렌더마다 값이 흔들리지 않는다.
 * 실 API 연동 시 이 파일의 build* 함수만 서버 응답 매핑으로 교체하면 된다.
 */

// ── 평균 점수 비교 ───────────────────────────────────────────────────────────

export interface ScoreComparison {
  /** 풀잇 전체 평균 (0~100) */
  average: number
  /** 내 점수 (0~100) */
  mine: number
}

/** 대분류(칩) → 비교 점수. 서버 연동 시 GET /api/attempts/skill-scores 집계로 대체 */
const SCORE_BY_CATEGORY: Record<string, ScoreComparison> = {
  대수: { average: 51, mine: 76 },
  '미적분 I': { average: 58, mine: 44 },
  '확률과 통계': { average: 47, mine: 62 },
  '내용 파악': { average: 55, mine: 71 },
  '글의 흐름': { average: 49, mine: 38 },
  '어휘·추론': { average: 52, mine: 58 },
  '정보 확인': { average: 61, mine: 66 },
}

export function getScoreComparison(category: string): ScoreComparison | null {
  return SCORE_BY_CATEGORY[category] ?? null
}

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

/** 1년 = 53주 (GitHub 컨트리뷰션 그래프와 동일한 범위) */
export const HEATMAP_WEEKS = 53

/** 날짜 시드 기반 의사난수 — 같은 날짜면 항상 같은 값 (렌더 흔들림 방지) */
function seededLevel(date: Date): HeatmapDay['level'] {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  const x = Math.sin(seed) * 10000
  const r = x - Math.floor(x)
  if (r < 0.22) return 0
  if (r < 0.45) return 1
  if (r < 0.68) return 2
  if (r < 0.87) return 3
  return 4
}

/**
 * 최근 1년치 잔디 — 이번 주 토요일을 마지막 열로 하는 53주.
 * 각 열은 일~토 7칸이고, 미래 날짜는 빈 자리로 남긴다.
 */
export function buildHeatmap(today: Date): HeatmapWeek[] {
  const end = new Date(today)
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() + (6 - end.getDay())) // 이번 주 토요일

  const start = new Date(end)
  start.setDate(start.getDate() - (HEATMAP_WEEKS * 7 - 1))

  return Array.from({ length: HEATMAP_WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      const future = date.getTime() > today.getTime()
      return { date, level: future ? (0 as const) : seededLevel(date), future }
    }),
  )
}

/**
 * 열(주)마다 표시할 월 라벨 — 그 달의 첫 주에만 값이 있고 나머지는 null.
 * 첫 열은 잘린 주라 라벨을 붙이지 않는다 (라벨이 왼쪽으로 삐져나오는 것 방지).
 */
export function buildMonthLabels(weeks: HeatmapWeek[]): Array<number | null> {
  let prev = -1
  return weeks.map((week, i) => {
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

export type WeeklyMetric = 'solved' | 'accuracy' | 'minutes'

export interface WeeklyMetricConfig {
  key: WeeklyMetric
  label: string
  /** 툴팁·값 표기 단위 */
  unit: string
  /** y축 상한 — 라인 높이 계산 기준 */
  max: number
}

export const WEEKLY_METRICS: WeeklyMetricConfig[] = [
  { key: 'solved', label: '푼 문제', unit: '문제', max: 12 },
  { key: 'accuracy', label: '정답률', unit: '%', max: 100 },
  { key: 'minutes', label: '학습 시간', unit: '분', max: 60 },
]

export interface WeeklyPoint {
  /** 0=일 ~ 6=토 */
  day: number
  values: Record<WeeklyMetric, number>
}

const WEEKLY_MOCK: Record<Subject, Array<Record<WeeklyMetric, number>>> = {
  math: [
    { solved: 3, accuracy: 33, minutes: 9 },
    { solved: 5, accuracy: 60, minutes: 16 },
    { solved: 6, accuracy: 66, minutes: 18 },
    { solved: 10, accuracy: 80, minutes: 31 },
    { solved: 0, accuracy: 0, minutes: 0 },
    { solved: 0, accuracy: 0, minutes: 0 },
    { solved: 0, accuracy: 0, minutes: 0 },
  ],
  english: [
    { solved: 2, accuracy: 50, minutes: 7 },
    { solved: 4, accuracy: 50, minutes: 13 },
    { solved: 3, accuracy: 66, minutes: 11 },
    { solved: 7, accuracy: 71, minutes: 22 },
    { solved: 0, accuracy: 0, minutes: 0 },
    { solved: 0, accuracy: 0, minutes: 0 },
    { solved: 0, accuracy: 0, minutes: 0 },
  ],
}

/**
 * 이번 주(일~토) 일별 지표. 오늘 이후는 데이터 없음(null)으로 잘라
 * 라인이 오늘까지만 그려지게 한다 (시안: 수요일까지 그려진 상태).
 */
export function buildWeekly(subject: Subject, today: Date): Array<WeeklyPoint | null> {
  const source = WEEKLY_MOCK[subject]
  return source.map((values, day) => (day > today.getDay() ? null : { day, values }))
}

export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
