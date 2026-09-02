import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import carouselDiagnosis from '@/assets/landing/carousel-diagnosis.webp'
import carouselRadar from '@/assets/landing/carousel-radar.webp'
import carouselReminder from '@/assets/landing/carousel-reminder.webp'
import SectionHeading from './SectionHeading'

/**
 * 추천 섹션 (ver.2 · 3044-10997 "찾은 약점을 바탕으로 지금 필요한 문제만 추천해")
 * 좌측 캡션 + 우측 488px 이미지, 둘 다 가로 슬라이드로 동기 전환 (시안 Container x: 0 → -488 → -976).
 * 폰(3194-6482)에선 캡션이 이미지 위로 올라간다.
 */
const SLIDES = [
  {
    image: carouselDiagnosis,
    alt: '약점 진단 결과 화면 — 순열·조합 62점',
    title: '약점 진단',
    desc: '각 단원에서 3문제만 풀면\n어디가 약한지 알 수 있어.',
  },
  {
    image: carouselRadar,
    alt: '약점 그래프 화면 — 단원별 점수 레이더',
    title: '약점 그래프 완성',
    desc: '단원별 약점 진단을 끝내면\n나의 약점 그래프가 완성돼.',
  },
  {
    image: carouselReminder,
    alt: '매일 아침 7시 오늘의 문제 알림',
    title: '추천 문제 제공',
    desc: '찾은 약점을 바탕으로\n지금 필요한 문제만 골라서 추천해줘.',
  },
]

const INTERVAL_MS = 4000

export default function RecommendSection() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  const trackStyle = { transform: `translateX(-${index * 100}%)` }

  return (
    <section
      id="how"
      className="flex w-full flex-col items-center gap-[60px] py-[190px] max-xl:gap-[40px] max-xl:py-[120px] max-md:gap-[24px] max-md:py-[60px]"
    >
      <SectionHeading eyebrow="찾은 약점을 바탕으로">
        지금 <span className="text-primary">필요한 문제</span>만 추천해
      </SectionHeading>

      <div className="flex w-full max-w-[1000px] items-start gap-[24px] px-[24px] max-md:flex-col max-md:px-[24px]">
        {/* 캡션 — 슬라이드와 같은 방향으로 흐른다 */}
        <div className="flex h-[488px] min-w-0 flex-1 overflow-hidden rounded-[32px] max-md:h-auto max-md:w-full max-md:flex-none">
          <div className="landing-slide-track flex h-full w-full" style={trackStyle}>
            {SLIDES.map((s) => (
              <div
                key={s.title}
                className="flex h-full w-full shrink-0 flex-col items-center justify-center gap-[24px] px-[16px] pb-[24px] pt-[32px] text-center text-white max-md:gap-[8px]"
              >
                <p className="text-[32px] font-bold max-xl:text-[26px] max-md:text-[24px]">{s.title}</p>
                <p className="whitespace-pre-line break-keep text-[24px] font-medium leading-[1.4] max-xl:text-[18px] max-md:text-[16px]">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 이미지 캐러셀 — 시안 프레임 3장(2032-2) + 하단 도트 */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-[20px] max-md:w-full max-md:flex-none">
          <div className="w-full overflow-hidden rounded-[32px] max-md:rounded-[25.6px]">
            <div className="landing-slide-track flex" style={trackStyle}>
              {SLIDES.map((s) => (
                <img key={s.title} src={s.image} alt={s.alt} className="w-full shrink-0" />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-[15.6px]">
            {SLIDES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                aria-label={`${s.title} 보기`}
                onClick={() => setIndex(i)}
                className={clsx(
                  'h-[9.4px] rounded-full transition-all duration-300',
                  i === index ? 'w-[18.75px] bg-gradient-to-b from-[#ca4166] to-[#e1c6c6]' : 'w-[9.4px] bg-[#f8f8f8]',
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
