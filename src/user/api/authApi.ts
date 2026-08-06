import axios, { type InternalAxiosRequestConfig } from 'axios'

/**
 * 인증 API — httpOnly 쿠키 방식
 *
 * JWT는 백엔드가 httpOnly 쿠키(Set-Cookie)로 발급·관리한다.
 * 프론트는 토큰을 저장·전송하지 않고(withCredentials로 쿠키 자동 전송),
 * access 만료로 401이 오면 쿠키 기반 재발급(refreshSession) 후 1회 재시도한다.
 * 로그인 여부 판단은 fetchMe 성공 여부로 한다 (httpOnly 쿠키는 JS가 읽을 수 없음).
 *
 * 카카오 로그인 (REST API 인가코드 방식 · SDK 불필요)
 * 1. startKakaoLogin() — kauth 인가 페이지로 리다이렉트
 * 2. 카카오가 /auth/kakao/callback?code=... 로 돌려보냄
 * 3. loginWithKakaoCode(code) — 인가코드 → 카카오 access token 교환 → 백엔드 로그인(쿠키 발급)
 *
 * 카카오 콘솔 필수 설정:
 * - 제품 설정 > 카카오 로그인 활성화
 * - Redirect URI 등록: {origin}/auth/kakao/callback
 * - 보안 > Client Secret 은 "사용 안 함" 유지 (프론트 교환 방식이므로)
 */

// 로컬 개발은 localhost:8080, 배포는 백엔드 도메인(api-dev)
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  (window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : 'https://api-dev.pullit.co.kr')
// REST 키는 인가 URL 로 브라우저에 그대로 노출되는 공개 값 (시크릿 아님).
// 빌드 환경에 env 가 없어도 로그인이 동작하도록 기본값 내장 — env 로 오버라이드 가능
const KAKAO_REST_KEY = import.meta.env.VITE_KAKAO_REST_KEY ?? 'd2465542ba74a81bb52ce10bbb9164c5'

const redirectUri = () => `${window.location.origin}/auth/kakao/callback`

interface BaseResponse<T> {
  successCode: string
  message: string
  data: T
}

/** 백엔드 API 클라이언트 — httpOnly 인증 쿠키 자동 전송 + 401 시 재발급 후 1회 재시도 */
export const api = axios.create({ baseURL: API_BASE, withCredentials: true })

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error?.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.startsWith('/api/auth/') // 로그인·재발급·로그아웃 자체는 재시도 대상 아님
    ) {
      original._retry = true
      try {
        await refreshSession()
        return api(original)
      } catch {
        /* refresh 도 만료 — 호출부에서 비로그인 처리 */
      }
    }
    return Promise.reject(error)
  },
)

/** 카카오 인가 페이지로 이동 (로그인 버튼에서 호출) */
export function startKakaoLogin() {
  const url =
    'https://kauth.kakao.com/oauth/authorize' +
    `?client_id=${KAKAO_REST_KEY}` +
    `&redirect_uri=${encodeURIComponent(redirectUri())}` +
    '&response_type=code'
  window.location.href = url
}

/** 콜백에서 받은 인가코드로 로그인 완료 (카카오 토큰 교환 → 백엔드가 쿠키 발급) */
export async function loginWithKakaoCode(code: string): Promise<void> {
  // 1. 인가코드 → 카카오 access token (카카오 API에 쿠키가 실리지 않도록 기본 axios 사용)
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

  // 2. 카카오 access token → 백엔드 로그인 (검증 + httpOnly 쿠키 발급)
  await api.post('/api/auth/oauth/kakao', { accessToken: kakaoAccessToken })
}

// ---------------------------------------------------------------------------
// 네이버 · 구글 로그인 (인가코드 방식 · 토큰 교환은 백엔드가 대행)
// ---------------------------------------------------------------------------
// 카카오와 달리 네이버·구글 토큰 엔드포인트는 client_secret 필수(+네이버는 CORS 미지원)라
// 브라우저 교환이 불가능하다. 콜백에서 받은 인가코드를 백엔드(/oauth/{provider}/code)로
// 보내면 백엔드가 교환·검증 후 httpOnly 쿠키를 발급한다.
//
// 콘솔 필수 설정:
// - 네이버 개발자센터 > Callback URL 등록: {origin}/auth/naver/callback
// - 구글 클라우드 콘솔 > 승인된 리디렉션 URI 등록: {origin}/auth/google/callback
//   (Client Secret은 백엔드 환경변수에만 보관 — 프론트에 넣지 말 것)

