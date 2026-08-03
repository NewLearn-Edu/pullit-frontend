import axios from 'axios'

/**
 * 카카오 로그인 (REST API 인가코드 방식 · SDK 불필요)
 *
 * 흐름:
 * 1. startKakaoLogin() — kauth 인가 페이지로 리다이렉트
 * 2. 카카오가 /auth/kakao/callback?code=... 로 돌려보냄
 * 3. loginWithKakaoCode(code) — 인가코드 → 카카오 access token 교환 → 백엔드 로그인 → JWT 저장
 *
 * 카카오 콘솔 필수 설정:
 * - 제품 설정 > 카카오 로그인 활성화
 * - Redirect URI 등록: {origin}/auth/kakao/callback
 * - 보안 > Client Secret 은 "사용 안 함" 유지 (프론트 교환 방식이므로)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
const KAKAO_REST_KEY = import.meta.env.VITE_KAKAO_REST_KEY ?? ''

const ACCESS_TOKEN_KEY = 'pullit_access_token'
const REFRESH_TOKEN_KEY = 'pullit_refresh_token'

const redirectUri = () => `${window.location.origin}/auth/kakao/callback`

export interface LoginResult {
  accessToken: string
  refreshToken: string
  tokenType: string
}

interface BaseResponse<T> {
  successCode: string
  message: string
  data: T
}

/** 카카오 인가 페이지로 이동 (로그인 버튼에서 호출) */
export function startKakaoLogin() {
  const url =
    'https://kauth.kakao.com/oauth/authorize' +
    `?client_id=${KAKAO_REST_KEY}` +
    `&redirect_uri=${encodeURIComponent(redirectUri())}` +
    '&response_type=code'
  window.location.href = url
}

/** 콜백에서 받은 인가코드로 로그인 완료 (카카오 토큰 교환 → 백엔드 JWT 발급) */
export async function loginWithKakaoCode(code: string): Promise<LoginResult> {
  // 1. 인가코드 → 카카오 access token
  const tokenRes = await axios.post(
    'https://kauth.kakao.com/oauth/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: KAKAO_REST_KEY,
      redirect_uri: redirectUri(),
      code,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' } },
  )
  const kakaoAccessToken: string = tokenRes.data.access_token

  // 2. 카카오 access token → 백엔드 로그인 (검증 + JWT 발급)
  const { data } = await axios.post<BaseResponse<LoginResult>>(
    `${API_BASE}/api/auth/oauth/kakao`,
    { accessToken: kakaoAccessToken },
  )

  saveTokens(data.data)
  return data.data
}

export function saveTokens(result: LoginResult) {
  localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken)
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

// ---------------------------------------------------------------------------
// 토큰 자동 갱신
// ---------------------------------------------------------------------------

/** JWT exp 클레임 기준 만료 여부 (10초 여유) — 파싱 실패 시 만료로 간주 */
function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now() + 10_000
  } catch {
    return true
  }
}

let refreshPromise: Promise<LoginResult> | null = null

/** 리프레시 토큰으로 재발급 — 동시에 여러 요청이 만료를 만나도 재발급은 1회로 합류 */
export function refreshTokens(): Promise<LoginResult> {
  if (!refreshPromise) {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return Promise.reject(new Error('no refresh token'))
    refreshPromise = axios
      .post<BaseResponse<LoginResult>>(`${API_BASE}/api/auth/token`, { refreshToken })
      .then(({ data }) => {
        saveTokens(data.data)
        return data.data
      })
      .catch((e) => {
        clearTokens() // 리프레시도 만료 — 재로그인 필요
        throw e
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

/**
 * 유효한 액세스 토큰 확보 — 만료됐으면 선제 갱신 후 반환.
 * (만료 토큰을 서버로 보내지 않아 백엔드 경고 로그도 발생하지 않는다)
 */
export async function getValidAccessToken(): Promise<string | null> {
  const token = getAccessToken()
  if (token && !isExpired(token)) return token
  if (!getRefreshToken()) return null
  try {
    return (await refreshTokens()).accessToken
  } catch {
    return null
  }
}
