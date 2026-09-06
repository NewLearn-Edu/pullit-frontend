import type { ReactNode } from 'react'
import { TimerBadge } from '@/user/components/quiz/TimerBadge'
import styles from './ProblemCardHeader.module.scss'

/** 90초 → "1분 30초" · 120초 → "2분" (TrialQuizPage.formatKoreanDuration 과 같은 규칙) */
function formatKoreanDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m === 0) return `${s}초`
  return s > 0 ? `${m}분 ${s}초` : `${m}분`
}

/**
 * 어드민 문제 미리보기 카드 헤더 — 학생 문제풀이 카드 상단("문제 N · 권장 1분 30초 · ● 0:00")과
 * 같은 조판. 타이머는 흐르지 않고 0:00 고정(ok 단계 초록 점).
 * 제한시간은 권장 ×3 — 문제 생성 정책 §2 recommended_time_sec 규칙과 동일.
 */
export function ProblemCardHeader({ no, recSec }: { no: number; recSec: number | null | undefined }) {
  const rec = recSec ?? 0
  return (
    <div className={styles.header}>
      <div className={styles.titleWrap}>
        <h2 className={styles.title}>문제 {no}</h2>
      </div>
      <div className={styles.meta}>
        {rec > 0 && <div className={styles.time}>권장 {formatKoreanDuration(rec)}</div>}
        <TimerBadge elapsedSec={0} tRecSec={rec} tMaxSec={rec * 3} variant="onLight" />
      </div>
    </div>
  )
}

/** 카드 본문 래퍼 — 학생 카드의 bodyWrap 과 같은 안쪽 여백 */
export function ProblemCardBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>
}
