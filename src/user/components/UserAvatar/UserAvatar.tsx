import { useEffect, useState } from 'react'
import defaultAvatar from '@/assets/avatar-default.png'

interface UserAvatarProps {
  /** users.profile_image_url — null/미지정이면 기본 아바타 */
  src?: string | null
  size?: number
  alt?: string
}

/**
 * 프로필 아바타 — 커스텀 업로드 전까지 전원 기본 이미지 1종 (2026-08-30 결정).
 * profile_image_url 이 생기면(업로드 기능) 그 URL 을 우선 표시한다.
 */
export function UserAvatar({ src, size = 72, alt = '프로필 이미지' }: UserAvatarProps) {
  // 업로드는 됐는데 URL 을 못 읽는 경우(버킷 비공개·CloudFront 미설정 등) 깨진 이미지 아이콘 대신 기본 아바타 (2026-09-06)
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [src])
  return (
    <img
      src={!broken && src ? src : defaultAvatar}
      alt={alt}
      width={size}
      height={size}
      // Tailwind preflight 의 `img { height: auto }` 가 height 속성을 덮어써 세로 사진이 타원으로 늘어난다 → CSS 로 정사각 강제 (2026-09-07)
      style={{ width: size, height: size }}
      onError={() => setBroken(true)}
      className="shrink-0 rounded-full object-cover"
    />
  )
}
