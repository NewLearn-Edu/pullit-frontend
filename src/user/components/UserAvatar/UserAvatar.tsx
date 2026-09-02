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
  return (
    <img
      src={src || defaultAvatar}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
    />
  )
}
