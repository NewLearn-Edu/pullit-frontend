import { api } from '@/user/api/authApi'
import type { TrialProblemSetItem } from '@/user/api/problemApi'

interface BaseResponse<T> {
  successCode: string
  message: string
  data: T
}

/**
 * 세트 발급 (POST /api/problem-sets · 2026-08-30 설계) — 문제풀기·진단하기의 진입 API.
 *
 * 발급 = 크레딧 차감 + 문항 구성 + 박제가 서버에서 한 트랜잭션.
 * 유저·유닛·소스당 ACTIVE 세트는 1개 — 재요청하면 그대로 반환된다
 * (resumed=true · 크레딧 재차감 없음). 이게 이어풀기의 전부다.
 *
 * 진단(TRIAL)은 trial_problems 고정 세트, 자유(FREE)·추천(DAILY)은
 * 난이도 사다리(L1~L4) 구성으로 서버가 뽑는다.
 */
export interface IssuedProblemItem extends TrialProblemSetItem {
  /** 세트 내 순서 1~3 */
  sequence: number
  /** 이 세트에서 이미 제출한 문항 — 이어풀기 복원의 근거 */
  submitted: boolean
  /** 제출했을 때의 채점 결과 (미제출이면 null) */
  correct: boolean | null
}

export interface IssuedProblemSet {
  setId: number
  source: 'TRIAL' | 'FREE' | 'DAILY'
  /** 발급 시점 난이도 레벨 스냅샷 (수학 FREE·DAILY 만, 그 외 null) */
  level: number | null
  status: 'ACTIVE' | 'DONE'
  /** true = 새 발급이 아니라 진행 중이던 세트 (크레딧 미차감) */
  resumed: boolean
  items: IssuedProblemItem[]
}

export async function issueProblemSet(
  subject: 'math' | 'english',
  unitCode: string,
  source: 'TRIAL' | 'FREE' | 'DAILY',
): Promise<IssuedProblemSet> {
  const { data } = await api.post<BaseResponse<IssuedProblemSet>>('/api/problem-sets', {
    subject: subject.toUpperCase(),
    unitCode,
    source,
  })
  return data.data
}

/** 진행 중 세트 조회 — 시작 시트의 "이어풀기" 표시 판단용. 없으면 null (차감 없음) */
export async function fetchActiveProblemSet(
  subject: 'math' | 'english',
  unitCode: string,
  source: 'TRIAL' | 'FREE' | 'DAILY',
): Promise<IssuedProblemSet | null> {
  const { data } = await api.get<BaseResponse<IssuedProblemSet | null>>(
    '/api/problem-sets/active',
    { params: { subject: subject.toUpperCase(), unitCode, source } },
  )
  return data.data
}

/**
 * 앱 진입 이어풀기 팝업(PI-POPUP-RESUME · Figma 2931-11007)용 —
 * 가장 최근에 풀다 만 세트 요약. 없으면 null.
 */
export interface ResumableSet {
  setId: number
  subject: 'MATH' | 'ENGLISH'
  unitCode: string
  unitLarge: string
  skillNode: string
  source: 'TRIAL' | 'FREE' | 'DAILY'
  submittedCount: number
  totalCount: number
}

export async function fetchResumableSet(): Promise<ResumableSet | null> {
  const { data } = await api.get<BaseResponse<ResumableSet | null>>('/api/problem-sets/resumable')
  return data.data
}
