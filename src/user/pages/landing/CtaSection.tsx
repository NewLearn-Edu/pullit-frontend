import { Link } from 'react-router-dom'

export default function CtaSection() {
  return (
    <section className="flex w-full flex-col items-center justify-center bg-[rgba(18,20,23,0.2)] py-[80px]">
      <div className="flex w-full max-w-[1280px] flex-col items-center gap-[24px] px-[40px] max-md:px-lg">
        <h2 className="break-keep text-center text-[60px] font-bold leading-[1.25] text-white max-xl:text-[40px] max-md:text-[32px]">
          풀잇은 <span className="text-primary">3문제</span>면
          <br />
          1등급 가능해
        </h2>
        <p className="pb-[20px] text-center text-[18px] text-[#d6d8db] max-xl:text-[16px]">
          무료. 광고 없는 약점 진단. 모든 해설까지 공짜.
        </p>
        <Link
          to="/start"
          className="flex items-center justify-center rounded-[10px] bg-primary px-[32px] py-[16px] text-[18px] font-semibold text-white drop-shadow-[0px_8px_15px_rgba(255,56,92,0.4)] transition-colors hover:bg-primary-hover max-xl:text-[16px]"
        >
          무료로 내 약점 진단받기 →
        </Link>
      </div>
    </section>
  )
}
