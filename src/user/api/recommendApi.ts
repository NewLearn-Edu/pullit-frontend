import { api } from '@/user/api/authApi'

interface BaseResponse<T> {
  successCode: string
  message: string
  data: T
}

/**
 * 맞춤 추천 (GET /api/recommendations) — 지금 이 유저가 풀어야 할 3문제 세트.
 * DIAGNOSIS = 미진단 소단원 진단 · REVIEW = 최저점 소단원 보완 · NONE = 추천 불가
 */
export interface Recommendation {
  type: 'DIAGNOSIS' | 'REVIEW' | 'NONE'
  unitCode: string | null
  unitLarge: string | null
  skillNode: string | null
  /** REVIEW 일 때 해당 소단원 진단 점수 */
  score: number | null
  /** 노출용 이유 문구 — 시작 시트에 그대로 보여준다 */
  reason: string
}

export async function fetchRecommendation(
  subject: 'math' | 'english',
): Promise<Recommendation> {
  const { data } = await api.get<BaseResponse<Recommendation>>('/api/recommendations', {
    params: { subject: subject.toUpperCase() },
  })
  return data.data
}

/**
 * "이 단원 안배웠어요" 잠금 (unit_locks) — 해당 소단원부터 대단원 끝까지 추천 제외.
 * 해제는 잠금 시작 소단원을 다시 진단해 박제될 때 서버가 자동 처리.
 */
export interface UnitLock {
  categoryCode: string
  unitLarge: string
  offFromUnitCode: string
  offFromSkillNode: string
}

export async function fetchUnitLocks(subject: 'math' | 'english'): Promise<UnitLock[]> {
  const { data } = await api.get<BaseResponse<UnitLock[]>>('/api/unit-locks', {
    params: { subject: subject.toUpperCase() },
  })
  return data.data
}

export async function declareUnitLock(
  subject: 'math' | 'english',
  unitCode: string,
): Promise<UnitLock> {
  const { data } = await api.post<BaseResponse<UnitLock>>('/api/unit-locks', {
    subject: subject.toUpperCase(),
    unitCode,
  })
  return data.data
}
