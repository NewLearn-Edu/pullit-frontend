/** 프로토타입(problem-admin/index.html)의 인라인 SVG 아이콘 포팅 */

export function IcoHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M4.5 10.2L12 4l7.5 6.2V19a1.5 1.5 0 01-1.5 1.5h-3.6v-5.1a2.4 2.4 0 00-4.8 0v5.1H6A1.5 1.5 0 014.5 19v-8.8z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IcoProblem() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" fill="currentColor" />
      <path
        d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"
        stroke="#f3f4f6"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IcoMember() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8.2" r="3.7" fill="currentColor" />
      <path
        d="M4.8 19.5c.8-3.4 3.8-5.3 7.2-5.3s6.4 1.9 7.2 5.3a1.2 1.2 0 01-1.2 1.5H6a1.2 1.2 0 01-1.2-1.5z"
        fill="currentColor"
      />
    </svg>
  )
}

/** 관리자 계정 — 사람 + 방패(권한). 방패는 몸통과 겹치지 않게 우하단에 따로 둔다 */
export function IcoAdmin() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7.4" r="3.5" fill="currentColor" />
      <path
        d="M2.3 18.4c.7-3.1 3.3-4.9 6.7-4.9 1 0 2 .2 2.9.5v2.1c0 1.4.3 2.7.9 3.8H3.5a1.2 1.2 0 01-1.2-1.5z"
        fill="currentColor"
      />
      <path
        d="M18 11.2l4 1.5v3.2c0 2.4-1.6 4.5-4 5.3-2.4-.8-4-2.9-4-5.3v-3.2l4-1.5z"
        fill="currentColor"
        opacity=".55"
      />
    </svg>
  )
}

export function IcoStats() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="4" y="13" width="4" height="7" rx="1.4" fill="currentColor" />
      <rect x="10" y="8.5" width="4" height="11.5" rx="1.4" fill="currentColor" />
      <rect x="16" y="4" width="4" height="16" rx="1.4" fill="currentColor" />
    </svg>
  )
}

export function IcoSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8.4a3.6 3.6 0 100 7.2 3.6 3.6 0 000-7.2zm8.1 5.1l-1.8-.5a6.6 6.6 0 000-2l1.8-.5a.9.9 0 00.6-1.1l-.7-1.8a.9.9 0 00-1.1-.5l-1.8.6a6.6 6.6 0 00-1.4-1.4l.6-1.8a.9.9 0 00-.5-1.1l-1.8-.7a.9.9 0 00-1.1.6l-.5 1.8a6.6 6.6 0 00-2 0l-.5-1.8a.9.9 0 00-1.1-.6l-1.8.7a.9.9 0 00-.5 1.1l.6 1.8A6.6 6.6 0 005.7 7.7l-1.8-.6a.9.9 0 00-1.1.5l-.7 1.8a.9.9 0 00.6 1.1l1.8.5a6.6 6.6 0 000 2l-1.8.5a.9.9 0 00-.6 1.1l.7 1.8a.9.9 0 001.1.5l1.8-.6a6.6 6.6 0 001.4 1.4l-.6 1.8a.9.9 0 00.5 1.1l1.8.7a.9.9 0 001.1-.6l.5-1.8a6.6 6.6 0 002 0l.5 1.8a.9.9 0 001.1.6l1.8-.7a.9.9 0 00.5-1.1l-.6-1.8a6.6 6.6 0 001.4-1.4l1.8.6a.9.9 0 001.1-.5l.7-1.8a.9.9 0 00-.6-1.1z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IcoMoon() {
  return (
    <svg className="ico-moon" viewBox="0 0 24 24" fill="none">
      <path
        d="M20.2 13.6A8.2 8.2 0 0110.4 3.8a.6.6 0 00-.8-.7 9 9 0 1011.3 11.3.6.6 0 00-.7-.8z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IcoSun() {
  return (
    <svg className="ico-sun" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" />
      </g>
    </svg>
  )
}

export function IcoDashboard() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="2.5" width="6.2" height="6.2" rx="2" fill="currentColor" opacity=".85" />
      <rect x="11.3" y="2.5" width="6.2" height="6.2" rx="2" fill="currentColor" opacity=".4" />
      <rect x="2.5" y="11.3" width="6.2" height="6.2" rx="2" fill="currentColor" opacity=".4" />
      <rect x="11.3" y="11.3" width="6.2" height="6.2" rx="2" fill="currentColor" opacity=".85" />
    </svg>
  )
}

export function IcoList() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3.5" width="14" height="2.2" rx="1.1" fill="currentColor" opacity=".85" />
      <rect x="3" y="9" width="14" height="2.2" rx="1.1" fill="currentColor" opacity=".55" />
      <rect x="3" y="14.5" width="9" height="2.2" rx="1.1" fill="currentColor" opacity=".35" />
    </svg>
  )
}

