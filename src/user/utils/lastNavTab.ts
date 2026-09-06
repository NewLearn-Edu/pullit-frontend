/**
 * 마지막으로 있던 하단 네비 탭 (2026-09-06).
 *
 * 오답노트는 패드·모바일 하단 네비에 자리가 없고 헤더 우측 "오답" 배지로만 들어간다.
 * 그래서 오답노트에서 그 배지를 다시 누르면 "닫기"처럼 동작해야 하는데, 돌아갈 곳이
 * 어디인지는 들어오기 직전 탭이 정답이다 (홈에서 들어왔으면 홈, 지도에서 들어왔으면 지도).
 *
 * sessionStorage — 새로고침에는 살아남고 탭을 닫으면 사라진다.
 */
const KEY = 'pullit_last_nav_tab'

/** 하단 네비 탭 경로 — 오답노트(/wrong-note)는 탭이 아니라 여기 없다 */
const NAV_PATHS = ['/home', '/weakness-map', '/report', '/my']

const isNavTab = (pathname: string) => NAV_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

/** 지금 화면이 하단 네비 탭이면 기억한다 (과목 쿼리까지 — 돌아갔을 때 같은 과목으로) */
export function rememberNavTab(pathname: string, search = ''): void {
  if (!isNavTab(pathname)) return
  try {
    sessionStorage.setItem(KEY, pathname + search)
  } catch {
    /* 저장 불가 환경 — 홈으로 폴백 */
  }
}

/** 돌아갈 탭 — 기억이 없으면(딥링크·웹 사이드바 진입) 홈 */
export function readNavTab(): string {
  try {
    return sessionStorage.getItem(KEY) || '/home'
  } catch {
    return '/home'
  }
}
