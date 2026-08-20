import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 히어로 워딩 세로 자동 스와이프 (ver.2 시안 2801-5435).
 *
 * "쉬는 시간에 / 지하철에서 / 학원 가기 전에 / 버스에서" 단어만 위로 흐르고,
 * 빨간 "15분" 은 세로로 고정된 채 옆에 붙는다. [단어][15분] 묶음 전체가
 * 가운데 정렬 — 단어 폭이 바뀌면 뷰포트 폭이 함께 애니메이션돼
 * 간격이 벌어지지 않고 15분이 부드럽게 따라온다.
 */
const PHRASES = ['쉬는 시간에', '지하철에서', '학원 가기 전에', '버스에서']
const INTERVAL_MS = 2600
const SLIDE_MS = 650

export default function HeroWordSwiper() {
  const [step, setStep] = useState(0)
  const [animate, setAnimate] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => s + 1), INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  // 한 바퀴(n)를 넘어가면 애니메이션이 끝난 뒤 소리 없이 0으로 되감기
  useEffect(() => {
    if (step < PHRASES.length) return
    const t = setTimeout(() => {
      setAnimate(false)
      setStep(0)
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)))
    }, SLIDE_MS)
    return () => clearTimeout(t)
  }, [step])

  // 문구별 실제 폭 측정 — 뷰포트 폭 애니메이션용 (리사이즈·폰트 로드 후 재측정)
  const measurerRef = useRef<HTMLDivElement>(null)
  const [widths, setWidths] = useState<number[]>([])
  const measure = useCallback(() => {
    const spans = measurerRef.current?.children
    if (!spans) return
    setWidths(Array.from(spans).map((el) => (el as HTMLElement).offsetWidth))
  }, [])
  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    document.fonts?.ready.then(measure).catch(() => {})
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const track = [PHRASES[PHRASES.length - 1], ...PHRASES, PHRASES[0], PHRASES[1]]
  const activeTrackIndex = step + 1
  const activeWidth = widths[step % PHRASES.length]

  const rowTransition = animate
    ? `transform ${SLIDE_MS}ms cubic-bezier(0.22,0.9,0.3,1), opacity ${SLIDE_MS}ms ease, filter ${SLIDE_MS}ms ease`
    : 'none'

  return (
    <div
      aria-label={`${PHRASES[step % PHRASES.length]} 15분`}
      className="relative flex w-full items-center justify-center gap-[0.25em] text-[110px] font-bold leading-none tracking-[-0.03em] max-xl:text-[72px] max-md:text-[32px]"
    >
      {/* 폭 측정용 히든 렌더 — 같은 폰트 크기를 상속받아 정확히 잰다 */}
      <div ref={measurerRef} aria-hidden className="invisible absolute left-0 top-0 -z-10">
        {PHRASES.map((phrase) => (
          <span key={phrase} className="inline-block whitespace-nowrap">
            {phrase}
          </span>
        ))}
      </div>

      {/* 단어 뷰포트 — 3줄 높이 + 위아래 페이드, 폭은 현재 단어에 맞춰 애니메이션 */}
      <div
        className="landing-swiper-mask relative h-[calc(var(--row-h)*3)] overflow-hidden"
        style={{
          width: activeWidth ? `${activeWidth}px` : 'auto',
          transition: animate ? `width ${SLIDE_MS}ms cubic-bezier(0.22,0.9,0.3,1)` : 'none',
        }}
      >
        <div
          className="absolute inset-x-0 top-0"
          style={{
            transform: `translateY(calc(var(--row-h) * ${-(activeTrackIndex - 1)}))`,
            transition: animate ? `transform ${SLIDE_MS}ms cubic-bezier(0.22,0.9,0.3,1)` : 'none',
          }}
        >
          {track.map((phrase, i) => {
            const active = i === activeTrackIndex
            return (
              <div
                key={`${phrase}-${i}`}
                className="flex h-[var(--row-h)] items-center justify-center whitespace-nowrap text-white"
                style={{
                  transform: active ? 'scale(1)' : 'scale(0.52)',
                  opacity: active ? 1 : 0.16,
                  filter: active ? 'none' : 'blur(1.5px)',
                  transition: rowTransition,
                }}
              >
                {phrase}
              </div>
            )
          })}
        </div>
      </div>

      {/* 고정 "15분" — 세로 위치·크기 고정, 단어 폭 변화만 부드럽게 따라온다 */}
      <span className="shrink-0 whitespace-nowrap text-primary">15분</span>
    </div>
  )
}
