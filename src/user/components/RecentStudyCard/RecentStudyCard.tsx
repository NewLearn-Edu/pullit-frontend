import type { UnitSetHistory } from '@/user/api/problemSetApi'

export interface RecentStudyCardProps {
  /** "오늘"/"어제"/"8월 23일" */
  dateLabel: string
  /** "13:24" — 없으면 생략 */
  time?: string | null
  /** 0~100 */
  score: number
  items: { points: number; correct: boolean; overTime: boolean }[]
  /** 문항별 기록이 없는 구버전 진단분 안내 */
  emptyNote?: string
}

/**
 * 최근 학습 카드 (Figma 3808-8052) — 날짜·시각·점수 헤더 + 문항별 ○△✕ 띠.
 * 홈 단원 상세 시트(최근 3개)와 전체보기 페이지(/unit-history)가 같은 카드를 쓴다.
 */
export function RecentStudyCard({ dateLabel, time, score, items, emptyNote }: RecentStudyCardProps) {
  return (
    <div className="w-full overflow-hidden rounded-[16px] border border-[#e5e7ea] text-left">
      <div className="flex w-full items-center justify-between px-[16px] pb-[12px] pt-[16px]">
        <span className="flex items-center gap-[4px] leading-[1.4]">
          <span className="text-[16px] font-semibold text-[#121417]">{dateLabel}</span>
          {time && <span className="text-[14px] font-medium text-[#80858b]">{time}</span>}
        </span>
        <span className="text-[20px] font-semibold leading-[1.4] text-[#121417]">{score}점</span>
      </div>
      {items.length > 0 ? (
        <div className="flex w-full items-center border-t border-[#e5e7ea] bg-[#f8f8f8] p-[12px]">
          {items.map((item, i) => (
            <span key={i} className="flex min-w-0 flex-1 items-center">
              {i > 0 && <span className="h-[32px] w-px shrink-0 bg-[#e5e7ea]" aria-hidden />}
              <span className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[8px]">
                <span className="whitespace-nowrap text-[12px] font-semibold text-[#80858b]">
                  {i + 1}번({formatPoints(item.points)}점)
                </span>
                <StudyMark kind={item.correct ? (item.overTime ? 'triangle' : 'circle') : 'x'} />
              </span>
            </span>
          ))}
        </div>
      ) : (
        <div className="border-t border-[#e5e7ea] bg-[#f8f8f8] p-[12px] text-center text-[12px] text-[#a6abb1]">
          {emptyNote ?? '문항별 기록이 없어 요약만 볼 수 있어'}
        </div>
      )}
    </div>
  )
}

/** 배점 표기 — 정수는 그대로, 소수 배점(1.5)은 소수 한 자리 */
function formatPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1)
}

/** 서버 학습 이력 한 건 → 카드 props. 세모(△) = 정답이지만 권장 시간 초과 */
export function historyToCard(h: UnitSetHistory): RecentStudyCardProps {
  const [date, clock] = h.completedAt.split('T')
  return {
    dateLabel: formatStudyDate(date ?? ''),
    time: clock ? clock.slice(0, 5) : null,
    score: h.score,
    items: h.items.map((it) => ({
      points: it.points,
      correct: it.correct,
      overTime:
        it.correct &&
        it.recommendedTimeSec != null &&
        it.recommendedTimeSec > 0 &&
        it.timeSpentMs != null &&
        it.timeSpentMs > it.recommendedTimeSec * 1000,
    })),
  }
}

/** "YYYY-MM-DD" → "오늘"/"어제"/"8월 23일" (Figma 3361-5402) */
export function formatStudyDate(date: string): string {
  const [y, m, d] = date.split('-')
  if (!y || !m || !d) return date
  const target = new Date(Number(y), Number(m) - 1, Number(d))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '어제'
  return `${Number(m)}월 ${Number(d)}일`
}

/** 문항 마크 — O(정답) · △(정답이지만 시간 초과) · X(오답), 시안 16px */
function StudyMark({ kind }: { kind: 'circle' | 'triangle' | 'x' }) {
  const label = kind === 'circle' ? '정답' : kind === 'triangle' ? '정답 (시간 초과)' : '오답'
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" role="img" aria-label={label}>
      {kind === 'circle' && <circle cx="8" cy="8" r="6" stroke="#ff385c" strokeWidth="2" />}
      {kind === 'triangle' && (
        <path d="M8 3 14 13H2z" stroke="#ff385c" strokeWidth="2" strokeLinejoin="round" />
      )}
      {kind === 'x' && (
        <path d="m3.5 3.5 9 9M12.5 3.5l-9 9" stroke="#ff385c" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  )
}
