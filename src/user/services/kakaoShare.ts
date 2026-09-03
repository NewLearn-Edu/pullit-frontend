/**
 * 카카오톡 공유 (Kakao JS SDK · Kakao.Share.sendDefault).
 *
 * "초대하기"를 누르면 OS 공유 시트에서 앱을 고르는 단계 없이 곧장 카카오톡 공유 창이 뜬다.
 * SDK 스크립트는 처음 필요할 때 한 번만 동적 로드하고, 이후엔 캐시된 window.Kakao 를 쓴다.
 *
 * 동작 전제 (둘 다 되어 있어야 함):
 * - JavaScript 키 (아래 KAKAO_JS_KEY) — 카카오 디벨로퍼 > 앱 > 플랫폼 키 > JavaScript 키
 * - Web 플랫폼 도메인 등록 — 카카오 디벨로퍼 > 앱 > 플랫폼(Web) 에 접속 도메인 등록
 * 조건이 안 맞거나 로드 실패 시 shareToKakao 는 false 를 반환하고, 호출부가 OS 공유로 폴백한다.
 */

// JS 키는 인가 요청에 노출되는 공개 값 — REST 키(authApi)와 동일 패턴으로 기본값 내장 + env 오버라이드
const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY ?? 'ad4c2e368fd3a3ea4128df1c9de48d5a'
const SDK_SRC = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'

/** Kakao JS SDK 전역 타입 — 공유에 필요한 최소만 선언 */
interface KakaoSdk {
  init(jsKey: string): void
  isInitialized(): boolean
  Share: {
    sendDefault(settings: Record<string, unknown>): void
  }
}
declare global {
  interface Window {
    Kakao?: KakaoSdk
  }
}

let loadPromise: Promise<void> | null = null

/** SDK 스크립트 1회 동적 로드 (동시 호출은 같은 Promise 공유) */
function loadSdk(): Promise<void> {
  if (window.Kakao) return Promise.resolve()
  if (loadPromise) return loadPromise
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SDK_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loadPromise = null // 다음 시도에서 재로드 가능하게
      reject(new Error('Kakao SDK 로드 실패'))
    }
    document.head.appendChild(script)
  })
  return loadPromise
}

/**
 * 공유 카드 썸네일 — 카카오 서버가 직접 가져가므로 반드시 공개 https 절대경로.
 * public/og-invite.png (1200×630 초대 배너). 카카오 feed 는 2:1 로 가운데를 크롭하므로
 * 상하 약간 잘려도 되게 콘텐츠를 중앙에 둔 이미지. prod 배포 후에야 실제로 노출된다.
 */
const DEFAULT_THUMBNAIL = 'https://www.pullit.co.kr/og-invite.png' // 서빙 도메인(www) 직접 — apex 는 301

interface KakaoShareOptions {
  /** 카드 제목 (굵게, 최상단) */
  title: string
  /** 카드 설명 (제목 아래 회색 본문) */
  description: string
  /** 공유 링크 — 초대 리퍼럴이면 ?ref=코드 를 포함한 URL */
  url: string
  /** 카드 썸네일 이미지 (공개 https 절대경로) — 미지정 시 로고 */
  imageUrl?: string
  /** 카드 하단 버튼 라벨 */
  buttonTitle?: string
}

/**
 * 카카오톡 공유 창 띄우기 (썸네일 + 제목 + 설명 + 버튼의 feed 카드).
 * @returns 공유를 시작했으면 true, SDK 미가용/실패면 false (호출부에서 OS 공유로 폴백)
 */
export async function shareToKakao({
  title,
  description,
  url,
  imageUrl = DEFAULT_THUMBNAIL,
  buttonTitle = '풀잇 시작하기',
}: KakaoShareOptions): Promise<boolean> {
  try {
    await loadSdk()
    const Kakao = window.Kakao
    if (!Kakao) return false
    if (!Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY)
    const link = { mobileWebUrl: url, webUrl: url }
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: { title, description, imageUrl, link },
      buttons: [{ title: buttonTitle, link }],
    })
    return true
  } catch {
    return false
  }
}