// Client ID는 인가 URL로 브라우저에 노출되는 공개 값 — 카카오 REST 키와 동일 패턴으로 기본값 내장
const NAVER_CLIENT_ID = import.meta.env.VITE_NAVER_CLIENT_ID ?? 'ep_kin0ZmsQpv9EA7374'
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ??
  '658149468916-ge7hf301nlkjvbgp23h1es5i07oqb8tl.apps.googleusercontent.com'

const oauthCallbackUri = (provider: 'naver' | 'google') =>
  `${window.location.origin}/auth/${provider}/callback`

const stateKey = (provider: string) => `pullit_oauth_state_${provider}`

/** CSRF 방지 state 생성·보관 — 콜백에서 consumeOauthState로 대조 */
function newOauthState(provider: 'naver' | 'google'): string {
  const state = crypto.randomUUID()
  sessionStorage.setItem(stateKey(provider), state)
  return state
}

/** 보관된 state 회수 (1회용 — 읽는 즉시 제거) */
export function consumeOauthState(provider: 'naver' | 'google'): string | null {
  const state = sessionStorage.getItem(stateKey(provider))
  sessionStorage.removeItem(stateKey(provider))
  return state
}

/** 네이버 인가 페이지로 이동 (로그인 버튼에서 호출) */
export function startNaverLogin() {
  const url =
    'https://nid.naver.com/oauth2.0/authorize' +
    '?response_type=code' +
    `&client_id=${NAVER_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(oauthCallbackUri('naver'))}` +
    `&state=${newOauthState('naver')}`
  window.location.href = url
}

/** 콜백에서 받은 네이버 인가코드로 로그인 완료 (교환·검증·쿠키 발급은 백엔드) */
export async function loginWithNaverCode(code: string, state: string): Promise<void> {
  await api.post('/api/auth/oauth/naver/code', { code, state })
}

/** 구글 인가 페이지로 이동 (로그인 버튼에서 호출) */
export function startGoogleLogin() {
  const url =
    'https://accounts.google.com/o/oauth2/v2/auth' +
    '?response_type=code' +
    `&client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(oauthCallbackUri('google'))}` +
    `&scope=${encodeURIComponent('openid email profile')}` +
    `&state=${newOauthState('google')}`
  window.location.href = url
}

/** 콜백에서 받은 구글 인가코드로 로그인 완료 (교환·검증·쿠키 발급은 백엔드) */
export async function loginWithGoogleCode(code: string): Promise<void> {
  await api.post('/api/auth/oauth/google/code', { code, redirectUri: oauthCallbackUri('google') })
}

// ---------------------------------------------------------------------------
// 애플 로그인 (Apple JS 팝업 방식 · 토큰 교환은 백엔드가 대행)
// ---------------------------------------------------------------------------
// 애플은 이름·이메일 scope 요청 시 response_mode=form_post가 강제라 SPA 콜백 페이지가
// POST를 받을 수 없다. 대신 Apple JS 팝업(usePopup)으로 code를 JS에서 직접 받아
// 백엔드(/oauth/apple/code)로 보내면 백엔드가 교환·검증 후 httpOnly 쿠키를 발급한다.
// (리다이렉트가 실제로 일어나진 않지만 redirectURI는 콘솔에 등록된 Return URL과 일치 필수)
//
// 콘솔 필수 설정 (developer.apple.com > Identifiers > Services ID):
// - Domains: pullit.co.kr, dev.pullit.co.kr
// - Return URLs: {origin}/auth/apple/callback (HTTPS만 가능 — localhost 테스트 불가)
//
// 주의: 이름은 최초 인가 1회만 내려온다 (재로그인 시 user 객체 없음) → 백엔드로 전달해 저장.

// Services ID는 인가 요청에 노출되는 공개 값 — 다른 provider와 동일 패턴으로 기본값 내장
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID ?? 'com.newlearn.pullit.web'

/** Apple JS SDK 전역 타입 (필요한 최소만 선언) */
interface AppleSignInResponse {
  authorization: { code: string; id_token: string; state?: string }
  /** 최초 인가 1회만 포함 */
  user?: { name?: { firstName?: string; lastName?: string }; email?: string }
}
declare global {
  interface Window {
    AppleID?: {
      auth: {
        init(config: {
          clientId: string
          scope: string
          redirectURI: string
          state: string
          usePopup: boolean
        }): void
        signIn(): Promise<AppleSignInResponse>
      }
    }
  }
}

