import HeroWordSwiper from './HeroWordSwiper'
import HeroPillCta from './HeroPillCta'

/**
 * 시안(2801-5437)의 소셜프루프 수치 — 실제 집계 API 가 없어 시안 값 그대로.
 * TODO(집계 연결): 진단 완료 수를 서버에서 받아 교체
 */
const DIAGNOSED_COUNT = '12,483명'

/** 히어로 (ver.2 · 2801-5437 / 폰 3194-6266) — 워딩 세로 스와이프 + 서브카피 + 소셜프루프 + 흰 pill CTA */
export default function HeroSection() {
  return (
    // min-h-[100svh] + 중앙 정렬 — 첫 화면 정가운데 (pt 는 고정 나브 보정 · 시안 pt180/pb120, 폰 pt120/pb60)
    <section className="landing-glow-hero relative flex min-h-[100svh] w-full flex-col items-center justify-center overflow-hidden pb-[120px] pt-[180px] max-md:min-h-0 max-md:pb-[60px] max-md:pt-[120px]">
      {/* relative — 글로우(::before, absolute)가 콘텐츠 위에 그려지지 않게 위 레이어로 */}
      <div className="relative flex w-full max-w-[1000px] flex-col items-center px-[31px] max-md:px-lg">
        <HeroWordSwiper />

        <p className="mt-[32px] text-center text-[40px] font-semibold text-white max-xl:text-[28px] max-md:mt-[16px] max-md:text-[20px]">
          하루 약점 <span className="text-[#ff4f6f]">3문제</span> 풀면 끝
        </p>

        <SocialProof />

        <div className="mt-[14px] max-md:mt-[12px]">
          <HeroPillCta label="무료로 약점 진단하기" />
        </div>
      </div>
    </section>
  )
}

/** "12,483명이 이미 약점 진단했어" — 검정 pill + 빨간 점 + 아래 꼬리 (시안 3116-16268) */
function SocialProof() {
  return (
    <div className="landing-proof relative mt-[40px] max-md:mt-[32px]">
      <div className="landing-proof-body flex items-center gap-[7px] rounded-[50px] bg-[#121417] p-[16px]">
        <span className="relative size-[14px] shrink-0 rounded-[7px] border border-primary bg-primary/40">
          <span className="absolute left-[3px] top-[3px] size-[6px] rounded-[3px] bg-primary" />
        </span>
        <p className="whitespace-nowrap text-[14px] leading-none max-md:text-[12px]">
          <span className="font-black text-primary">{DIAGNOSED_COUNT}</span>
          <span className="font-semibold text-white">이 이미 약점 진단했어</span>
        </p>
      </div>
      {/* 꼬리 — 45° 회전한 9px 사각형, 아래 CTA 를 가리킨다 */}
      <span className="absolute bottom-[-4px] left-1/2 size-[9px] -translate-x-1/2 rotate-45 rounded-[1.5px] bg-[#121417]" />
    </div>
  )
}
