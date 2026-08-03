import axios from 'axios'
import { getAccessToken } from '@/user/api/authApi'

/** 백엔드 API 클라이언트 — VITE_API_BASE_URL 미설정 시 로컬 백엔드 기본값 */
export const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
})

// 로그인되어 있으면 JWT 를 자동 첨부 (배포 환경 /api/admin/** 은 ROLE_ADMIN 토큰 필수.
// 로컬은 ADMIN_OPEN=true 로 토큰 없이도 허용)
adminApi.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

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
