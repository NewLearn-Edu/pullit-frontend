/**
 * 오답노트 아이콘 — 북마크(책갈피) 형태 (Figma 2856-20799 헤더 아이콘 · 2026-09-02 교체).
 * 네비 세트(채움 집·막대·사람)와 같은 필드 스타일 · currentColor.
 *
 * filled=false (기본) 는 비활성·토글 해제용 윤곽선 변형.
 * 오답노트 상세에서는 이 채움/윤곽 쌍을 문제 포함·제외 토글로도 쓴다.
 * 경로는 시안 벡터(10×13.87)를 20 뷰박스 가운데에 놓은 것.
 */
const BOOKMARK =
  'M0 2.66667C0 1.73324 0 1.26653 0.155707 0.910017C0.292664 0.596408 0.511207 0.341442 0.780014 0.181658C1.0856 0 1.48564 0 2.28571 0H7.71429C8.51436 0 8.91443 0 9.22 0.181658C9.48879 0.341442 9.70736 0.596408 9.84429 0.910017C10 1.26653 10 1.73324 10 2.66667V12.865C10 13.7128 9.01114 14.176 8.35982 13.6332L5.64018 11.3668C5.26934 11.0578 4.73066 11.0578 4.35982 11.3668L1.64018 13.6332C0.988856 14.176 0 13.7128 0 12.865V2.66667Z'

export function WrongNoteIcon({ size = 20, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <g transform="translate(5 3)">
        {filled ? (
          <path d={BOOKMARK} fill="currentColor" />
        ) : (
          <path d={BOOKMARK} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        )}
      </g>
    </svg>
  )
}
