import axios, { type InternalAxiosRequestConfig } from 'axios'
import { refreshSession } from '@/user/api/authApi'

// 로컬 개발은 접속한 호스트의 8080 (localhost 또는 같은 와이파이의 맥 IP), 배포는 백엔드 도메인(api-dev)
// — 사설 IP(172.16.x 등)로 접속해도 로컬 백엔드를 바라보도록 authApi 와 동일한 판정을 쓴다
const isLocalHost = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(
  window.location.hostname,
)

/** 백엔드 API 클라이언트 — 로컬은 접속 호스트:8080, 배포는 백엔드 도메인(api-dev) */
export const adminApi = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ??
    (isLocalHost ? `http://${window.location.hostname}:8080` : 'https://api-dev.pullit.co.kr'),
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

/** 이미 DB에 존재해 건너뛴 문제 — 목록에서 개별/전체 덮어쓰기를 선택한다 */
export interface DuplicateProblem {
  id: string
  skillNode: string
  unitLarge: string | null
  unitMid: string | null
  /** 이 문제를 푼 총 풀이 수(연인원) — 많을수록 덮어쓰기 주의 */
  attemptCount: number
  /** 들어온 파일의 정답이 기존과 다름 — 풀이 기록과 모순 위험 */
  answerChanged: boolean
}

export interface ProblemImportResult {
  fileName: string
  total: number
  inserted: number
  updated: number
  inactiveCount: number
  failed: number
  errors: ImportLineError[]
  /** 저장하지 않고 건너뛴 중복 문제 목록 */
  duplicates: DuplicateProblem[]
}

export interface ProblemOverwriteResult {
  total: number
  updated: number
  failed: number
  errors: ImportLineError[]
}

interface BaseResponse<T> {
  successCode: string
  message: string
  data: T
}

/** jsonl/json 문제 파일 1개를 업로드해 problems 테이블에 적재 (기존 id 는 건너뛰고 duplicates 로 보고) */
export async function importProblemFile(file: File): Promise<ProblemImportResult> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await adminApi.post<BaseResponse<ProblemImportResult>>(
    '/api/admin/problems/import',
    form,
  )
  return data.data
}

