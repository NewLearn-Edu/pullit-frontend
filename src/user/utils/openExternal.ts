/**
 * 외부 링크 열기 (2026-09-07) — 새 창을 시도하고, 막히면 같은 창에서 이동한다.
 *
 * 앱(네이티브 래퍼 WKWebView)은 window.open 을 래퍼가 WKUIDelegate.createWebView 로 받아 줘야 하는데
 * 구현이 없으면 조용히 무시된다 — 아이폰 앱에서 고객센터가 안 눌리던 원인. 브라우저 팝업 차단도 같은 증상.
 * window.open 은 그런 경우 null 을 주므로(noopener 를 붙이면 항상 null 이라 판별 불가 → 열린 뒤 opener 를 끊는다)
 * null 이면 location.href 로 폴백해 최소한 페이지 이동은 보장한다.
 */
export function openExternal(url: string): void {
  let opened: Window | null = null
  try {
    opened = window.open(url, '_blank')
  } catch {
    opened = null
  }
  if (opened) {
    try {
      opened.opener = null
    } catch {
      /* noop — cross-origin 이면 접근 불가, 무시 */
    }
    return
  }
  window.location.href = url
}
