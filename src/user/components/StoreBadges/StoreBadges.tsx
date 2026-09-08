import { isStandaloneApp } from '@/user/utils/standalone'

/**
 * 앱 스토어 배지 — App Store · Google Play (2026-09-08).
 *
 * 두 배지는 항상 나란히 그린다. 다만 스토어 URL 이 아직 없는 쪽은 링크를 걸지 않고 그림만 둔다 —
 * 미출시 스토어로 보내 404 를 만드는 대신 자리와 균형은 유지한다. URL 이 생기면 그때 링크가 붙는다.
 * 이미 앱에서 열었으면(standalone·래퍼) 받으라고 할 이유가 없어 통째로 숨긴다.
 *
 * 이미지는 공식 배지 원본 그대로다 (public/badges) — 브랜드 가이드상 다시 그리거나 색·비율을
 * 고칠 수 없다. 두 배지는 내부 비율이 다르다: 구글 PNG 는 클리어스페이스가 파일에 포함돼 있고
 * 배지 높이 대비 글자도 애플보다 작다. 그래서 로고 테두리 높이를 맞추면(1.22 배) 글자가 눈에 띄게
 * 달라 보인다. 나란히 뒀을 때 읽히는 건 글자 크기라 글자 기준으로 맞춘다 — 1.35 배(40 → 54 · 34 → 46).
 * 테두리는 구글이 살짝 높아지지만 한 세트로 보이는 데는 지장이 없다 (2026-09-08 렌더 비교).
 * - App Store: https://developer.apple.com/app-store/marketing/guidelines/ko/
 * - Google Play: https://play.google.com/intl/ko/badges/
 */

/** 스토어 링크 — 빈 문자열로 두면 그 배지는 링크 없이 그림만 나온다 */
const APP_STORE_URL =
  import.meta.env.VITE_APP_STORE_URL ?? 'https://apps.apple.com/kr/app/id6806731002'
const PLAY_STORE_URL =
  import.meta.env.VITE_PLAY_STORE_URL ??
  'https://play.google.com/store/apps/details?id=com.newlearn.pullit'

export function StoreBadges({ className = '' }: { className?: string }) {
  if (isStandaloneApp()) return null

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      // 부모(인트로)가 클릭을 "연출 스킵"으로 받으므로 배지 탭은 여기서 멈춘다
      onClick={(e) => e.stopPropagation()}
      className={`flex items-center justify-center gap-[8px] ${className}`}
    >
      <Badge
        href={APP_STORE_URL}
        src="/badges/app-store-ko.svg"
        alt="App Store에서 다운로드하기"
        label="App Store 에서 풀잇 받기"
        size="h-[40px] max-md:h-[34px]"
      />
      <Badge
        href={PLAY_STORE_URL}
        src="/badges/google-play-ko.png"
        alt="Google Play에서 다운로드"
        label="Google Play 에서 풀잇 받기"
        size="h-[54px] max-md:h-[46px]"
      />
    </div>
  )
}

/** 배지 하나 — href 가 있으면 링크, 없으면(미출시) 같은 그림을 링크 없이 둔다 */
function Badge({
  href,
  src,
  alt,
  label,
  size,
}: {
  href: string
  src: string
  alt: string
  label: string
  size: string
}) {
  const image = <img src={src} alt={alt} className={`block ${size}`} />
  if (!href) return image
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" aria-label={label}>
      {image}
    </a>
  )
}
