import { detectClient, detectDevice } from '@/user/utils/standalone'
import axios, { type InternalAxiosRequestConfig } from 'axios'
import type { WithdrawalReason } from '@/user/data/withdrawalReasons'

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

// 로컬 개발은 접속한 호스트의 8080 (localhost 또는 같은 와이파이의 맥 IP), 배포는 백엔드 도메인(api-dev)
const isLocalHost = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(
  window.location.hostname,
)
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  (isLocalHost ? `http://${window.location.hostname}:8080` : 'https://api-dev.pullit.co.kr')
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
// 접속 정보 헤더 — 서버가 가입 시점(users.signup_client/device)·최근(last_*)·방문(visit_events.client/device)에 박제한다 (2026-09-08).
// 웹/앱 + 기기(OS × 폰/패드). 없으면 서버가 UA 로 추정하지만, 헤더가 있으면 그 값을 우선한다 (iPadOS 는 헤더만 정확)
api.defaults.headers.common['X-Pullit-Client'] = detectClient()
api.defaults.headers.common['X-Pullit-Device'] = detectDevice()

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

/**
 * OAuth state 난수 — randomUUID 는 보안 컨텍스트(HTTPS·localhost) 전용이라
 * 사설 IP http 접속(모바일 LAN 테스트)에선 없다. 어디서나 동작하는
 * getRandomValues 로 폴백해 같은 강도의 난수를 만든다.
 */
function randomOauthState(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
}