let appleScriptPromise: Promise<void> | null = null

/** Apple JS SDK 1회 로드 (실패 시 다음 시도에서 재로드) */
function loadAppleScript(): Promise<void> {
  if (window.AppleID) return Promise.resolve()
  if (!appleScriptPromise) {
    appleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src =
        'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/ko_KR/appleid.auth.js'
      script.onload = () => resolve()
      script.onerror = () => {
        appleScriptPromise = null
        reject(new Error('Apple JS 로드 실패'))
      }
      document.head.appendChild(script)
    })
  }
  return appleScriptPromise
}

/** 애플 이름 조합 — 한글 성명은 붙여쓰기(김철수), 그 외는 이름 성 순서 */
function composeAppleName(name?: { firstName?: string; lastName?: string }): string | null {
  const firstName = name?.firstName ?? ''
  const lastName = name?.lastName ?? ''
  if (!firstName && !lastName) return null
  const isHangul = /^[가-힣]*$/.test(firstName) && /^[가-힣]*$/.test(lastName)
  return isHangul ? `${lastName}${firstName}` : `${firstName} ${lastName}`.trim()
}

/**
 * 애플 로그인 전체 흐름 (로그인 버튼에서 호출)
 * 팝업 → code 수신 → 백엔드 교환·검증·쿠키 발급까지 완료.
 * 사용자가 팝업을 닫으면 { error: 'popup_closed_by_user' } 형태로 reject된다.
 */
export async function loginWithApple(): Promise<void> {
  await loadAppleScript()
  const appleRedirectUri = `${window.location.origin}/auth/apple/callback`
  const state = crypto.randomUUID()
  window.AppleID!.auth.init({
    clientId: APPLE_CLIENT_ID,
    scope: 'name email',
    redirectURI: appleRedirectUri,
    state,
    usePopup: true,
  })
  const res = await window.AppleID!.auth.signIn()
  if (res.authorization.state !== state) {
    throw new Error('Apple 로그인 state 불일치')
  }
  await api.post('/api/auth/oauth/apple/code', {
    code: res.authorization.code,
    redirectUri: appleRedirectUri,
    name: composeAppleName(res.user?.name),
  })
}

// ---------------------------------------------------------------------------
// 세션 재발급 · 로그아웃
// ---------------------------------------------------------------------------

let refreshPromise: Promise<void> | null = null

/** refresh 쿠키로 인증 쿠키 재발급 — 동시에 여러 401이 나도 재발급은 1회로 합류 */
export function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE}/api/auth/token`, null, { withCredentials: true })
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

/** 로그아웃 — 서버가 RefreshToken 무효화 + 인증 쿠키 삭제 */
/**
 * 게스트 세션 발급 (POST /api/auth/guest · permitAll)
 *
 * 서버가 type=GUEST 유저를 만들고 access/refresh httpOnly 쿠키를 내려준다.
 * 이미 유효한 쿠키가 실려 있으면 서버는 새 계정을 만들지 않고 기존 세션을 유지한다(멱등).
 *
 * 주의: refresh 쿠키 Path 가 /api/auth/token 이라 이 요청에는 실리지 않는다.
 * 반드시 fetchMe() 로 세션 복구를 먼저 시도한 뒤 호출할 것 (userStore.ensureSession 참고).
 */
export async function createGuestSession(): Promise<void> {
  await api.post('/api/auth/guest')
}

export async function logout(): Promise<void> {
  await api.post('/api/auth/logout')
}

// ---------------------------------------------------------------------------
// 내 정보
// ---------------------------------------------------------------------------

export interface MeResult {
  id: number
  name: string | null
  nickname: string | null
  email: string | null
  role: 'USER' | 'ADMIN'
  /** GUEST = 미가입 게스트 — 맛보기 저장 시 비로그인이면 게스트 계정이 생성된다 */
  type: 'GUEST' | 'USER'
  creditBalance: number
}

/**
 * 내 정보 조회 (GET /api/users/me).
 * 비로그인·세션 만료·오류 시 null — 호출부에서 폴백 처리.
 * (401이면 인터셉터가 재발급 후 재시도하므로, null이면 refresh까지 만료된 상태)
 */
export async function fetchMe(): Promise<MeResult | null> {
  try {
    const { data } = await api.get<BaseResponse<MeResult>>('/api/users/me')
    return data.data
  } catch {
    return null
  }
}
