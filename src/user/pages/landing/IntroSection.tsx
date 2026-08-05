import featureSelect from '@/assets/landing/feature-select.png'

/** 문제선별 소개 — 밝은 배경 섹션 */
export default function IntroSection() {
  return (
    <section className="flex w-full flex-col items-center justify-center gap-[40px] bg-surface py-[120px] max-md:py-[80px]">
      <div className="flex w-full max-w-[1280px] flex-col items-center gap-[16px] break-keep px-[40px] text-center max-md:px-lg">
        <h2 className="text-[60px] font-bold text-[#121417] max-xl:text-[40px] max-md:text-[32px]">
          아무 3문제나 주는게 아니야
        </h2>
        <p className="text-[33px] font-semibold text-[#80858b] max-xl:text-[24px] max-md:text-[20px]">
          네가 수능에서 틀릴 가능성이 높은 3문제만 골라 주는거야
        </p>
      </div>
      <img
        src={featureSelect}
        alt="약점 단원을 분석해 오늘 추천 문제를 고르는 과정"
        className="w-full max-w-[1120px] object-cover px-[40px] max-xl:max-w-[728px] max-md:px-lg"
      />
    </section>
  )
}
