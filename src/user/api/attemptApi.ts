import { api } from '@/user/api/authApi'

export type AttemptSource = 'DAILY' | 'FREE' | 'RETRY' | 'TRIAL'

export interface AttemptSubmitRequest {
  /** 서버 problems 테이블 PK (예: 2022_1_1_1-S0252) */
  problemId: string
  source: AttemptSource
  submittedNo?: number | null
  submittedText?: string | null
  timeSpentMs: number
}

export interface AttemptSubmitResponse {
  attemptId: number
  isCorrect: boolean
  answerNumber: number | null
  answerText: string | null
  explanation: string | null
}

interface BaseResponse<T> {
  successCode: string
  message: string
  data: T
}

/** 풀이 1건 제출 — 채점은 서버가 한다 (클라이언트 정답 여부는 신뢰하지 않음) */
export async function submitAttempt(req: AttemptSubmitRequest): Promise<AttemptSubmitResponse> {
  const { data } = await api.post<BaseResponse<AttemptSubmitResponse>>('/api/attempts', req)
  return data.data
}
