import { fetchTrialDiagnoses, type TrialDiagnosis } from '@/user/api/attemptApi'

/**
 * 맛보기 게이트 — "이 유저가 맛보기 테스트를 끝냈는가" 판정 (2026-08-18 확정 규칙).
 *
 * 맛보기 = 고정 영역 세트 완주: 수학 지수와 로그(2022_1_1_1) 또는 영어 주제(01_topic).
 * 둘 중 하나라도 trial_diagnoses 에 박제돼 있으면 완료 — 완료 유저는 /trial 퍼널 대신 홈,
 * 미완 유저는 회원가입 직후라도 /start → /trial → /quiz 퍼널로 보낸다.
 */
const TRIAL_FIXED_GROUPS = {
  math: '2022_1_1_1', // 지수와 로그 (대수 첫 소단원)
  english: '01_topic', // 주제 — problemSet TRIAL_GROUPS 와 동일 값
} as const

const completedIn = (rows: TrialDiagnosis[] | null, groupCode: string) =>
  (rows ?? []).some((row) => row.groupCode === groupCode)

/**
 * 맛보기 완료 여부. 두 과목 조회가 모두 실패하면 throw —
 * 호출부가 "판정 불가" 를 상황에 맞게 처리한다 (로그인 후처리 = 홈, 퍼널 가드 = 통과).
 */
export async function hasCompletedTrial(): Promise<boolean> {
  const [math, english] = await Promise.all([
    fetchTrialDiagnoses('math').catch(() => null),
    fetchTrialDiagnoses('english').catch(() => null),
  ])
  if (math === null && english === null) {
    throw new Error('trial diagnoses unavailable')
  }
  return (
    completedIn(math, TRIAL_FIXED_GROUPS.math) ||
    completedIn(english, TRIAL_FIXED_GROUPS.english)
  )
}
