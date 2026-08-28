/**
 * 오답노트 아이콘 — 노트(둥근 사각) 안에 오답 빗금이 그어진 형태.
 * 네비 세트(채움 집·막대·사람)와 같은 필드 스타일 · currentColor.
 *
 * 빗금은 결과 화면 채점 마크(GradeMark)의 오답 기호와 같은 방향이다 —
 * 서비스가 오답을 표기하는 기호를 그대로 쓴다. (2026-08-28: ✕ 에서 교체.
 * ✕ 는 "닫기" 버튼으로 읽히고 서비스 채점 기호와도 어긋났다)
 *
 * filled=false (기본) 는 비활성·토글 해제용 윤곽선 변형.
 * 오답노트 상세에서는 이 채움/윤곽 쌍을 문제 포함·제외 토글로도 쓴다.
 */
export function WrongNoteIcon({ size = 20, filled = false }: { size?: number; filled?: boolean }) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="1 1 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        {/* 노트 면에서 빗금을 도려낸다 (evenodd) — 채움 한 겹이라 작은 크기에서도 또렷하다 */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M7.1 3H14.9C16.336 3 17.5 4.164 17.5 5.6V16.4C17.5 17.836 16.336 19 14.9 19H7.1C5.664 19 4.5 17.836 4.5 16.4V5.6C4.5 4.164 5.664 3 7.1 3ZM13.002 7.602L14.098 8.698L8.698 14.098L7.602 13.002L13.002 7.602Z"
          fill="currentColor"
        />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="4.5" y="3" width="13" height="16" rx="2.6" />
      <path d="M13.3 8.7L8.7 13.3" />
    </svg>
  )
}
