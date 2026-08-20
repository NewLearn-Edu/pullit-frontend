import { useEffect, useState } from 'react'
import carouselDiagnosis from '@/assets/landing/carousel-diagnosis.png'
import carouselRadar from '@/assets/landing/carousel-radar.png'
import carouselReminder from '@/assets/landing/carousel-reminder.png'

/**
 * 추천 섹션 (ver.2 · "찾은 약점을 바탕으로 지금 필요한 문제만 추천해")
 * 좌측 488px 이미지 3장 자동 스와이프(피그마 2032-2 프레임 3장) + 우측 캡션 동기 전환.
 */
// TODO(카피 확정): 2·3번 캡션은 디자인에 1번만 있어 임시 작성 — 확정 카피로 교체
const SLIDES = [
  {
    image: carouselDiagnosis,
    alt: '약점 진단 결과 화면 — 지수·로그 62점',
    title: '약점 진단',
    desc: '각 단원에서 3문제만 풀면\n어디가 약한지 알 수 있어.',
  },
  {
    image: carouselRadar,
    alt: '약점 그래프 화면 — 단원별 점수 레이더',
    title: '약점 그래프',
    desc: '단원별 점수가 그래프로 쌓여서\n어디부터 풀지 바로 보여.',
  },
  {
    image: carouselReminder,
    alt: '매일 아침 7시 오늘의 문제 알림',
    title: '매일 알림',
    desc: '오늘의 3문제가 매일 도착해.\n흐름이 끊기지 않게 챙겨줄게.',
  },
]

const INTERVAL_MS = 4000

export default function RecommendSection() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  const slide = SLIDES[index]

  return (
    <section id="how" className="flex w-full flex-col items-center gap-[64px] px-[40px] py-[140px] max-xl:py-[90px] max-md:px-lg">
      <h2 className="break-keep text-center text-[24px] font-medium leading-[1.6] text-[#c8cbd0] max-md:text-[17px]">
        찾은 약점을 바탕으로
        <br />
        <span className="text-[44px] font-bold leading-[1.5] text-white max-xl:text-[34px] max-md:text-[24px]">
          지금 <span className="text-primary">필요한 문제</span>만 추천해
        </span>
      </h2>

      <div className="flex w-full max-w-[1000px] items-center gap-[80px] max-xl:flex-col max-xl:gap-[40px]">
        {/* 이미지 캐러셀 — 트랙 슬라이드 + 하단 도트. 좁은 화면에선 컨테이너 폭에 맞춰 줄어든다 */}
        <div className="flex w-full max-w-[488px] shrink-0 flex-col items-center gap-[20px] max-xl:shrink">
          <div className="w-full overflow-hidden rounded-[40px] max-md:rounded-[24px]">
            <div
              className="flex transition-transform duration-500 ease-[cubic-bezier(0.22,0.9,0.3,1)]"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {SLIDES.map((s) => (
                <img key={s.title} src={s.image} alt={s.alt} className="w-full shrink-0" />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-[8px]">
            {SLIDES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                aria-label={`${s.title} 보기`}
                onClick={() => setIndex(i)}
                className={`h-[8px] rounded-full transition-all duration-300 ${
                  i === index ? 'w-[22px] bg-primary/70' : 'w-[8px] bg-[#4a4f57]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* 캡션 — 슬라이드에 맞춰 전환 */}
        <div key={slide.title} className="landing-caption-in flex min-w-0 flex-1 flex-col items-center gap-[18px] text-center">
          <p className="text-[26px] font-bold text-white max-md:text-[20px]">{slide.title}</p>
          <p className="whitespace-pre-line break-keep text-[18px] leading-[1.7] text-[#c8cbd0] max-md:text-[15px]">
            {slide.desc}
          </p>
        </div>
      </div>
    </section>
  )
}
