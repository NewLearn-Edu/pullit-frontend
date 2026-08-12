import { api } from '@/user/api/authApi'

interface BaseResponse<T> {
  successCode: string
  message: string
  data: T
}

/** 크레딧 소모 결과 — 차감 후 잔액으로 배지를 즉시 갱신한다 */
export interface CreditUseResponse {
  usedAmount: number
  creditBalance: number
}

/**
 * 크레딧으로 추가 세트 열기 (POST /api/credits/extra-set).
 * 가격은 서버가 결정한다. 잔액 부족이면 400 (CR001 CREDIT_BALANCE_INSUFFICIENT).
 */
export async function useCreditForExtraSet(): Promise<CreditUseResponse> {
  const { data } = await api.post<BaseResponse<CreditUseResponse>>('/api/credits/extra-set')
  return data.data
}
