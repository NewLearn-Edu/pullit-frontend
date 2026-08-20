import { useEffect, useMemo, useState } from 'react'
import WeaknessRadar from '@/user/components/WeaknessRadar/WeaknessRadar'

/**
 * 약점 레이더 섹션 (ver.2 · "3문제만 풀어 어느 단원이 가장 약한지 보여줄게")
 * 시안대로 다크 카드 배경 + 가입 페이지와 같은 morph·펄스 애니메이션 레이더.
 * 시나리오 순환은 RadarDemoCard 와 동일 리듬(1.6초), 라벨은 다크 배경용 밝은 톤.
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

export default function RadarSection() {
  const [scenarioIdx, setScenarioIdx] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setScenarioIdx((i) => (i + 1) % SCENARIOS.length), 1600)
    return () => clearInterval(timer)
  }, [])

  const units = useMemo(
    () => UNIT_NAMES.map((name, i) => ({ name, score: SCENARIOS[scenarioIdx][i] })),
    [scenarioIdx],
  )

  return (
    <section id="product" className="flex w-full flex-col items-center gap-[56px] px-[40px] py-[140px] max-xl:py-[90px] max-md:px-lg">
      <h2 className="break-keep text-center text-[24px] font-medium leading-[1.6] text-[#c8cbd0] max-md:text-[17px]">
        3문제만 풀어
        <br />
        <span className="text-[44px] font-bold leading-[1.5] text-white max-xl:text-[34px] max-md:text-[24px]">
          어느 단원이 <span className="text-primary">가장 약한지</span> 보여줄게
        </span>
      </h2>

      {/* 시안의 다크 라운드 카드 — 레이더는 여백을 넉넉히 두고 중앙 배치 */}
      <div className="flex w-full max-w-[1000px] items-center justify-center rounded-[32px] bg-[#1e2025] px-[40px] py-[64px] max-md:px-[12px] max-md:py-[32px]">
        <WeaknessRadar dark units={units} className="w-full max-w-[560px]" />
      </div>
    </section>
  )
}
