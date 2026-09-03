import { api } from '@/user/api/authApi'

interface BaseResponse<T> {
  successCode: string
  message: string
  data: T
}

/** 랜딩 공개 지표 (GET /api/stats/landing · permitAll) */
export interface LandingStats {
  /** 노출(ACTIVE) 문항 수 — 히어로 소셜프루프 수치 */
  problemCount: number
}

export async function fetchLandingStats(): Promise<LandingStats> {
  const { data } = await api.get<BaseResponse<LandingStats>>('/api/stats/landing')
  return data.data
}
