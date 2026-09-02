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

export type CreditTransactionType = 'USE' | 'REWARD' | 'ADMIN_GRANT' | 'ADMIN_DEDUCT'
export type CreditRewardType = 'TRIAL_FIRST_CLEAR' | 'SIGNUP_WELCOME' | 'INVITE_FRIEND_COMPLETE'

export interface CreditTransaction {
  id: number
  type: CreditTransactionType
  /** REWARD 의 세부 종류 (그 외 null) */
  rewardType: CreditRewardType | null
  /** 증감량 — 사용·차감은 음수 */
  amount: number
  balanceAfter: number
  reason: string
  createdAt: string
}

/** 내 크레딧 내역 — 최신순 최근 200건 (마이페이지 · 학습 관리 · 크레딧 내역) */
export async function fetchCreditTransactions(): Promise<CreditTransaction[]> {
  const { data } = await api.get<BaseResponse<CreditTransaction[]>>('/api/credits/transactions')
  return data.data
}
