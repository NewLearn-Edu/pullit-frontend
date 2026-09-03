/**
 * 초대(리퍼럴) — 초대 링크로 들어온 코드를 붙잡아 가입 완료까지 보존한다.
 *
 * 흐름: 초대 링크(www.pullit.co.kr/start?invite=xxxx) 진입 → captureInviteCode() 가 localStorage 저장
 * → 소셜 로그인 리다이렉트(URL 파라미터 유실)를 넘어 가입 완료 시 readInviteCode() 로 꺼내
 * completeProfile 에 실어 보냄 → 성공하면 clearInviteCode(). 서버가 초대자에게 +5 지급.
 */

const INVITE_CODE_KEY = 'pullit_invite_code'

/**
 * 초대 링크는 항상 prod 로 — dev·로컬에서 공유해도 받는 사람이 정상 링크로 들어오게 고정.
 * www 를 붙인다 (2026-09-03): pullit.co.kr 은 CloudFront Function 이 www 로 301 하면서 쿼리스트링을 버려
 * ?invite= 가 사라졌다 (curl 확인: /start?invite=x → Location: https://www.pullit.co.kr/start).
 * 서빙 도메인으로 바로 보내면 리다이렉트 자체가 없다
 */
const INVITE_ORIGIN = 'https://www.pullit.co.kr'

/** 현재 URL 의 ?invite= 를 저장 (진입 시 1회). 소셜 로그인 리다이렉트로 URL 이 날아가기 전에 붙잡는다 */
export function captureInviteCode(): void {
  try {
    const code = new URLSearchParams(window.location.search).get('invite')?.trim()
    if (code) localStorage.setItem(INVITE_CODE_KEY, code)
  } catch {
    /* 스토리지 접근 불가 — 무시 */
  }
}

export function readInviteCode(): string | null {
  try {
    return localStorage.getItem(INVITE_CODE_KEY)
  } catch {
    return null
  }
}

export function clearInviteCode(): void {
  try {
    localStorage.removeItem(INVITE_CODE_KEY)
  } catch {
    /* noop */
  }
}

/** 내 초대 코드로 공유 링크 조립 — 코드가 아직 없으면 코드 없이 /start 로 */
export function buildInviteUrl(myCode: string | null | undefined): string {
  return myCode ? `${INVITE_ORIGIN}/start?invite=${encodeURIComponent(myCode)}` : `${INVITE_ORIGIN}/start`
}
