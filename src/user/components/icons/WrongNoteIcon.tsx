/**
 * 오답노트 아이콘 — 노트(둥근 사각) 안에 오답 X 가 뚫린 채움형.
 * 네비 세트(채움 집·막대·사람)와 같은 필드 스타일 · currentColor.
 * filled=false (기본) 는 비활성·토글 해제용 윤곽선 변형 (X 는 선으로).
 */
export function WrongNoteIcon({ size = 20, filled = false }: { size?: number; filled?: boolean }) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="1 1 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M7.1 3H14.9C16.336 3 17.5 4.164 17.5 5.6V16.4C17.5 17.836 16.336 19 14.9 19H7.1C5.664 19 4.5 17.836 4.5 16.4V5.6C4.5 4.164 5.664 3 7.1 3ZM11 9.657L12.802 7.854L14.146 9.198L12.343 11L14.146 12.802L12.802 14.146L11 12.343L9.198 14.146L7.854 12.802L9.657 11L7.854 9.198L9.198 7.854L11 9.657Z"
          fill="currentColor"
        />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="4.5" y="3" width="13" height="16" rx="2.6" />
      <path d="M8.8 8.8l4.4 4.4" />
      <path d="M13.2 8.8l-4.4 4.4" />
    </svg>
  )
}
