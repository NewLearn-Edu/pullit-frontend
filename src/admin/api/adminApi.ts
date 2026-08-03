import axios, { type InternalAxiosRequestConfig } from 'axios'
import { clearTokens, getRefreshToken, getValidAccessToken, refreshTokens } from '@/user/api/authApi'

/** 백엔드 API 클라이언트 — VITE_API_BASE_URL 미설정 시 로컬 백엔드 기본값 */
export const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
})

// 로그인되어 있으면 JWT 를 자동 첨부 (배포 환경 /api/admin/** 은 ROLE_ADMIN 토큰 필수.
// 로컬은 ADMIN_OPEN=true 로 토큰 없이도 허용).
// 만료 토큰은 보내지 않고 선제 갱신 — 만료 상태로 서버에 닿는 일 자체를 없앤다
adminApi.interceptors.request.use(async (config) => {
  const token = await getValidAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 안전망: 그래도 401 이면 리프레시 후 원요청 1회 재시도
adminApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error?.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      getRefreshToken()
    ) {
      original._retry = true
      try {
        const { accessToken } = await refreshTokens()
        original.headers.Authorization = `Bearer ${accessToken}`
        return adminApi(original)
      } catch {
        clearTokens()
      }
    }
    return Promise.reject(error)
  },
)

export interface ImportLineError {
  line: number
  problemId: string | null
  reason: string
}

export interface ProblemImportResult {
  fileName: string
  total: number
  inserted: number
  updated: number
  inactiveCount: number
  failed: number
  errors: ImportLineError[]
}

interface BaseResponse<T> {
  successCode: string
  message: string
  data: T
}

/** jsonl/json 문제 파일 1개를 업로드해 problems 테이블에 적재 */
export async function importProblemFile(file: File): Promise<ProblemImportResult> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await adminApi.post<BaseResponse<ProblemImportResult>>(
    '/api/admin/problems/import',
    form,
  )
  return data.data
}

// ---------------------------------------------------------------------------
// 문제 목록 · 상세 · 분류 필터
// ---------------------------------------------------------------------------

export type ApiSubject = 'MATH' | 'ENGLISH'
export type ProblemStatus = 'ACTIVE' | 'INACTIVE'
export type Difficulty = 'BASIC' | 'NORMAL' | 'ADVANCED'

export interface ProblemListItem {
  id: string
  unitLarge: string | null
  unitMid: string | null
  skillNode: string
  points: number
  renderCode: string
  difficulty: Difficulty | null
  status: ProblemStatus
  createdAt: string
}

export interface ProblemPage {
  content: ProblemListItem[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

/** 분류 캐스케이드 트리 — 수학 3단(대·중·소분류) · 영어 2단(영역·유형) */
export interface FilterNode {
  name: string
  count: number
  children: FilterNode[]
}

export interface ProblemDetail {
  id: string
  subject: ApiSubject
  unitLarge: string | null
  unitMid: string | null
  skillNode: string
  points: number
  renderCode: string
  question: string
  passage: string | null
  choices: string[]
  answerNumber: number
  answerText: string
  explanation: string
  difficulty: Difficulty | null
  status: ProblemStatus
  /** 지문 하단 단어 주석 (예: { mandate: "명령" }) — 수능 "* 단어: 뜻" 렌더링용 */
  glossary: Record<string, string>
}

export interface ProblemListParams {
  subject: ApiSubject
  unitLarge?: string
  unitMid?: string
  skillNode?: string
  status?: ProblemStatus
  difficulty?: Difficulty
  q?: string
  page?: number
  size?: number
}

export async function fetchProblems(params: ProblemListParams): Promise<ProblemPage> {
  const { data } = await adminApi.get<BaseResponse<ProblemPage>>('/api/admin/problems', { params })
  return data.data
}

export async function fetchProblemFilters(subject: ApiSubject): Promise<FilterNode[]> {
  const { data } = await adminApi.get<BaseResponse<FilterNode[]>>('/api/admin/problems/filters', {
    params: { subject },
  })
  return data.data
}

export async function fetchProblemDetail(id: string): Promise<ProblemDetail> {
  const { data } = await adminApi.get<BaseResponse<ProblemDetail>>(
    `/api/admin/problems/${encodeURIComponent(id)}`,
  )
  return data.data
}

// ---------------------------------------------------------------------------
// 관리자 계정
// ---------------------------------------------------------------------------

export interface AdminUser {
  id: number
  name: string | null
  nickname: string | null
  email: string | null
  role: 'USER' | 'ADMIN'
  createdAt: string
}

/** 관리자(ADMIN) 계정 목록 — users 테이블 실데이터 */
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data } = await adminApi.get<BaseResponse<AdminUser[]>>('/api/admin/users')
  return data.data
}
