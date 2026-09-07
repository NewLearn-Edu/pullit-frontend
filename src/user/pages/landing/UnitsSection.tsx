import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { ENGLISH_ABILITIES } from '@/user/data/englishAbilities'
import SectionHeading from './SectionHeading'
import { useFitScale } from './useFitScale'

/**
 * 콘텐츠 규모 섹션 (ver.2 · 3099-10403 "평가원 기조에 맞춘 문항과 해설 1.6만 개를 준비했어" · 2026-09-07 개정)
 * 좌: 그라데이션 카드 안 실제 문제 카드 캐러셀 — 가운데 큰 카드 1장 + 양옆에 살짝 보이는 작은 카드 2장.
 *     우측 리스트의 강조 줄이 한 칸 내려갈 때마다 카드도 한 장 넘어간다 (같은 단원을 가리킨다).
 * 우: 수학/영어 탭 + 소단원 리스트(자동 스크롤) + 보유 수치.
 * 수학 21개 소단원 · 영어 유형은 englishAbilities(정책 §4.2 단일 원천)에서 파생 — 표시 명칭 그대로.
 *
 * 카드 이미지는 단원별 실제 문항 1건(3점 위주)을 800×800 으로 잘라 둔 것 — assets/landing/units/{math|english}-NN.webp,
 * NN 은 아래 리스트 순서와 같다. 이미지를 바꾸려면 같은 이름으로 덮어쓰면 된다.
 */
const MATH_UNITS = [
  '지수·로그', '지수·로그함수', '삼각함수', '사인·코사인법칙', '등차·등비수열', '수열의 합', '수학적 귀납법',
  '함수의 극한', '함수의 연속', '미분계수', '도함수', '도함수 활용', '부정적분', '정적분', '정적분 활용',
  '순열·조합', '이항정리', '확률의 뜻·이용', '조건부확률', '확률분포', '통계적 추정',
]

const ENGLISH_TYPES = ENGLISH_ABILITIES.flatMap((a) => a.types)

// 단원 순서(01~) 로 정렬된 카드 이미지 — 파일명 NN 이 곧 인덱스
const CARD_IMAGES = import.meta.glob<string>('@/assets/landing/units/*.webp', { eager: true, import: 'default' })
const imagesFor = (subject: 'math' | 'english'): string[] =>
  Object.entries(CARD_IMAGES)
    .filter(([path]) => path.includes(`/${subject}-`))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, url]) => url)

const TABS = [
  { key: 'math', label: '수학', items: MATH_UNITS, images: imagesFor('math'), countLabel: `${MATH_UNITS.length}개 단원` },
  { key: 'english', label: '영어', items: ENGLISH_TYPES, images: imagesFor('english'), countLabel: `${ENGLISH_TYPES.length}개 유형` },
] as const

const ROW_H = 53
const ACTIVE_SLOT = 3 // 시안: 04 번째 줄이 강조
const STEP_MS = 1500
const STAGE_W = 608 // 시안 1000 레이아웃에서 카드 폭 (952 - 24 - 320)
const STAGE_H = 515

/**
 * 캐러셀 슬롯 배치 (시안 3107-15814 · 스테이지 608×515 기준 px).
 * 0 = 가운데 큰 카드(Container_question) · ±1 = 양옆으로 반쯤 나간 작은 카드 · ±2 = 화면 밖(투명, 다음 등장 대기).
 * 같은 단원 카드가 슬롯을 옮겨 가며 위치·크기가 보간되므로 "한 장씩 미는" 느낌이 난다.
 */
const SLOTS: Record<number, { left: number; top: number; w: number; h: number; r: number; shadow: string; z: number; opacity: number }> = {
  0: { left: (STAGE_W - 400) / 2, top: 77, w: 400, h: 374, r: 23, shadow: '0 76.5px 230px rgba(20,29,48,0.46)', z: 3, opacity: 1 },
  [-1]: { left: -191, top: 134, w: 278, h: 260, r: 16, shadow: '0 80px 160px rgba(20,29,48,0.17)', z: 2, opacity: 1 },
  1: { left: 521, top: 134, w: 278, h: 260, r: 16, shadow: '0 80px 160px rgba(20,29,48,0.17)', z: 2, opacity: 1 },
  [-2]: { left: -191 - 320, top: 134, w: 278, h: 260, r: 16, shadow: 'none', z: 1, opacity: 0 },
  2: { left: 521 + 320, top: 134, w: 278, h: 260, r: 16, shadow: 'none', z: 1, opacity: 0 },
}
const EASE = 'cubic-bezier(0.22,0.9,0.3,1)'

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

  // 강조 줄이 가리키는 단원 = 가운데 카드. 양옆은 이전·다음 단원 (끝에서는 순환)
  const unitIdx = active % n
  const cardTransition = animate
    ? `left 600ms ${EASE}, top 600ms ${EASE}, width 600ms ${EASE}, height 600ms ${EASE}, border-radius 600ms ${EASE}, opacity 400ms ease, box-shadow 600ms ease`
    : 'none'

  return (
    <section className="flex w-full flex-col items-center gap-[60px] py-[190px] max-xl:gap-[40px] max-xl:py-[120px] max-md:gap-[24px] max-md:py-[60px]">
      <SectionHeading eyebrow="평가원 기조에 맞춘">
        문항과 해설 <span className="text-primary">1.6만 개</span>를 준비했어
      </SectionHeading>

      <div className="flex w-full max-w-[1000px] items-stretch gap-[24px] px-[24px] max-md:flex-col max-md:px-lg">
        {/* 좌: 그라데이션 카드 + 문제 카드 캐러셀 — 데스크톱 px 로 그리고 폭에 맞춰 축소 */}
        <div
          ref={stageRef}
          className="relative h-[515px] min-w-0 flex-1 overflow-hidden rounded-[32px] bg-gradient-to-b from-[#ca4166] to-[#e1c6c6] max-md:h-[350px] max-md:w-full max-md:flex-none max-md:rounded-[25.6px]"
        >
          <div
            className="absolute left-1/2 top-0 origin-top"
            style={{ width: STAGE_W, height: STAGE_H, transform: `translateX(-50%) scale(${scale})` }}
          >
            {[-2, -1, 0, 1, 2].map((offset) => {
              const idx = (unitIdx + offset + n * 2) % n
              const s = SLOTS[offset]
              return (
                <div
                  // key 는 단원 — 슬롯이 바뀌어도 같은 엘리먼트가 이동해 위치·크기가 보간된다
                  key={`${tab}-${idx}`}
                  aria-hidden={offset !== 0}
                  className="absolute overflow-hidden bg-white"
                  style={{
                    left: s.left,
                    top: s.top,
                    width: s.w,
                    height: s.h,
                    borderRadius: s.r,
                    boxShadow: s.shadow,
                    zIndex: s.z,
                    opacity: s.opacity,
                    transition: cardTransition,
                  }}
                >
                  <img
                    src={current.images[idx]}
                    alt={offset === 0 ? `${current.items[idx]} 예시 문항` : ''}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 size-full object-cover object-top"
                  />
                </div>
              )
            })}
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
                transition: animate ? `transform 600ms ${EASE}` : 'none',
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
