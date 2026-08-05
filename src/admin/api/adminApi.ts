import axios, { type InternalAxiosRequestConfig } from 'axios'
import { refreshSession } from '@/user/api/authApi'

/** 백엔드 API 클라이언트 — 로컬은 localhost:8080, 배포는 백엔드 도메인(api-dev) */
export const adminApi = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ??
    (window.location.hostname === 'localhost'
      ? 'http://localhost:8080'
      : 'https://api-dev.pullit.co.kr'),
  // 인증은 httpOnly 쿠키 자동 전송 (배포 환경 /api/admin/** 은 ROLE_ADMIN 필수.
  // 로컬은 ADMIN_OPEN=true 로 쿠키 없이도 허용)
  withCredentials: true,
})

// access 쿠키 만료로 401 이면 refresh 쿠키로 재발급 후 원요청 1회 재시도
adminApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error?.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    if (axios.isAxiosError(error) && error.response?.status === 401 && original && !original._retry) {
      original._retry = true
      try {
        await refreshSession()
        return adminApi(original)
      } catch {
        /* refresh 도 만료 — 어드민 가드(fetchMe)가 /login 으로 보낸다 */
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

export type UserRole = 'USER' | 'PAID_USER' | 'ADMIN'

export interface AdminUser {
  id: number
  name: string | null
  nickname: string | null
  email: string | null
  role: UserRole
  createdAt: string
}

/** 회원 목록 — role 지정 시 해당 권한만 (예: 'ADMIN'), 미지정 시 전체 */
export async function fetchAdminUsers(role?: UserRole): Promise<AdminUser[]> {
  const { data } = await adminApi.get<BaseResponse<AdminUser[]>>('/api/admin/users', {
    params: role ? { role } : undefined,
  })
  return data.data
}

/** 회원 권한 변경 */
export async function updateUserRole(userId: number, role: UserRole): Promise<AdminUser> {
  const { data } = await adminApi.patch<BaseResponse<AdminUser>>(
    `/api/admin/users/${userId}/role`,
    { role },
  )
  return data.data
}

// ---------------------------------------------------------------------------
// 대시보드
// ---------------------------------------------------------------------------

export interface DashboardStats {
  totalUsers: number
  todayUsers: number
  totalProblems: number
  /** attempts 미구현 — 백엔드가 0 고정 반환 (풀이기록 도메인 구축 시 실데이터) */
  todaySolved: number
}

/** 대시보드 상단 KPI 통계 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await adminApi.get<BaseResponse<DashboardStats>>(
    '/api/admin/dashboard/stats',
  )
  return data.data
}