/** 중복 목록에서 선택한 문제 덮어쓰기 — rows 는 업로드 파일 라인과 같은 스키마의 원본 행 */
export async function overwriteProblems(rows: unknown[]): Promise<ProblemOverwriteResult> {
  const { data } = await adminApi.post<BaseResponse<ProblemOverwriteResult>>(
    '/api/admin/problems/overwrite',
    rows,
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
  /** 총 풀이 수 (연인원 — 재풀이 포함) */
  attemptCount: number
  /** 푼 유저 수 (순인원 — 유저당 1회) */
  solverCount: number
  /** 첫 시도 정답률 % (0~100) — 풀이 기록 없으면 null */
  correctRate: number | null
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

export interface ProblemSubjectStat {
  subject: ApiSubject
  count: number
  inactiveCount: number
}

export interface ProblemStats {
  totalCount: number
  inactiveCount: number
  subjects: ProblemSubjectStat[]
}

/** 전체 문제 현황 KPI — 과목별 전체/비공개 문제 수 */
export async function fetchProblemStats(): Promise<ProblemStats> {
  const { data } = await adminApi.get<BaseResponse<ProblemStats>>('/api/admin/problems/stats')
  return data.data
}

export async function fetchProblemDetail(id: string): Promise<ProblemDetail> {
  const { data } = await adminApi.get<BaseResponse<ProblemDetail>>(
    `/api/admin/problems/${encodeURIComponent(id)}`,
  )
  return data.data
}

// ---------------------------------------------------------------------------
// 맛보기 테스트 (trial test)
// ---------------------------------------------------------------------------

export interface TrialTestSetSummary {
  setNo: number
  count: number
  /** 세트 안에 비노출(INACTIVE) 문항 수 — 도표·무관한 문장 등 미확정 유형 */
  inactiveCount: number
}

/** 맛보기 그룹 = 원본 파일명 단위 (수학: 2022_1_1_1 · 영어: r12_blank 등) */
export interface TrialTestGroup {
  groupCode: string
  unitLarge: string | null
  unitMid: string | null
  skillNode: string
  totalCount: number
  sets: TrialTestSetSummary[]
}

export interface TrialTestItem {
  sequence: number
  problem: ProblemListItem
}

export interface TrialTestImportResult {
  subject: ApiSubject
  groupCode: string
  setNo: number
  mappedCount: number
  importResult: ProblemImportResult
}

/** 맛보기 세트 파일 1개 업로드 — 문항 업서트 + 파일명 기반 세트 매핑 등록 */
export async function importTrialTestFile(file: File): Promise<TrialTestImportResult> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await adminApi.post<BaseResponse<TrialTestImportResult>>(
    '/api/admin/trial-tests/import',
    form,
  )
  return data.data
}

export async function fetchTrialTestGroups(subject: ApiSubject): Promise<TrialTestGroup[]> {
  const { data } = await adminApi.get<BaseResponse<TrialTestGroup[]>>('/api/admin/trial-tests', {
    params: { subject },
  })
  return data.data
}

export async function fetchTrialTestItems(
  subject: ApiSubject,
  groupCode: string,
  setNo: number,
): Promise<TrialTestItem[]> {
  const { data } = await adminApi.get<BaseResponse<TrialTestItem[]>>('/api/admin/trial-tests/items', {
    params: { subject, groupCode, setNo },
  })
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
  phoneNumber: string | null
  creditBalance: number | null
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
// 크레딧
// ---------------------------------------------------------------------------

export type CreditTransactionType = 'GRANT' | 'DEDUCT'

export interface CreditStats {
  totalBalance: number
  holderCount: number
  totalUsers: number
}

export interface CreditUser {
  userId: number
  name: string | null
  nickname: string | null
  email: string | null
  phoneNumber: string | null
  creditBalance: number
  createdAt: string
}

export interface CreditTransaction {
  id: number
  userId: number
  userName: string | null
  type: CreditTransactionType
  amount: number
  balanceAfter: number
  reason: string
  actorName: string | null
  createdAt: string
}

interface Paged<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type CreditUserPage = Paged<CreditUser>
export type CreditTransactionPage = Paged<CreditTransaction>

export async function fetchCreditStats(): Promise<CreditStats> {
  const { data } = await adminApi.get<BaseResponse<CreditStats>>('/api/admin/credits/stats')
  return data.data
}

/** 회원별 크레딧 잔액 — q 는 이름·닉네임·이메일·전화번호 부분 일치 */
export async function fetchCreditUsers(params: {
  q?: string
  page?: number
  size?: number
}): Promise<CreditUserPage> {
  const { data } = await adminApi.get<BaseResponse<CreditUserPage>>('/api/admin/credits/users', {
    params,
  })
  return data.data
}

/** 크레딧 증감 이력 — userId 지정 시 해당 회원 것만 */
export async function fetchCreditTransactions(params: {
  userId?: number
  page?: number
  size?: number
}): Promise<CreditTransactionPage> {
  const { data } = await adminApi.get<BaseResponse<CreditTransactionPage>>(
    '/api/admin/credits/transactions',
    { params },
  )
  return data.data
}

/** 크레딧 수동 지급·차감 — amount 는 항상 양수, 방향은 type 이 갖는다 */
export async function adjustCredit(
  userId: number,
  body: { type: CreditTransactionType; amount: number; reason: string },
): Promise<CreditTransaction> {
  const { data } = await adminApi.post<BaseResponse<CreditTransaction>>(
    `/api/admin/credits/users/${userId}`,
    body,
  )
  return data.data
}

// ---------------------------------------------------------------------------
// 대시보드
// ---------------------------------------------------------------------------

/** 일별 학습 활동 (풀이 수 · 학습 유저 수) — 추이 차트용, 빈 날짜는 백엔드가 0 으로 채움 */
export interface DailyActivity {
  /** YYYY-MM-DD */
  date: string
  solved: number
  learners: number
}

export interface DashboardStats {
  todaySolved: number
  yesterdaySolved: number
  todayLearners: number
  yesterdayLearners: number
  /** 탈퇴 유예(DELETED) 제외 회원 수 */
  totalMembers: number
  totalGuests: number
  /** registeredAt 기준 — 게스트 생성이 아닌 진짜 가입 */
  todaySignups: number
  totalProblems: number
  /** 맛보기 응시자(TRIAL 시도 유저) — 완주율 분모 */
  trialStarters: number
  /** 맛보기 1세트 이상 완주 유저 — 완주율 분자 */
  trialCompleters: number
  todayCreditsSpent: number
  /** 최근 30일, 오래된 날짜부터 */
  trend: DailyActivity[]
}

/** 대시보드 상단 KPI 통계 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await adminApi.get<BaseResponse<DashboardStats>>(
    '/api/admin/dashboard/stats',
  )
  return data.data
}

/** UTM 캠페인별 유입 현황 1행 (visit_events 집계 · 최근 방문 순) */
export interface VisitCampaignStats {
  utmSource: string
  utmMedium: string | null
  utmCampaign: string | null
  total: number
  today: number
  lastVisitAt: string
}

export async function fetchVisitStats(): Promise<VisitCampaignStats[]> {
  const { data } = await adminApi.get<BaseResponse<VisitCampaignStats[]>>(
    '/api/admin/metrics/visits',
  )
  return data.data
}

// ---------------------------------------------------------------------------
// 정책 (법적 고지문) 관리
// ---------------------------------------------------------------------------

export type PolicySlug = 'terms' | 'privacy' | 'marketing'

/** 문서 종류별 현재 상태 요약 — 게시본이 없으면 버전 필드 null */
export interface PolicySummary {
  slug: PolicySlug
  displayName: string
  currentVersion: number | null
  currentTitle: string | null
  effectiveAt: string | null
  totalVersions: number
}

/** 버전 이력 행 (본문 포함 — 에디터 프리필·이전 버전 열람용) */
export interface PolicyVersion {
  id: number
  slug: PolicySlug
  version: number
  title: string
  content: string
  effectiveAt: string
  createdAt: string
}

export async function fetchAdminPolicies(): Promise<PolicySummary[]> {
  const { data } = await adminApi.get<BaseResponse<PolicySummary[]>>('/api/admin/policies')
  return data.data
}

export async function fetchAdminPolicyVersions(slug: PolicySlug): Promise<PolicyVersion[]> {
  const { data } = await adminApi.get<BaseResponse<PolicyVersion[]>>(
    `/api/admin/policies/${slug}/versions`,
  )
  return data.data
}

/** 개정 게시 — 항상 새 버전 추가. effectiveAt null 이면 즉시 시행 */
export async function publishAdminPolicy(
  slug: PolicySlug,
  body: { title: string; content: string; effectiveAt: string | null },
): Promise<PolicyVersion> {
  const { data } = await adminApi.post<BaseResponse<PolicyVersion>>(
    `/api/admin/policies/${slug}`,
    body,
  )
  return data.data
}

// ---------------------------------------------------------------------------
// 인증번호 (전화번호 SMS 인증 이력)
// ---------------------------------------------------------------------------

export interface PhoneVerification {
  id: number
  userId: number
  userName: string | null
  phoneNumber: string
  code: string
  verified: boolean
  attemptCount: number
  expiresAt: string
  createdAt: string
}

export type PhoneVerificationPage = Paged<PhoneVerification>

/** 인증번호 발급 이력 최신순 — q 는 전화번호 부분 일치 */
export async function fetchPhoneVerifications(params: {
  q?: string
  page?: number
  size?: number
}): Promise<PhoneVerificationPage> {
  const { data } = await adminApi.get<BaseResponse<PhoneVerificationPage>>(
    '/api/admin/phone-verifications',
    { params },
  )
  return data.data
}
