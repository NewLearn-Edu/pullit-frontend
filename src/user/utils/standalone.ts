/**
 * 홈 화면에 추가한 웹앱(standalone)으로 실행 중인가 (2026-09-04).
 *
 * 아이패드·안드로이드 웹앱은 회원 전용이다 — 비회원(게스트) 진입 요소(로그인 화면 "비회원으로 약점보기",
 * 가입 유도 화면 "건너뛰기")를 숨기고, 첫 화면의 뒤로가기 chevron 도 뺀다.
 * 안드로이드·iPadOS 공통 media query + iOS 사파리 전용 navigator.standalone 플래그.
 */
export function isStandaloneApp(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}
