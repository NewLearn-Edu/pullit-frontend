import HeroWordSwiper from './HeroWordSwiper'
import HeroPillCta from './HeroPillCta'

/** 하단 CTA (ver.2) — 히어로 워딩 스와이프를 한 번 더 반복하고 진단으로 보낸다 */
export default function CtaSection() {
  return (
    <section className="landing-glow relative flex w-full flex-col items-center justify-center overflow-hidden py-[180px] max-xl:py-[110px] max-md:py-[80px]">
      {/* relative — 글로우(::before, absolute)가 콘텐츠 위에 그려지지 않게 위 레이어로 */}
      <div className="relative flex w-full max-w-[1280px] flex-col items-center gap-[56px] px-[40px] max-md:gap-[36px] max-md:px-lg">
        <HeroWordSwiper />

        <p className="text-center text-[34px] font-semibold text-white max-xl:text-[24px] max-md:text-[19px]">
          하루 약점 <span className="text-primary">3문제</span> 풀면 끝
        </p>

        <HeroPillCta label="지금 약점 진단하기" />
      </div>
    </section>
  )
}
