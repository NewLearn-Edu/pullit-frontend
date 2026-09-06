import { type Subject } from '@/user/stores/trialStore'

/**
 * 홈 주소 만들기 (2026-09-06) — 홈은 과목·대단원을 쿼리로 들고 있다(?subject=&cat=).
 * 추천 화면에서 X 로 나올 때 이 값을 잃으면 항상 수학 첫 대단원으로 떨어졌다.
 * 기본값(수학·첫 대단원)은 홈과 같은 규칙으로 생략한다.
 */
export function homePath(subject?: Subject | null, cat?: string | null): string {
  const params = new URLSearchParams()
  if (subject === 'english') params.set('subject', subject)
  if (cat) params.set('cat', cat)
  const query = params.toString()
  return query ? `/home?${query}` : '/home'
}
