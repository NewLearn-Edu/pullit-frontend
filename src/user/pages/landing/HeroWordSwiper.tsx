import { useCallback, useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'

/**
 * 히어로 워딩 세로 자동 스와이프 (ver.2 시안 2801-5435 · 3194-6266).
 *
 * "쉬는 시간에 / 지하철에서 / 학원 가기 전에 / 버스에서" 단어만 위로 흐르고,
 * 빨간 "15분" 은 세로로 고정된 채 옆에 붙는다. [단어][15분] 묶음 전체가
 * 가운데 정렬 — 단어 폭이 바뀌면 뷰포트 폭이 함께 애니메이션돼
 * 간격이 벌어지지 않고 15분이 부드럽게 따라온다.
 *
 * 시안 수치: 활성 줄 100px Bold 흰색, 위·아래 프리뷰 줄은 60px(0.6배) Black 그라데이션 28%,
 * 그 바깥 줄은 88px(0.88배) 10%·3% 블러. "15분"은 108px(1.08배) + 텍스트 섀도.
 */
const PHRASES = ['쉬는 시간에', '지하철에서', '학원 가기 전에', '버스에서']
const INTERVAL_MS = 2600
const SLIDE_MS = 650

/** 활성 줄과의 거리별 프리뷰 스타일 (시안 Container opacity/blur 그대로) */
const ROW_STYLE: Record<number, { scale: number; opacity: number; blur: number; weight: number }> = {
  0: { scale: 1, opacity: 1, blur: 0, weight: 700 },
  1: { scale: 0.6, opacity: 0.28, blur: 0, weight: 900 },
  2: { scale: 0.88, opacity: 0.1, blur: 0.6, weight: 900 },
}
const ROW_FAR = { scale: 0.88, opacity: 0.03, blur: 1, weight: 900 }

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

  // 앞뒤로 2줄씩 여유 — 뷰포트(3줄) 바깥 줄도 마스크 끝에서 희미하게 비친다
  const track = [
    PHRASES[PHRASES.length - 2],
    PHRASES[PHRASES.length - 1],
    ...PHRASES,
    PHRASES[0],
    PHRASES[1],
    PHRASES[2],
  ]
  const activeTrackIndex = step + 2
  const activeWidth = widths[step % PHRASES.length]

  const ease = 'cubic-bezier(0.22,0.9,0.3,1)'
  const rowTransition = animate
    ? `transform ${SLIDE_MS}ms ${ease}, opacity ${SLIDE_MS}ms ease, filter ${SLIDE_MS}ms ease`
    : 'none'

  return (
    <div
      aria-label={`${PHRASES[step % PHRASES.length]} 15분`}
      className="landing-swiper relative flex w-full items-center justify-center gap-[0.2em] text-[100px] font-bold leading-none tracking-[-0.02em] max-xl:text-[72px] max-md:text-[clamp(32px,10.5vw,50px)]"
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
          transition: animate ? `width ${SLIDE_MS}ms ${ease}` : 'none',
        }}
      >
        <div
          className="absolute inset-x-0 top-0"
          style={{
            transform: `translateY(calc(var(--row-h) * ${-(activeTrackIndex - 1)}))`,
            transition: animate ? `transform ${SLIDE_MS}ms ${ease}` : 'none',
          }}
        >
          {track.map((phrase, i) => {
            const dist = Math.abs(i - activeTrackIndex)
            const s = ROW_STYLE[dist] ?? ROW_FAR
            return (
              <div
                key={`${phrase}-${i}`}
                className="flex h-[var(--row-h)] items-center justify-center whitespace-nowrap"
              >
                <span
                  className={clsx(
                    'landing-swiper-row inline-block',
                    i > activeTrackIndex && 'landing-swiper-row--below',
                    dist === 0 && 'landing-swiper-row--active',
                  )}
                  style={{
                    transform: `scale(${s.scale})`,
                    opacity: s.opacity,
                    filter: s.blur ? `blur(${s.blur}px)` : 'none',
                    fontWeight: s.weight,
                    letterSpacing: dist >= 2 ? '-0.065em' : undefined,
                    transition: rowTransition,
                  }}
                >
                  {phrase}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 고정 "15분" — 세로 위치·크기 고정, 단어 폭 변화만 부드럽게 따라온다 */}
      <span className="landing-swiper-fixed shrink-0 whitespace-nowrap text-[1.08em] text-primary">15분</span>
    </div>
  )
}
