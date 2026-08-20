import HeroWordSwiper from './HeroWordSwiper'
import HeroPillCta from './HeroPillCta'

/** 히어로 (ver.2 · 2801-5435) — 워딩 세로 스와이프 + 서브카피 + 흰 pill CTA */
export default function HeroSection() {
  return (
    // min-h-[100svh] + 중앙 정렬 — 콘텐츠가 위로 몰리지 않고 첫 화면 정가운데에 온다 (pt 는 고정 나브 보정)
    <section className="landing-glow relative flex min-h-[100svh] w-full flex-col items-center justify-center overflow-hidden pb-[60px] pt-[90px] max-md:pb-[40px] max-md:pt-[70px]">
      {/* relative — 글로우(::before, absolute)가 콘텐츠 위에 그려지지 않게 위 레이어로 */}
      <div className="relative flex w-full max-w-[1280px] flex-col items-center gap-[56px] px-[40px] max-md:gap-[36px] max-md:px-lg">
        <HeroWordSwiper />

        <p className="text-center text-[34px] font-semibold text-white max-xl:text-[24px] max-md:text-[19px]">
          하루 약점 <span className="text-primary">3문제</span> 풀면 끝
        </p>

        <HeroPillCta label="무료로 약점 진단하기" />
      </div>
    </section>
  )
}
