/**
 * 크레딧 마크 — 서비스 크레딧 코인 그래픽(노란 동전 + C)의 미니 버전.
 * 브랜드 고정색 그래픽이라 테마 토큰을 타지 않는다 (라이트·다크 동일 — 실물 코인처럼).
 */
export function CreditMark() {
  return (
    <svg
      className="credit-mark"
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      aria-hidden
    >
      <circle cx="10" cy="10" r="9.2" fill="#F8D558" />
      <circle cx="10" cy="10" r="6.9" stroke="#EC9C40" strokeWidth="1.6" />
      <path
        d="M12.9 7.9a3.4 3.4 0 100 4.2"
        stroke="#E08E39"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
