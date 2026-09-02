import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import problemCard from '@/assets/landing/units-problem-card.png'
import iconClose from '@/assets/landing/icon-close.svg'
import { ENGLISH_ABILITIES } from '@/user/data/englishAbilities'
import SectionHeading from './SectionHeading'
import { useFitScale } from './useFitScale'

/**
 * 콘텐츠 규모 섹션 (ver.2 · 3044-10959 "평가원 기조에 맞춘 문항과 해설 1.6만 개를 준비했어")
 * 좌: 그라데이션 카드 안 폰 목업 + 문제 카드 3장 · 우: 수학/영어 탭 + 소단원 리스트(자동 스크롤) + 보유 수치.
 * 수학 21개 소단원 · 영어 유형은 englishAbilities(정책 §4.2 단일 원천)에서 파생 — 표시 명칭 그대로.
 */
const MATH_UNITS = [
  '지수·로그', '지수·로그함수', '삼각함수', '사인·코사인법칙', '등차·등비수열', '수열의 합', '수학적 귀납법',
  '함수의 극한', '함수의 연속', '미분계수', '도함수', '도함수 활용', '부정적분', '정적분', '정적분 활용',
  '순열·조합', '이항정리', '확률의 뜻·이용', '조건부확률', '확률분포', '통계적 추정',
]

const ENGLISH_TYPES = ENGLISH_ABILITIES.flatMap((a) => a.types)

const TABS = [
  { key: 'math', label: '수학', items: MATH_UNITS, countLabel: `${MATH_UNITS.length}개 단원` },
  { key: 'english', label: '영어', items: ENGLISH_TYPES, countLabel: `${ENGLISH_TYPES.length}개 유형` },
] as const

const ROW_H = 53
const ACTIVE_SLOT = 3 // 시안: 04 번째 줄이 강조
const STEP_MS = 1500
const STAGE_W = 608 // 시안 1000 레이아웃에서 카드 폭 (952 - 24 - 320)

export default function UnitsSection() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('math')
  const current = TABS.find((t) => t.key === tab)!
  const n = current.items.length

  // 강조 줄이 4번째 슬롯에 고정된 채 리스트가 한 줄씩 올라간다 — 끝에 닿으면 소리 없이 되감기
  const [active, setActive] = useState(ACTIVE_SLOT)
  const [animate, setAnimate] = useState(true)
  useEffect(() => {
    setActive(ACTIVE_SLOT)
  }, [tab])
  useEffect(() => {
    const timer = setInterval(() => setActive((a) => a + 1), STEP_MS)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (active < n + ACTIVE_SLOT) return
    const t = setTimeout(() => {
      setAnimate(false)
      setActive(ACTIVE_SLOT)
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)))
    }, 600)
    return () => clearTimeout(t)
  }, [active, n])

  const rows = [...current.items, ...current.items]
  const { ref: stageRef, scale } = useFitScale(STAGE_W)

  return (
    <section className="flex w-full flex-col items-center gap-[60px] py-[190px] max-xl:gap-[40px] max-xl:py-[120px] max-md:gap-[24px] max-md:py-[60px]">
      <SectionHeading eyebrow="평가원 기조에 맞춘">
        문항과 해설 <span className="text-primary">1.6만 개</span>를 준비했어
      </SectionHeading>

      <div className="flex w-full max-w-[1000px] items-stretch gap-[24px] px-[24px] max-md:flex-col max-md:px-lg">
        {/* 좌: 그라데이션 카드 + 폰 목업 + 문제 카드 — 데스크톱 px 로 그리고 폭에 맞춰 축소 */}
        <div
          ref={stageRef}
          className="relative h-[515px] min-w-0 flex-1 overflow-hidden rounded-[32px] bg-gradient-to-b from-[#ca4166] to-[#e1c6c6] max-md:h-[350px] max-md:w-full max-md:flex-none max-md:rounded-[25.6px]"
        >
          <div
            className="absolute left-1/2 top-0 origin-top"
            style={{ width: STAGE_W, height: 724, transform: `translateX(-50%) scale(${scale})` }}
          >
            {/* 폰 프레임 */}
            <div className="absolute left-1/2 top-[73.5px] h-[812px] w-[375px] -translate-x-1/2 overflow-hidden rounded-[40px] border-[20px] border-black/20 bg-white">
              <div className="flex items-center justify-between px-[20px] pb-[20px] pt-[44px]">
                <span className="text-[16px] font-semibold leading-[1.4] text-[#23272b]">수학</span>
                <div className="flex items-center gap-[8px]">
                  <span className="flex items-center gap-[4px] px-[8px] py-[4px]">
                    <span className="size-[8px] rounded-full bg-primary" />
                    <span className="text-[14px] font-medium leading-[1.4] text-[#80858b]">00:48</span>
                  </span>
                  <img src={iconClose} alt="" aria-hidden className="size-[24px]" />
                </div>
              </div>
            </div>

            {/* 문제 카드 3장 — 가운데 1장 + 양옆으로 19px 간격 */}
            {[-297, 0, 297].map((dx) => (
              <div
                key={dx}
                className="absolute top-[197.5px] h-[260px] w-[278px] overflow-hidden rounded-[16px] bg-white shadow-[0_80px_160px_rgba(20,29,48,0.17)]"
                style={{ left: `calc(50% - 139px + ${dx}px)` }}
              >
                <img src={problemCard} alt="" aria-hidden className="absolute left-[-1px] top-[-26px] w-[279px] max-w-none" />
              </div>
            ))}
          </div>
        </div>

        {/* 우: 탭 + 소단원 리스트 + 수치 */}
        <div className="flex h-[515px] w-[320px] shrink-0 flex-col gap-[16px] max-md:w-full">
          <div className="flex gap-[4px]" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={clsx(
                  'flex-1 border-b py-[12px] text-center text-[16px] font-semibold leading-[1.4] transition-colors',
                  tab === t.key ? 'border-white text-white' : 'border-transparent text-[#5e6368] hover:text-[#9aa0a8]',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden pt-[10px]">
            <div
              className="flex flex-col"
              style={{
                transform: `translateY(${-(active - ACTIVE_SLOT) * ROW_H}px)`,
                transition: animate ? 'transform 600ms cubic-bezier(0.22,0.9,0.3,1)' : 'none',
              }}
            >
              {rows.map((name, i) => {
                const isActive = i === active
                return (
                  <div
                    key={`${name}-${i}`}
                    className="relative flex h-[53px] shrink-0 items-center border-b border-white/[0.08] px-[4px]"
                  >
                    {isActive && <span className="absolute left-0 top-[14px] h-[24px] w-[3px] rounded-full bg-primary" />}
                    <span
                      className={clsx(
                        'w-[28px] pl-[8px] text-[11px] font-bold tracking-[-0.51px] transition-colors duration-500',
                        isActive ? 'text-[#ff607c]' : 'text-[#4e555e]',
                      )}
                    >
                      {String((i % n) + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={clsx(
                        'whitespace-nowrap text-[17px] font-semibold tracking-[-0.51px] transition-colors duration-500',
                        isActive ? 'text-white' : 'text-[#6f7781]',
                      )}
                    >
                      {name}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[84px] bg-gradient-to-b from-[#121417] to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[84px] bg-gradient-to-b from-transparent to-[#121417]" />
          </div>

          <div className="flex items-end justify-between py-[16px]">
            <span className="text-[16px] text-white">{current.countLabel}</span>
            <div className="flex flex-col items-end gap-[8px]">
              <span className="text-[14px] text-[#80858b]">보유 문항·해설</span>
              <span className="text-[28px] font-bold leading-none text-white">10,000+</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
