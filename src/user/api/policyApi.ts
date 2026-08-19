import { api } from '@/user/api/authApi'

interface BaseResponse<T> {
  successCode: string
  message: string
  data: T
}

export type PolicySlug = 'terms' | 'privacy' | 'marketing'

/** 현재 시행 중인 법적 고지문 (GET /api/policies/{slug} · permitAll) */
export interface Policy {
  slug: PolicySlug
  title: string
  version: number
  content: string // 마크다운 — raw HTML 비활성 렌더러로 표시할 것
  effectiveAt: string
}

export async function fetchPolicy(slug: PolicySlug): Promise<Policy> {
  const { data } = await api.get<BaseResponse<Policy>>(`/api/policies/${slug}`)
  return data.data
}
