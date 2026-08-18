import { Link } from 'react-router-dom'

const CHOICES = ['① 12', '② 14', '③ 16', '④ 18', '⑤ 21']

/** 히어로 문제카드 목업 (LD-HERO-TEST) */
function HeroProblemCard() {
  return (
    <div className="relative h-[512px] w-[420px] shrink-0 max-md:w-full">
      {/* 뒤에 비스듬히 깔린 코랄 백드롭 */}
      <div className="absolute -inset-x-[12px] -inset-y-[14px] rotate-[4.82deg] rounded-[40px] bg-primary" />

      {/* 흰 문제 카드 */}
      <div className="absolute inset-0 flex flex-col gap-[20px] overflow-hidden rounded-[40px] bg-white p-[32px]">
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-semibold text-[#121417]">지수와 로그</span>
        </div>

        {/* 진행바 (1/2) */}
        <div className="flex h-[6px] w-full items-center overflow-hidden rounded-[8px]">
          <div className="h-full flex-1 bg-primary" />
          <div className="h-full flex-1 bg-[#e5e7ea]" />
        </div>

        {/* 문제 본문 — 시험지 톤 (KoPub Batang + STIX 수식) */}
        <div className="flex flex-1 flex-col gap-[16px]">
          <p className="font-batang text-[16px] font-bold leading-relaxed text-[#121417]">
            자연수 n에 대하여{' '}
            <span className="font-['STIX_Two_Text'] not-italic">
              log₂(n-1) + log₂(13-n)
            </span>
            의 값이 자연수가 되도록 하는 모든 n의 값의 합을 S라 하자. S의 값은?
          </p>
          <div className="flex w-full items-start gap-[4px]">
            {CHOICES.map((choice) => (
              <span
                key={choice}
                className="flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-[8px] p-[8px] font-batang text-[16px] font-bold text-[#121417]"
              >
                {choice}
              </span>
            ))}
          </div>
        </div>

        <Link
          to="/start"
          className="flex w-full items-center justify-center rounded-[10px] bg-primary px-[32px] py-[12px] text-[16px] font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          3문제로 약점 확인하기
        </Link>
      </div>

      {/* 하단 플로팅 라이브 pill */}
      <div className="absolute bottom-[6%] left-1/2 flex -translate-x-1/2 items-center gap-[9px] rounded-full bg-[#211514] px-[16px] py-[11px] drop-shadow-[0px_12px_14px_rgba(24,15,14,0.24)]">
        <span className="relative size-[8px] rounded-[4px] bg-success">
          <span className="absolute -left-[5px] -top-[5px] size-[18px] rounded-[9px] border border-[rgba(45,212,160,0.28)]" />
        </span>
        <p className="whitespace-nowrap text-[13px]">
          <span className="font-extrabold text-success">12,483명</span>
          <span className="font-extrabold text-white">이 이미 풀었어요</span>
        </p>
      </div>
    </div>
  )
}

/** 1280 미만: 세로 스택 + 센터 정렬 (Figma 768~1280 프레임 기준) */
export default function HeroSection() {
  return (
    <section className="flex w-full items-center justify-center overflow-hidden bg-[rgba(18,20,23,0.2)] pb-[160px] pt-[240px] max-xl:pb-[80px] max-xl:pt-[120px]">
      <div className="flex w-full max-w-[1280px] flex-1 items-center justify-center gap-[24px] px-[40px] max-xl:flex-col max-xl:gap-[40px] max-md:px-lg">
        <div className="flex max-w-[1280px] flex-1 flex-col gap-[44px] max-xl:w-full max-xl:flex-none max-xl:items-center max-xl:gap-[40px] max-xl:text-center max-md:gap-[12px]">
          <div className="flex flex-col gap-[24px] break-keep max-md:gap-[12px]">
            <h1 className="flex flex-col gap-[8px] font-paperlogy text-[100px] font-bold leading-[1.1] max-md:text-[60px]">
              <span className="text-primary [text-shadow:0px_2px_30px_rgba(0,0,0,0.4)]">
                일단 풀어
              </span>
              <span className="text-white">1등급 가능해</span>
            </h1>
            <p className="text-[33px] font-semibold max-xl:text-[24px] max-md:text-[20px]">
              <span className="text-[#ff4f6f]">하루 약점 3문제</span>{' '}
              <span className="text-white">풀면 끝</span>
            </p>
          </div>
          <p className="text-[20px] max-xl:text-[16px]">
            <span className="font-semibold text-success">회원가입 없이</span>
            <span className="font-normal text-muted"> 내 약점부터 확인해봐</span>
          </p>
          <Link
            to="/start"
            className="flex w-fit items-center justify-center rounded-[20px] bg-primary px-[44px] py-[20px] text-[18px] font-semibold text-white drop-shadow-[0px_8px_15px_rgba(255,56,92,0.4)] transition-colors hover:bg-primary-hover max-md:mt-[16px] max-md:text-[16px] max-md:font-bold"
          >
            무료로 약점 확인하기
          </Link>
        </div>

        <HeroProblemCard />
      </div>
    </section>
  )
}
