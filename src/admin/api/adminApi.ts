import axios from 'axios'

/** 백엔드 API 클라이언트 — VITE_API_BASE_URL 미설정 시 로컬 백엔드 기본값 */
export const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
})

// TODO: 어드민 로그인 연동 시 JWT Authorization 헤더 인터셉터 추가
// (백엔드 /api/admin/** 은 ROLE_ADMIN 토큰 필요)

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
