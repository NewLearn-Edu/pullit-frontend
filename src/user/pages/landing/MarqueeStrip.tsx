import separator from '@/assets/landing/separator.svg'
import './landing.css'

const PHRASES = ['많이 풀지마, 필요한 것만 풀어', '수능은 풀잇']

/** 한 벌 분량 — 두 벌 이어붙여 -50% 이동 시 이음새 없이 루프 */
function TrackContent() {
  return (
    <>
      {Array.from({ length: 4 }).flatMap((_, i) =>
        PHRASES.map((phrase, j) => (
          <span key={`${i}-${j}`} className="flex items-center gap-[40px]">
            <img src={separator} alt="" className="size-[27px]" />
            <span className="whitespace-nowrap text-[18px] font-semibold text-white">
              {phrase}
            </span>
          </span>
        )),
      )}
    </>
  )
}

export default function MarqueeStrip() {
  return (
    <div className="w-full overflow-hidden bg-primary py-[24px]">
      <div className="landing-marquee-track flex w-max items-center gap-[40px]">
        <div className="flex items-center gap-[40px]">
          <TrackContent />
        </div>
        <div aria-hidden className="flex items-center gap-[40px]">
          <TrackContent />
        </div>
      </div>
    </div>
  )
}
