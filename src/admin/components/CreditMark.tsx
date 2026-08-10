/**
 * 크레딧 마크 ✦ — 유저 앱 CreditBadge 와 같은 글리프(U+2726)·같은 강조색.
 * 어드민은 유저 SCSS 토큰을 쓰지 않으므로 admin.css 의 --color-primary 로 맞춘다.
 */
export function CreditMark() {
  return <span className="credit-mark">✦</span>
}
