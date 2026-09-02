import { useEffect, useMemo, useState } from 'react'
import WeaknessRadar from '@/user/components/WeaknessRadar/WeaknessRadar'
import SectionHeading from './SectionHeading'
import LandingUnitMap from './LandingUnitMap'

/**
 * 약점 레이더 섹션 (ver.2 · 2801-5471 "3문제만 풀어 어느 단원이 가장 약한지 보여줄게")
 * 다크 카드(952×620 · 폰 310) 안에서 레이더 → 단원 지도가 번갈아 슬라이드 (시안 타임라인).
 * 레이더는 가입 페이지와 같은 morph·펄스 애니메이션, 시나리오 순환은 RadarDemoCard 와 동일 리듬(1.6초).
 */
const UNIT_NAMES = [
  '지수·로그',
  '지수·로그함수',
  '삼각함수',
  '사인·코사인',
  '등차·등비',
  '수열의 합',
  '수학적 귀납법',
]

/** 시안(2801-5435) 점수를 기본으로, 데모 시나리오가 순환하며 morph */
const SCENARIOS: number[][] = [
  [62, 100, 36, 82, 60, 93, 60], // 기본 (ver.2 시안 점수)
  [62, 55, 62, 100, 56, 100, 56],
  [78, 55, 45, 88, 56, 100, 74],
  [62, 100, 62, 64, 82, 62, 56],
]

const RADAR_MS = 4800
const MAP_MS = 4800

export default function RadarSection() {
  const [scenarioIdx, setScenarioIdx] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setScenarioIdx((i) => (i + 1) % SCENARIOS.length), 1600)
    return () => clearInterval(timer)
  }, [])

  // 레이더 ↔ 단원 지도 교대 (시안 4.09초 루프를 읽을 수 있게 늘림)
  const [showMap, setShowMap] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShowMap((v) => !v), showMap ? MAP_MS : RADAR_MS)
    return () => clearTimeout(t)
  }, [showMap])

  const units = useMemo(
    () => UNIT_NAMES.map((name, i) => ({ name, score: SCENARIOS[scenarioIdx][i] })),
    [scenarioIdx],
  )

  const pane =
    'absolute inset-0 flex items-center justify-center transition-transform duration-[900ms] ease-[cubic-bezier(0.22,0.9,0.3,1)] motion-reduce:transition-none'

  return (
    <section
      id="product"
      className="flex w-full flex-col items-center gap-[60px] py-[140px] max-xl:gap-[40px] max-xl:py-[100px] max-md:gap-[24px] max-md:py-[60px]"
    >
      <SectionHeading eyebrow="3문제만 풀어">
        어느 단원이 <span className="text-primary">가장 약한지</span> 보여줄게
      </SectionHeading>

      <div className="w-full max-w-[1000px] px-[24px] max-md:px-lg">
        <div className="relative h-[620px] w-full overflow-hidden rounded-[32px] bg-[#23272b] max-xl:h-[520px] max-md:h-[310px] max-md:rounded-[16px]">
          <div
            className={`${pane} px-[40px] max-md:px-[12px]`}
            style={{ transform: showMap ? 'translateX(-110%)' : 'translateX(0)' }}
          >
            <WeaknessRadar dark units={units} className="w-full max-w-[620px] max-xl:max-w-[540px] max-md:max-w-[300px]" />
          </div>
          <div className={pane} style={{ transform: showMap ? 'translateX(0)' : 'translateX(110%)' }}>
            <LandingUnitMap className="size-full" />
          </div>
        </div>
      </div>
    </section>
  )
}
