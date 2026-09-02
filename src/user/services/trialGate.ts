import { fetchTrialDiagnoses, type TrialDiagnosis } from '@/user/api/attemptApi'

/**
 * 맛보기 게이트 — "이 유저가 맛보기 테스트를 끝냈는가" 판정 (2026-08-18 확정 규칙).
 *
 * 맛보기 = 고정 영역 세트 완주: 수학 지수와 로그(math_2022_1_1_1) 또는 영어 주제(english_2015_1_0_1).
 * 둘 중 하나라도 trial_diagnoses 에 박제돼 있으면 완료 — 완료 유저는 /trial 퍼널 대신 홈,
 * 미완 유저는 회원가입 직후라도 /start → /trial → /quiz 퍼널로 보낸다.
 * 그룹 코드 = unit_code (문제 생성 정책 §4) — problemSet TRIAL_GROUPS 와 동일 값.
 */
const TRIAL_FIXED_GROUPS = {
  math: 'math_2022_1_1_1', // 지수와 로그 (대수 첫 소단원)
  english: 'english_2015_1_0_1', // 주제
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

/**
 * 완주 확정 캐시 — 한 번 "완료"로 판정된 유저(id)는 이 탭이 살아 있는 동안 재조회하지 않는다.
 * 완주는 되돌아가지 않으므로 긍정 결과만 캐시한다 (미완은 퍼널을 끝내면 바뀌니 매번 조회).
 * 메모리 전용 — localStorage 에 두면 서버 진실원과 어긋난 채 남을 수 있다.
 */
const completedUserIds = new Set<number>()

export const isTrialCompletedCached = (userId: number) => completedUserIds.has(userId)
export const markTrialCompleted = (userId: number) => {
  completedUserIds.add(userId)
}
