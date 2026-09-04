import type { Subject } from '@/user/stores/trialStore'

/**
 * 진단 결과 화면 경로 (2026-09-04).
 *
 * 같은 화면(WeaknessResultPage)이 두 주소로 열린다.
 * - 온보딩 퍼널(/start → /trial → /trial/quiz/{subject}/{n})에서 끝난 진단: /trial/{subject}/weakness —
 *   퍼널 URL 이 과목까지 일관되게 읽힌다
 * - 홈·지도의 소단원 시트에서 시작한 진단(pendingUnit 있음): /weakness — 퍼널이 아니므로 그대로
 * 퍼널 판정 기준은 TrialQuizPage 와 같다: mode='trial' 이면서 pendingUnit 이 없을 때.
 */
export function isTrialSubject(value: string | null | undefined): value is Subject {
  return value === 'math' || value === 'english'
}

export function weaknessResultPath(subject: Subject | null | undefined, funnel: boolean): string {
  if (!funnel) return '/weakness'
  return `/trial/${isTrialSubject(subject) ? subject : 'math'}/weakness`
}