/**
 * 계산기 도형 본체 (수학).
 * 테스트 배지 버전에서 축소해 재사용하므로 strokeWidth 를 주입받는다
 * — g 를 scale 하면 선 두께도 같이 줄어 원본과 굵기가 달라지기 때문.
 */
function MathGlyph({ strokeWidth = 1.6 }: { strokeWidth?: number }) {
  return (
    <>
      <rect
        x="4.2"
        y="2.2"
        width="11.6"
        height="15.6"
        rx="2.2"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        opacity=".6"
      />
      <rect x="6.4" y="4.7" width="7.2" height="2.6" rx="1" fill="currentColor" opacity=".85" />
      <g fill="currentColor">
        <rect x="6.4" y="9.8" width="1.9" height="1.9" rx=".6" opacity=".55" />
        <rect x="9.05" y="9.8" width="1.9" height="1.9" rx=".6" opacity=".55" />
        <rect x="11.7" y="9.8" width="1.9" height="1.9" rx=".6" opacity=".55" />
        <rect x="6.4" y="12.9" width="1.9" height="1.9" rx=".6" opacity=".35" />
        <rect x="9.05" y="12.9" width="1.9" height="1.9" rx=".6" opacity=".35" />
        <rect x="11.7" y="12.9" width="1.9" height="1.9" rx=".6" opacity=".35" />
      </g>
    </>
  )
}

/** 말풍선 도형 본체 (영어) */
function EnglishGlyph({ strokeWidth = 1.6 }: { strokeWidth?: number }) {
  return (
    <>
      <path
        d="M5.6 3.4h8.8a3 3 0 013 3v5.2a3 3 0 01-3 3H9.6l-3.4 2.6v-2.6h-.6a3 3 0 01-3-3V6.4a3 3 0 013-3z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        opacity=".6"
      />
      <g fill="currentColor">
        <circle cx="6.7" cy="9" r="1.15" opacity=".85" />
        <circle cx="10" cy="9" r="1.15" opacity=".55" />
        <circle cx="13.3" cy="9" r="1.15" opacity=".35" />
      </g>
    </>
  )
}

/** 맛보기 테스트 배지 — 우상단 T. 본체보다 진하게 둬서 뱃지로 읽히게 한다 */
function TestBadge() {
  return (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M13.4 3h5.2" />
      <path d="M16 3v5.2" />
    </g>
  )
}

/**
 * 수학 과목 — 계산기.
 * 외곽은 선, 내부(디스플레이·버튼)는 채움 + opacity 레이어 (IcoDashboard·IcoList 어법).
 * 내부를 배경색으로 뚫지 않으므로 라이트/다크 모두 currentColor 하나로 성립한다.
 */
export function IcoMath() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <MathGlyph />
    </svg>
  )
}

/** 영어 과목 — 말풍선. 외곽선 + 내부 점 3개(opacity 계단) */
export function IcoEnglish() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <EnglishGlyph />
    </svg>
  )
}

/** 수학 맛보기 테스트 — 계산기 축소 + 우상단 T 배지 */
export function IcoMathTest() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      {/* 배지 자리를 비우려 좌하단으로 축소 배치. strokeWidth 는 scale 만큼 역보정 */}
      <g transform="translate(-0.6 3.1) scale(0.82)">
        <MathGlyph strokeWidth={1.95} />
      </g>
      <TestBadge />
    </svg>
  )
}

/** 영어 맛보기 테스트 — 말풍선 축소 + 우상단 T 배지 */
export function IcoEnglishTest() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <g transform="translate(-1.5 3.3) scale(0.82)">
        <EnglishGlyph strokeWidth={1.95} />
      </g>
      <TestBadge />
    </svg>
  )
}

/** 크레딧 — 유저 앱 CreditBadge 의 ✦(U+2726) 를 4각 스파클로 옮긴 것 */
export function IcoCredit() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2.4Q11.1 8.9 17.6 10Q11.1 11.1 10 17.6Q8.9 11.1 2.4 10Q8.9 8.9 10 2.4Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IcoUpload() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path
        d="M10 13V4m0 0L6.5 7.5M10 4l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 13.5v1.5a2 2 0 002 2h8a2 2 0 002-2v-1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IcoSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="6.5" cy="6.5" r="4.7" stroke="#9a938f" strokeWidth="1.6" />
      <path d="M10.2 10.2L13.4 13.4" stroke="#9a938f" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** 인증번호 — SMS 말풍선 + 코드 점 3개 */
export function IcoOtp() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H9.4l-3.9 3.4a.8.8 0 01-1.3-.6V16h.3A2.5 2.5 0 014 13.5v-8z"
        fill="currentColor"
      />
      <circle cx="8.5" cy="9.5" r="1.3" fill="var(--color-rail, #fff)" />
      <circle cx="12" cy="9.5" r="1.3" fill="var(--color-rail, #fff)" />
      <circle cx="15.5" cy="9.5" r="1.3" fill="var(--color-rail, #fff)" />
    </svg>
  )
}