/** CSRF 방지 state 생성·보관 — 콜백에서 consumeOauthState로 대조 */
function newOauthState(provider: 'naver' | 'google'): string {
  const state = randomOauthState()
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

/** 팝업에서 받아 백엔드로 넘길 인가 결과 — redirectUri 는 교환 요청에 같은 값이 필요하다 */
export interface AppleAuthResult extends AppleSignInResponse {
  redirectUri: string
}

/**
 * Apple JS SDK 미리 로드 — 로그인·가입 화면 진입 시 호출한다.
 * 클릭 시점에 스크립트가 이미 있어야 팝업이 사용자 제스처 안에서 열린다.
 */
export function prepareAppleLogin(): Promise<void> {
  return loadAppleScript().catch(() => {})
}

/**
 * 애플 로그인 팝업 열기 — ★ 반드시 클릭 핸들러에서 앞에 await 없이 곧바로 호출한다 (2026-09-06).
 *
 * SDK 내부가 window.open 을 부르는데, 앞에 await 가 하나라도 있으면(세션 warm-up·스크립트 로드 등)
 * 사용자 제스처가 끊겨 안드로이드 크롬이 팝업을 막는다. 팝업이 막히면 SDK 는 전체 페이지
 * 리다이렉트로 넘어가고, 애플은 scope 때문에 form_post 로 POST 를 보내 SPA 가 받을 수 없다
 * (아이패드 사파리에서만 되고 안드로이드에선 빈 화면으로 떨어지던 원인).
 *
 * 사용자가 팝업을 닫으면 { error: 'popup_closed_by_user' } 형태로 reject 된다.
 */
export function openAppleSignIn(): Promise<AppleAuthResult> {
  if (!window.AppleID) {
    void loadAppleScript() // 다음 시도를 위해 받아 둔다
    return Promise.reject(new Error('Apple JS 미로드'))
  }
  const redirectUri = `${window.location.origin}/auth/apple/callback`
  const state = randomOauthState()
  window.AppleID.auth.init({
    clientId: APPLE_CLIENT_ID,
    scope: 'name email',
    redirectURI: redirectUri,
    state,
    usePopup: true,
  })
  return window.AppleID.auth.signIn().then((res) => {
    if (res.authorization.state !== state) {
      throw new Error('Apple 로그인 state 불일치')
    }
    return { ...res, redirectUri }
  })
}

/**
 * 애플 로그인을 팝업 대신 전체 페이지 리다이렉트(form_post)로 해야 하는 환경인가 (2026-09-06).
 * 안드로이드 웹앱(홈 화면 PWA·TWA·래퍼 웹뷰)은 팝업이 브라우저 새 탭으로 튀어나가 원래 창과
 * 연결(window.opener)이 끊겨 빈 화면으로 남는다. 안드로이드는 브라우저에서도 팝업 차단이 잦아
 * 통째로 리다이렉트로 간다. iOS·iPadOS·데스크톱은 팝업 유지 (게스트 승격 등 기존 흐름 그대로)
 */
export function shouldUseAppleRedirect(): boolean {
  try {
    return /Android/i.test(navigator.userAgent || '')
  } catch {
    return false
  }
}

/** 리다이렉트 방식 콜백 — 애플이 form_post 로 보내므로 SPA 가 아니라 백엔드가 받는다 (AppleRedirectController) */
const APPLE_REDIRECT_URI = `${API_BASE}/api/auth/oauth/apple/redirect`
const APPLE_STATE_KEY = 'pullit_oauth_state_apple'

const base64Url = (s: string) =>
  btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/**
 * 리다이렉트 방식 애플 인가 시작 — 페이지 전체가 appleid.apple.com 으로 이동한다.
 * state = "{nonce}.{base64url(origin)}": nonce 는 콜백(AppleCallbackPage)이 대조하고, origin 은 백엔드가
 * 허용 목록 검증 뒤 복귀 대상(/auth/apple/callback)으로 쓴다 (로컬·dev·운영 프론트가 같은 백엔드를 공유)
 */
export function startAppleRedirectLogin(): void {
  const nonce = randomOauthState()
  try {
    sessionStorage.setItem(APPLE_STATE_KEY, nonce)
  } catch {
    /* noop — 대조 불가면 콜백이 state 검증을 건너뛴다 */
  }
  const state = `${nonce}.${base64Url(window.location.origin)}`
  const url =
    'https://appleid.apple.com/auth/authorize' +
    `?client_id=${encodeURIComponent(APPLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(APPLE_REDIRECT_URI)}` +
    '&response_type=code' +
    `&scope=${encodeURIComponent('name email')}` +
    '&response_mode=form_post' +
    `&state=${encodeURIComponent(state)}`
  window.location.href = url
}

/** 콜백에서 state 의 nonce 대조 (1회용). 보관값이 없으면(저장 불가 환경) 검증 생략 = true */
export function verifyAppleRedirectState(state: string | null): boolean {
  let saved: string | null = null
  try {
    saved = sessionStorage.getItem(APPLE_STATE_KEY)
    sessionStorage.removeItem(APPLE_STATE_KEY)
  } catch {
    return true
  }
  if (!saved) return true
  return !!state && state.split('.')[0] === saved
}

/** 팝업으로 받은 code 를 백엔드에 넘겨 교환·검증·쿠키 발급 (네트워크는 팝업이 닫힌 뒤라 제스처와 무관) */
export async function finishAppleLogin(res: AppleAuthResult): Promise<void> {
  await api.post('/api/auth/oauth/apple/code', {
    code: res.authorization.code,
    redirectUri: res.redirectUri,
    name: composeAppleName(res.user?.name),
  })
}

/**
 * 이메일 중복 가입 차단(409 U002) 응답의 detail — 서버 DuplicateEmailDetail 과 동일 (2026-09-06).
 * 한 이메일 = 한 계정 정책: 카카오로 가입한 이메일로 네이버 가입을 시도하면 서버가 거절한다.
 */
export interface DuplicateAccountInfo {
  email: string
  provider: 'KAKAO' | 'NAVER' | 'GOOGLE' | 'APPLE' | null
  providerName: string | null
}

/** 소셜 로그인 실패가 "이미 다른 소셜로 가입된 이메일" 때문이면 그 정보를, 아니면 null */
export function extractDuplicateAccount(error: unknown): DuplicateAccountInfo | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null
  const data = error.response.data as { errorCode?: string; detail?: Partial<DuplicateAccountInfo> } | undefined
  if (data?.errorCode !== 'U002' || !data.detail?.email) return null
  return {
    email: data.detail.email,
    provider: data.detail.provider ?? null,
    providerName: data.detail.providerName ?? null,
  }
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

/**
 * 회원 탈퇴 (DELETE /api/users/me) — 서버가 소프트 삭제(DELETED) 후 인증 쿠키를 만료시킨다.
 * 유예 기간(30일) 안에 같은 소셜로 재로그인하면 복구되고, 지나면 완전 삭제된다.
 */
export async function withdrawAccount(reason: WithdrawalReason, detail?: string): Promise<void> {
  // 사유는 필수 · 상세는 "기타" 등 선택 — 서버 users.withdrawal_reason/detail 에 남아 이탈 집계에 쓰인다 (2026-09-04)
  await api.delete('/api/users/me', { data: { reason, detail: detail?.trim() || null } })
}

/** 마케팅 수신동의 변경 — 동의(시각 기록) / 철회(삭제). 마이페이지 토글 */
export async function updateMarketingConsent(agree: boolean): Promise<void> {
  await api.patch('/api/users/me/marketing-consent', { agree })
}

/**
 * 닉네임 사용 가능 여부 (가입 화면 · 2026-09-06).
 * 형식 위반도 false 로 내려온다 — 호출부가 형식을 먼저 걸러 쓰기를 권한다.
 * 조회 실패(네트워크 등)는 막지 않는다 — 최종 판정은 가입 요청의 409 가 한다.
 */
export async function checkNicknameAvailable(nickname: string): Promise<boolean> {
  const { data } = await api.get<{ data: { available: boolean } | null }>(
    '/api/users/nickname-availability',
    { params: { nickname } },
  )
  return data.data?.available ?? true
}

/** 닉네임 변경 (프로필 편집) — 형식·중복 위반 시 4xx (message = UX 카피) */
export async function updateNickname(nickname: string): Promise<void> {
  await api.patch('/api/users/me/nickname', { nickname })
}

/** 학년/신분 변경 — 프로필 편집 (2026-09-07). 가입 때와 같은 자기신고 값 */
export async function updateGrade(grade: Grade): Promise<void> {
  await api.patch('/api/users/me/grade', { grade })
}

/**
 * 프로필 이미지 변경 (POST /api/users/me/profile-image).
 * 원본을 그대로 보내지 말고 resizeProfileImage 로 줄인 Blob 을 넘긴다 —
 * 서버 상한은 5MB 이고, 타입은 JPG · PNG · WebP 만 받는다.
 */
export async function updateProfileImage(image: Blob): Promise<void> {
  const form = new FormData()
  form.append('file', image, 'profile')
  await api.post('/api/users/me/profile-image', form)
}

/** 프로필 이미지 삭제 — 기본 아바타로 되돌린다 */
export async function deleteProfileImage(): Promise<void> {
  await api.delete('/api/users/me/profile-image')
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
  /**
   * 가입 상태 = type × status (2026-09-08):
   *   GUEST·GUEST 맛보기/건너뛰기 게스트 · GUEST·PENDING 게스트가 소셜 로그인만 누름 ·
   *   USER·PENDING 바로 소셜 로그인(프로필 미완) · USER·ACTIVE 가입 완료.
   * 회원(USER)이 되는 건 프로필 완성 시점 — 소셜 로그인만으론 게스트 그대로다
   */
  type: 'GUEST' | 'USER'
  /** GUEST = 순수 게스트 · PENDING = 소셜 로그인은 했고 프로필(닉네임·학년·전화·동의) 미완 → /signup/info (구버전 서버엔 없음) */
  status?: 'GUEST' | 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED'
  creditBalance: number
  /** 회원인데 null 이면 추가 정보 입력(/signup/info)이 필요하다 */
  phoneNumber: string | null
  birthDate: string | null
  /** 학년/신분 — 프로필 완성 전엔 null */
  grade: Grade | null
  /** 커스텀 프로필 이미지 URL — null 이면 프론트가 기본 아바타 표시 */
  profileImageUrl: string | null
  /** 마케팅 수신동의 시각 — null 이면 미동의/철회 상태 (마이페이지 토글의 진실원) */
  marketingConsentAt: string | null
  /** 마지막 닉네임 변경 시각 — 이력 표시용 (한 번도 안 바꿨으면 null). 재변경 제한은 없다 */
  nicknameChangedAt: string | null
  /** 가입 소셜 — 애플 가입자는 이름 칸을 수정할 수 없다 (Apple 정책). 게스트/미연동이면 null */
  provider: 'NAVER' | 'KAKAO' | 'GOOGLE' | 'APPLE' | null
  /** 가입 시각 (ISO) — 리포트 잔디의 시작 기준(가입 월) */
  joinedAt: string | null
  /** 다음 무료 크레딧 충전 시각 (epoch ms · 다음 04:00 KST) — 크레딧 팝업 카운트다운 기준 (구버전 서버엔 없음) */
  nextDailyCreditAtMs?: number
  /** 매일 충전량 (3) */
  dailyCreditAmount?: number
}

/** 학년/신분 — 서버 common.enums.Grade 와 동일 값 */
export type Grade =
  | 'MIDDLE_1' | 'MIDDLE_2' | 'MIDDLE_3'
  | 'HIGH_1' | 'HIGH_2' | 'HIGH_3'
  | 'RETAKE' | 'PARENT' | 'TEACHER' | 'GENERAL'

export const GRADE_LABEL: Record<Grade, string> = {
  MIDDLE_1: '중1', MIDDLE_2: '중2', MIDDLE_3: '중3',
  HIGH_1: '고1', HIGH_2: '고2', HIGH_3: '고3',
  RETAKE: 'N수생', PARENT: '학부모', TEACHER: '선생님', GENERAL: '일반인',
}

/**
 * 학년 선택 그룹 — 회원가입(SignupInfoPage)과 프로필 편집이 같은 묶음을 쓴다.
 * 중1 은 뺀다: 만 14세 연령 게이트로 사실상 가입 불가 (enum 은 유지 · 2026-08-30).
 */
export const GRADE_GROUPS = [
  { key: 'middle', label: '중학생', options: ['MIDDLE_2', 'MIDDLE_3'] },
  { key: 'high', label: '고등학생', options: ['HIGH_1', 'HIGH_2', 'HIGH_3'] },
  { key: 'etc', label: '기타', options: ['RETAKE', 'PARENT', 'TEACHER', 'GENERAL'] },
] as const satisfies readonly { key: string; label: string; options: readonly Grade[] }[]

export interface ProfileCompleteRequest {
  /** 이름 — 구글(프로필명)·애플(최초 1회)은 SSO 값이 부정확할 수 있어 직접 입력 */
  name: string
  /** 닉네임 — 화면 표시명. 한글·영문·숫자 2~10자 · 중복 불가 (409 U019) */
  nickname: string
  birthDate: string // YYYY-MM-DD
  /** 학년/신분 — 필수 선택 (자기신고, 생년월일과 정합성 검증 안 함) */
  grade: Grade
  phoneNumber: string // 010-0000-0000
  agreeTerms: boolean
  agreePrivacy: boolean
  /** [선택] 마케팅 정보 수신 동의 — 유저가 직접 체크한 경우에만 true */
  agreeMarketing: boolean
  /** [선택] 초대 코드 — 초대 링크(?invite=)로 들어와 가입한 경우 실린다 (초대자 +5 지급 근거) */
  inviteCode?: string | null
}

/**
 * 가입 추가 정보 입력 (이름 · 생년월일 · 전화번호 · 필수 약관) — 연령 게이트.
 * 전화번호는 SMS 인증(confirmPhoneCode)을 마친 번호여야 한다 (미인증 시 400 U016).
 * 만 14세 미만이면 서버가 계정을 즉시 파기하고 403(U010) 을 반환한다.
 */
/** 가입 추가 정보 완료 응답 — welcomeCreditGranted 가 켜지면 축하 뷰(/signup-complete)로 */
export interface ProfileCompleteResult {
  welcomeCreditGranted: boolean
}

export async function completeProfile(req: ProfileCompleteRequest): Promise<ProfileCompleteResult> {
  const { data } = await api.post<{ data: ProfileCompleteResult | null }>('/api/users/me/profile', req)
  return data.data ?? { welcomeCreditGranted: false }
}

/** 내 초대 코드 조회 — 없으면 서버가 이때 발급. 초대 링크(pullit.co.kr/start?invite=)에 실린다 */
export async function fetchInviteCode(): Promise<string> {
  const { data } = await api.get<{ data: { inviteCode: string } | null }>('/api/users/me/invite-code')
  return data.data?.inviteCode ?? ''
}

/** 초대하기 버튼 누름 기록 — 공유 발동마다 1회 (초대 "시도" 집계용). 실패해도 공유는 진행 */
export async function recordInviteShared(): Promise<void> {
  await api.post('/api/users/me/invite-shared')
}

/** 전화번호 인증번호 SMS 발송 (60초 쿨다운 — 초과 시 429 U012) */
export async function requestPhoneCode(phoneNumber: string): Promise<void> {
  await api.post('/api/users/me/phone/verification', { phoneNumber })
}

/**
 * 인증번호 검증 결과 (3분 유효 · 5회 시도 제한).
 * duplicated 면 이 번호로 이미 가입한 다른 계정이 있음 — provider 로 기존 소셜 로그인 유도.
 * provider 정보는 번호 소유를 증명(인증 통과)한 응답에만 실려온다.
 */
export type PhoneVerifyResult = {
  duplicated: boolean
  provider: 'KAKAO' | 'NAVER' | 'GOOGLE' | 'APPLE' | null
  providerName: string | null
}

export async function confirmPhoneCode(phoneNumber: string, code: string): Promise<PhoneVerifyResult> {
  const { data } = await api.post<BaseResponse<PhoneVerifyResult>>(
    '/api/users/me/phone/verification/confirm',
    { phoneNumber, code },
  )
  return data.data
}

/**
 * 내 정보 조회 + 실패 원인 (GET /api/users/me).
 * unauthorized = 인터셉터가 refresh 재발급까지 시도한 뒤에도 401 —
 * 세션이 서버 확정으로 죽은 상태 (네트워크 오류·5xx 는 판정 불가라 false).
 * userStore 가 세션 힌트 정리 여부를 결정하는 데 쓴다.
 */
export async function probeSession(): Promise<{ me: MeResult | null; unauthorized: boolean }> {
  try {
    const { data } = await api.get<BaseResponse<MeResult>>('/api/users/me')
    return { me: data.data, unauthorized: false }
  } catch (e) {
    return { me: null, unauthorized: axios.isAxiosError(e) && e.response?.status === 401 }
  }
}

/**
 * 내 정보 조회 (GET /api/users/me).
 * 비로그인·세션 만료·오류 시 null — 호출부에서 폴백 처리.
 * (401이면 인터셉터가 재발급 후 재시도하므로, null이면 refresh까지 만료된 상태)
 */
export async function fetchMe(): Promise<MeResult | null> {
  return (await probeSession()).me
}
