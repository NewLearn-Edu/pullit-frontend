import { useEffect, useState } from 'react'
import { fetchLandingStats } from '@/user/api/statsApi'
import HeroWordSwiper from './HeroWordSwiper'
import HeroPillCta from './HeroPillCta'

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

/**
 * "12,483문제를 바로 풀어볼 수 있어" — 검정 pill + 빨간 점 + 아래 꼬리 (시안 3116-16268)
 *
 * 수치는 서버 실집계(ACTIVE 문항 수)다 — 시안의 하드코딩 값을 쓰면 사실과 다른 소셜프루프가 된다.
 * 집계 전·실패 시엔 invisible 로 자리만 잡아 둔다: 안 그리면 아래 CTA 가 위로 튀고,
 * 0 을 그리면 잘못된 수치가 한 프레임 노출된다.
 */
function SocialProof() {
  const [problemCount, setProblemCount] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    fetchLandingStats()
      .then((stats) => {
        if (alive) setProblemCount(stats.problemCount)
      })
      // 지표 하나 때문에 히어로가 깨지지는 않게 — 조용히 숨긴 채 둔다
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const pending = problemCount == null
  return (
    <div
      className={`landing-proof relative mt-[40px] max-md:mt-[32px] ${pending ? 'invisible' : ''}`}
      aria-hidden={pending}
    >
      <div className="landing-proof-body flex items-center gap-[7px] rounded-[50px] bg-[#121417] p-[16px]">
        <span className="relative size-[14px] shrink-0 rounded-[7px] border border-primary bg-primary/40">
          <span className="absolute left-[3px] top-[3px] size-[6px] rounded-[3px] bg-primary" />
        </span>
        <p className="whitespace-nowrap text-[14px] leading-none max-md:text-[12px]">
          <span className="font-black text-primary">
            {(problemCount ?? 0).toLocaleString()}문제
          </span>
          <span className="font-semibold text-white">를 바로 풀어볼 수 있어</span>
        </p>
      </div>
      {/* 꼬리 — 45° 회전한 9px 사각형, 아래 CTA 를 가리킨다 */}
      <span className="absolute bottom-[-4px] left-1/2 size-[9px] -translate-x-1/2 rotate-45 rounded-[1.5px] bg-[#121417]" />
    </div>
  )
}
