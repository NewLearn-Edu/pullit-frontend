const KEY = 'pullit_post_login_redirect'

/**
 * 소셜 로그인 후 복귀 경로.
 * OAuth 는 외부 도메인을 왕복해 라우터 state 가 유지되지 않으므로 sessionStorage 를 쓴다.
 */
export function setPostLoginRedirect(path: string) {
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    /* noop */
  }
}

/** 1회용 회수 — 오픈 리다이렉트 방지를 위해 내부 경로(/ 시작, // 금지)만 허용 */
export function consumePostLoginRedirect(): string | null {
  try {
    const value = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    if (!value || !value.startsWith('/') || value.startsWith('//')) return null
    return value
  } catch {
    return null
  }
}
