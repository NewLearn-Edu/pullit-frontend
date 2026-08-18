import { clsx } from 'clsx'
import logoApple from '@/assets/auth/logo-apple.svg'
import logoGoogle from '@/assets/auth/logo-google.svg'
import logoKakao from '@/assets/auth/logo-kakao.svg'
import logoNaver from '@/assets/auth/logo-naver.svg'

interface SocialLoginButtonsProps {
  onKakao: () => void
  onNaver: () => void
  onApple: () => void
  onGoogle: () => void
  /** 카카오 버튼 위 말풍선 배지 문구 — null 이면 숨김 (기본: 3초만에 가입) */
  badgeLabel?: string | null
  className?: string
}

/**
 * 소셜 로그인 원형 아이콘 행 (Figma 2824-5679 · 가입 유도/로그인 공용)
 * 카카오 · 네이버 · 애플 · 구글 순서 고정, 첫 버튼(카카오) 위에 말풍선 배지.
 * 로그인 시작 로직은 페이지가 소유한다 — 여기는 표시와 클릭 전달만.
 */
export default function SocialLoginButtons({
  onKakao,
  onNaver,
  onApple,
  onGoogle,
  badgeLabel = '3초만에 가입',
  className,
}: SocialLoginButtonsProps) {
  return (
    <div
      className={clsx(
        // 갭: 모바일 8px · 패드·웹 20px (행 폭 248px → 284px)
        'relative flex shrink-0 items-center justify-center gap-[8px] md:gap-[20px]',
        badgeLabel != null && 'pt-[36px]',
        className,
      )}
    >
      {badgeLabel != null && (
        // 배지 — 첫 버튼(카카오) 중심 위. 카카오 중심 = 행 중앙 - (행폭/2 - 28px)
        <div className="absolute left-[calc(50%-96px)] top-0 flex -translate-x-1/2 flex-col items-center md:left-[calc(50%-114px)]">
          <span className="whitespace-nowrap rounded-[8px] bg-[#121417] px-[10px] py-[5px] text-[12px] font-semibold leading-[1.4] text-white">
            {badgeLabel}
          </span>
          <span className="-mt-px size-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-[#121417]" />
        </div>
      )}

      <button
        type="button"
        onClick={onKakao}
        aria-label="카카오 로그인"
        className="flex size-[56px] items-center justify-center rounded-full bg-[#fee500] transition-opacity hover:opacity-90 active:opacity-85"
      >
        <img src={logoKakao} alt="" className="w-[20px]" />
      </button>

      <button
        type="button"
        onClick={onNaver}
        aria-label="네이버 로그인"
        className="flex size-[56px] items-center justify-center rounded-full bg-[#03c75a] transition-opacity hover:opacity-90 active:opacity-85"
      >
        {/* 원본 에셋이 상하 반전 상태로 내보내져 렌더 시 되돌린다 (Figma 프레임과 동일) */}
        <img src={logoNaver} alt="" className="size-[16px] -scale-y-100" />
      </button>

      <button
        type="button"
        onClick={onApple}
        aria-label="Apple로 로그인"
        className="flex size-[56px] items-center justify-center rounded-full bg-black transition-opacity hover:opacity-90 active:opacity-85"
      >
        <img src={logoApple} alt="" className="size-[20px]" />
      </button>

      <button
        type="button"
        onClick={onGoogle}
        aria-label="Google로 로그인"
        className="flex size-[56px] items-center justify-center rounded-full border border-[#ebedf0] bg-white transition-colors hover:bg-[#f7f8f9]"
      >
        <img src={logoGoogle} alt="" className="size-[18px]" />
      </button>
    </div>
  )
}
