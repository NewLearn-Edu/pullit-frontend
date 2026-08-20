/**
 * 얼리버드(오픈 전 사전신청) 모드 — /earlybird 로 들어온 방문자 전용 퍼널.
 *
 * 모드가 켜지면: 로그인·가입 경로가 막히고, 맛보기 진단(익명)만 가능하며,
 * 나브의 로그인 자리와 결과 화면의 "진단 완료"가 사전 신청(구글폼)으로 이어진다.
 * 신청 데이터는 구글폼 → 구글 시트로 모인다 (백엔드 없음).
 * 표식은 localStorage — 같은 브라우저 재방문에도 유지된다.
 */
const MODE_KEY = 'pullit_earlybird'

// TODO(배포 전 교체): 실제 구글폼 공유 링크로 바꿀 것 (forms.gle 단축 링크 권장)
export const EARLYBIRD_FORM_URL = 'https://forms.gle/REPLACE_ME'

export function enterEarlybird(): void {
  try {
    localStorage.setItem(MODE_KEY, '1')
  } catch {
    /* storage 불가 — 모드 없이 일반 흐름 */
  }
}

/** 일반 랜딩(/) 방문 시 해제 — 얼리버드 UI 가 일반 사이트에 새지 않게 */
export function clearEarlybird(): void {
  try {
    localStorage.removeItem(MODE_KEY)
  } catch {
    /* noop */
  }
}

export function isEarlybird(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) === '1'
  } catch {
    return false
  }
}

/** 사전 신청 구글폼 — 새 탭으로 (인앱 브라우저 포함 가장 확실한 방식) */
export function openEarlybirdForm(): void {
  window.open(EARLYBIRD_FORM_URL, '_blank', 'noopener')
}
