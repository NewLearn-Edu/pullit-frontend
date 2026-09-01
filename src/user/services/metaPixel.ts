/**
 * Meta Pixel (3838902539584016) — 페이지 조회 집계.
 *
 * 베이스 코드(init)는 index.html 에 한 번만 있고, 이 모듈은 SPA 라우트가
 * 바뀔 때마다 PageView 를 쏜다. 픽셀은 호출 시점의 현재 URL 을 함께 보내므로
 * Meta 이벤트 관리자에서 URL 별 조회수가 그대로 집계된다 —
 * 페이지마다 코드를 심을 필요가 없는 이유.
 *
 * - /admin 은 집계에서 제외 (운영자 트래픽이 마케팅 지표를 오염)
 * - 로컬 개발에서는 index.html 가드로 픽셀 자체가 로드되지 않아 fbq 가 없다 → no-op
 */

declare global {
  interface Window {
    fbq?: (command: 'track' | 'init' | 'trackCustom', name: string, params?: object) => void
  }
}

export function trackPageView(pathname: string): void {
  if (pathname.startsWith('/admin')) return
  window.fbq?.('track', 'PageView')
}
