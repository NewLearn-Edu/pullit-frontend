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
}

/** 4주(28일) 블록 — 시안은 3블록을 가로로 나열, 각 블록 위에 월 라벨 */
export interface HeatmapBlock {
  /** 블록 대표 월 (1~12) */
  month: number
  /** 4행 × 7열 — 행 = 주, 열 = 일~토 */
  weeks: HeatmapDay[][]
}

const BLOCK_COUNT = 3
const WEEKS_PER_BLOCK = 4

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
 * 오늘이 속한 주의 토요일을 끝으로 하는 12주치 히트맵.
 * 미래 날짜는 level 0 으로 비워 둔다.
 */
export function buildHeatmap(today: Date): HeatmapBlock[] {
  const end = new Date(today)
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() + (6 - end.getDay())) // 이번 주 토요일

  const totalDays = BLOCK_COUNT * WEEKS_PER_BLOCK * 7
  const start = new Date(end)
  start.setDate(start.getDate() - (totalDays - 1))

  const days: HeatmapDay[] = Array.from({ length: totalDays }, (_, i) => {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const future = date.getTime() > today.getTime()
    return { date, level: future ? 0 : seededLevel(date) }
  })

  return Array.from({ length: BLOCK_COUNT }, (_, b) => {
    const blockDays = days.slice(b * WEEKS_PER_BLOCK * 7, (b + 1) * WEEKS_PER_BLOCK * 7)
    const weeks = Array.from({ length: WEEKS_PER_BLOCK }, (_, w) =>
      blockDays.slice(w * 7, w * 7 + 7),
    )
    // 블록 대표 월 = 가운데 날짜 기준 (블록이 두 달에 걸쳐도 하나로 표기)
    const mid = blockDays[Math.floor(blockDays.length / 2)]
    return { month: mid.date.getMonth() + 1, weeks }
  })
}

/** 오늘까지 이어진 연속 학습일 (level > 0 인 날이 끊기지 않은 길이) */
export function countStreak(blocks: HeatmapBlock[], today: Date): number {
  const flat = blocks
    .flatMap((b) => b.weeks.flat())
    .filter((d) => d.date.getTime() <= today.getTime())
  let streak = 0
  for (let i = flat.length - 1; i >= 0; i--) {
    if (flat[i].level === 0) break
    streak++
  }
  return streak
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
