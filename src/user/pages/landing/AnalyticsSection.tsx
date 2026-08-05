import gridLine from '@/assets/landing/grid-line.png'
import gridLine0 from '@/assets/landing/grid-line-0.svg'
import curveRecommended from '@/assets/landing/curve-recommended.svg'
import curveGeneral from '@/assets/landing/curve-general.png'
import chartDataPoints from '@/assets/landing/chart-data-points.svg'
import endpointGeneral from '@/assets/landing/endpoint-general.svg'

const METRICS = [
  { label: '평균 등급 상승', small: '3개월 만에', value: '2.4등급 상승 ↑' },
  { label: '약점 단원 정답률', small: '5주 만에', value: '48% → 89%' },
  { label: '평균 학습 시간', small: '하루', value: '10분' },
]

/** 학습 성과 차트 — 유동폭. 1280 미만에선 Y 라벨 숨김 (Figma 768~1280 프레임 기준) */
function LearningChart() {
  return (
    <div className="flex w-full flex-col gap-[32px]">
      <div className="w-full py-[12px]">
        <div className="flex w-full items-center gap-[44px]">
          {/* Y 라벨 — 데스크톱 전용 */}
          <div className="flex h-[343px] flex-col items-end justify-between text-[18px] font-semibold text-[#a6abb1] max-xl:hidden max-md:h-[268px]">
            <p>+3.0</p>
            <p>+2.0</p>
            <p>+1.5</p>
            <p>+0.5</p>
            <p>0</p>
          </div>

          {/* 플롯 영역 */}
          <div className="relative h-[343px] min-w-0 flex-1 max-md:h-[268px]">
            {/* 그리드 */}
            <div className="flex h-full w-full flex-col items-start justify-between">
              {[0, 1, 2, 3].map((i) => (
                <img key={i} src={gridLine} alt="" className="h-px w-full" />
              ))}
              <img src={gridLine0} alt="" className="h-px w-full" />
            </div>

            {/* 일반 학습 곡선 (회색) */}
            <img
              src={curveGeneral}
              alt=""
              className="absolute left-0 top-[81%] w-full -rotate-2"
            />
            {/* 약점 추천 학습 곡선 (코랄) */}
            <img src={curveRecommended} alt="" className="absolute inset-0 size-full" />
            {/* 데이터 포인트 */}
            <img src={chartDataPoints} alt="" className="absolute inset-0 size-full" />
            {/* 일반 학습 종점 */}
            <img
              src={endpointGeneral}
              alt=""
              className="absolute right-0 top-[81.5%] size-[16px]"
            />

            {/* 뱃지 */}
            <div className="absolute -right-[8px] -top-[34px] rounded-[13px] bg-primary px-[20px] py-[12px] drop-shadow-[0px_5px_8px_rgba(255,56,92,0.33)]">
              <p className="whitespace-nowrap text-[18px] font-bold text-white">약점 추천 학습</p>
            </div>
            <div className="absolute right-[4%] top-[91%] rounded-[11px] bg-[#40464c] px-[20px] py-[8px]">
              <p className="whitespace-nowrap text-[18px] font-semibold text-[#e5e7ea]">
                일반 학습
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* X 라벨 */}
      <div className="flex w-full items-start justify-between pl-[80px] text-[20px] font-semibold text-[#a6abb1] max-xl:pl-0 max-xl:text-[18px]">
        <p>시작</p>
        <p className="text-center">1개월</p>
        <p className="text-center">2개월</p>
        <p className="text-right">3개월</p>
      </div>
    </div>
  )
}

export default function AnalyticsSection() {
  return (
    <section className="flex w-full flex-col items-center justify-center bg-[rgba(18,20,23,0.2)] py-[120px] max-md:py-[80px]">
      <div className="flex w-full max-w-[1280px] flex-col items-center justify-center gap-[40px] px-[40px] max-md:px-lg">
        <h2 className="break-keep text-center text-[60px] font-bold leading-[1.25] text-white max-xl:text-[52px] max-md:text-[32px]">
          하루 3문제
          <br />
          평균 등급이 달라져
        </h2>

        <div className="flex w-full flex-col items-center justify-center gap-[40px] overflow-hidden rounded-[28px] bg-[#23272b] px-[48px] pb-[48px] pt-[80px] max-md:gap-[24px] max-md:px-[24px]">
          <LearningChart />

          {/* 메트릭 3종 — 1280 미만 세로 스택 */}
          <div className="flex w-full items-start gap-[24px] max-xl:flex-col">
            {METRICS.map((m) => (
              <div
                key={m.label}
                className="flex flex-1 items-center justify-between overflow-hidden rounded-[12px] bg-black p-[24px] max-xl:w-full max-xl:flex-none"
              >
                <p className="min-w-0 flex-1 text-[20px] text-[#5e6368] max-xl:text-[18px]">
                  {m.label}
                </p>
                <div className="flex flex-col items-end justify-center gap-[4px] whitespace-nowrap text-center">
                  <p className="text-[16px] text-[#5e6368]">{m.small}</p>
                  <p className="text-[24px] font-bold text-primary max-xl:text-[22px]">{m.value}</p>
                </div>
              </div>
            ))}
          </div>

          <ul className="w-full list-disc pl-[24px] text-[16px] text-[#a6abb1] max-md:list-inside max-md:pl-0 max-md:text-center">
            <li>베타 기간(26.03~26.07) 풀잇 사용자 기준 평균 변화</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
