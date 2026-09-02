import type { ReactNode } from 'react'

/**
 * 섹션 공용 헤딩 (ver.2) — 위 한 줄 Medium + 아래 한 줄 Bold, 둘 다 흰색.
 * 웹 40/46 · 패드 28/34 · 폰 16/24 (시안 3194-6264 폰 프레임 기준)
 */
export default function SectionHeading({ eyebrow, children }: { eyebrow: ReactNode; children: ReactNode }) {
  return (
    <h2 className="flex w-full max-w-[1000px] flex-col items-center gap-[20px] break-keep px-[24px] text-center text-white max-xl:gap-[12px] max-md:gap-[8px] max-md:px-lg">
      <span className="block text-[40px] font-medium leading-[1.25] max-xl:text-[28px] max-md:text-[16px]">
        {eyebrow}
      </span>
      <span className="block text-[46px] font-bold leading-[1.25] max-xl:text-[34px] max-md:text-[24px]">
        {children}
      </span>
    </h2>
  )
}
