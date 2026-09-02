import HeroWordSwiper from './HeroWordSwiper'
import HeroPillCta from './HeroPillCta'

/** 하단 CTA (ver.2 · 2801-5645) — 히어로 워딩 스와이프를 한 번 더 반복하고 진단으로 보낸다 (소셜프루프 없음) */
export default function CtaSection() {
  return (
    <section className="landing-glow-cta relative flex w-full flex-col items-center justify-center overflow-hidden py-[260px] max-xl:py-[160px] max-md:pb-[140px] max-md:pt-[200px]">
      {/* relative — 글로우(::before, absolute)가 콘텐츠 위에 그려지지 않게 위 레이어로 */}
      <div className="relative flex w-full max-w-[1000px] flex-col items-center px-[31px] max-md:px-lg">
        <HeroWordSwiper />

        <p className="mt-[32px] text-center text-[40px] font-semibold text-white max-xl:text-[28px] max-md:mt-[16px] max-md:text-[20px]">
          하루 약점 <span className="text-[#ff4f6f]">3문제</span> 풀면 끝
        </p>

        <div className="mt-[100px] max-md:mt-[100px]">
          <HeroPillCta label="무료로 약점 진단하기" />
        </div>
      </div>
    </section>
  )
}
