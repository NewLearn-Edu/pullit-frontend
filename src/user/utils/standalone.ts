/**
 * "앱으로 실행 중인가" (2026-09-04) — 아이패드·안드로이드 앱은 회원 전용이다.
 * 비회원(게스트) 진입 요소(로그인 "비회원으로 약점보기", 가입 유도 "건너뛰기")를 숨기고,
 * 로그아웃·탈퇴 뒤엔 랜딩 대신 /login 으로, 첫 화면의 뒤로가기 chevron 도 뺀다.
 *
 * 판정 신호 (하나라도 맞으면 앱 · 한 번 앱으로 판정되면 localStorage 에 기억해 이후 화면 전환에서도 유지):
 * 1. 래퍼가 주는 명시 신호 — window.__PULLIT_APP__ · UA "PullitApp" · 진입 URL 의 ?app= (start_url 에 붙이면 가장 확실)
 * 2. iOS·iPadOS WKWebView — 모바일 WebKit 인데 "Safari/" 토큰이 없다 (iPadOS 13+ 는 데스크톱 UA 라 platform+터치로 보강)
 * 3. Android WebView — UA "; wv" 또는 "Version/x.y" 토큰(크롬 브라우저엔 없음). 갤럭시 래퍼가 wv 를 안 붙이는 경우 대비
 * 4. TWA(Trusted Web Activity)·홈 화면 PWA — display-mode: standalone / navigator.standalone / referrer android-app://
 * (카카오톡 인앱 브라우저도 Safari 토큰이 없지만 index.html 이 진입 즉시 외부 브라우저로 내보낸다)
 */
const APP_FLAG_KEY = 'pullit_app'

function remember(): true {
  try {
    localStorage.setItem(APP_FLAG_KEY, '1')
  } catch {
    /* noop */
  }
  return true
}

export function isStandaloneApp(): boolean {
  try {
    if (localStorage.getItem(APP_FLAG_KEY) === '1') return true
  } catch {
    /* noop */
  }
  try {
    const w = window as Window & { __PULLIT_APP__?: boolean }
    if (w.__PULLIT_APP__ === true) return remember()
    const ua = navigator.userAgent || ''
    if (/PullitApp/i.test(ua)) return remember()
    if (new URLSearchParams(window.location.search).has('app')) return remember()
    if (/^android-app:\/\//.test(document.referrer || '')) return remember()
    // Android WebView — "; wv" (Lollipop+ 표준) 또는 "Version/4.0" (WebView 전용 토큰 · 크롬 브라우저엔 없다)
    if (/Android/i.test(ua) && (/;\s*wv\b/.test(ua) || /\bVersion\/\d+\.\d+/.test(ua))) return remember()
    // iOS · iPadOS WKWebView — 모바일 WebKit 인데 Safari 토큰이 없다
    const iosLike = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    if (iosLike && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)) return remember()
    // 홈 화면 PWA · TWA
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    ) {
      return remember()
    }
    return false
  } catch {
    return false
  }
}

/** iPad 계열인가 — iPadOS 13+ 는 데스크톱 UA 를 쓰므로 platform + 터치로 판별 */
export function isIPadLike(): boolean {
  try {
    return /iPad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  } catch {
    return false
  }
}

/**
 * 앱 상단 인셋 폴백 (2026-09-04) — 렌더 전에 1회.
 * iPad 는 앱(래퍼 웹뷰·PWA)에서 상태바가 콘텐츠를 덮는데도 env(safe-area-inset-top) 을 0 으로 준다.
 * 화면들은 --safe-top(= max(env, --safe-top-fallback)) 을 쓰므로 여기서 하한 24px 만 세워 주면 된다.
 * 아이폰은 env 가 정상이라 건드리지 않는다. 래퍼가 정확한 인셋을 알면 같은 변수를 덮어쓰면 된다.
 */
export function applyAppInsets(): void {
  try {
    if (isStandaloneApp() && isIPadLike()) {
      document.documentElement.style.setProperty('--safe-top-fallback', '24px')
    }
  } catch {
    /* noop */
  }
}
