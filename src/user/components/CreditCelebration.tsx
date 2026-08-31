import { type CSSProperties } from 'react'
import coinRewardSvg from '@/assets/coin-reward.svg'

/**
 * 크레딧 지급 축하 콘텐츠 (코인 스핀 + 콘페티 버스트 + 스태거 텍스트).
 *
 * 시안 두 곳이 같은 몸통을 쓴다:
 * - PI-SHEET-FIRST_CREDIT (Figma 2824-5720) — 첫 진단 완료, 결과 화면 시트
 * - PI-SHEET-SIGNUP-COMPLETE_CREDIT (Figma 3680-6615) — 회원가입 완료, 풀 뷰
 * 래퍼(시트/페이지)는 각자 갖고, 여기는 카드 안쪽 내용만 담당한다.
 */

/**
 * 콘페티 조각 — 최종 좌표는 시안 근사 그대로, fx/fy 는
 * "코인 중심 → 최종 위치" 버스트 비행의 시작 오프셋(최종 위치 기준 역벡터).
 */
const CONFETTI = [
  { left: 22, top: 41, w: 9, h: 4, rot: 14, br: 2, color: '#ff8e38', fx: 49, fy: 40, delay: 400 },
  { left: 37, top: 20, w: 6, h: 13, rot: -28, br: 4, color: '#7f58ff', fx: 36, fy: 57, delay: 460 },
  { left: 55, top: 29, w: 9, h: 9, rot: 42, br: 2, color: '#a5f086', fx: 16, fy: 50, delay: 380 },
  { right: 38, top: 20, w: 6, h: 11, rot: 34, br: 4, color: '#58a0ff', fx: -35, fy: 58, delay: 440 },
  { right: 21, top: 49, w: 10, h: 4, rot: 18, br: 2, color: '#ff9442', fx: -50, fy: 32, delay: 410 },
  { left: 16, top: 74, w: 10, h: 6, rot: 72, br: 4, color: '#60a5ff', fx: 55, fy: 6, delay: 490 },
  { right: 14, top: 82, w: 6, h: 7, rot: 110, br: 4, color: '#7f58ff', fx: -58, fy: -3, delay: 520 },
]

/**
 * 확인 버튼 단독 — 페이지형(가입 완료 뷰)에서 버튼을 화면 맨 아래(footer)에
 * 따로 둘 때 사용한다. fc-item 키프레임은 Content 의 <style> 이 깔아준다.
 */
export function CreditCelebrationButton({
  label = '확인',
  onConfirm,
}: {
  label?: string
  onConfirm: () => void
}) {
  return (
    <button
      type="button"
      onClick={onConfirm}
      className="fc-item flex h-[56px] w-full max-w-[620px] items-center justify-center rounded-[12px] bg-[#23272b] px-[24px] text-[16px] font-bold text-white transition-opacity hover:opacity-90 active:opacity-85"
      style={{ animationDelay: '700ms' }}
    >
      {label}
    </button>
  )
}

export function CreditCelebrationContent({
  title,
  titleId,
  amount = '5크레딧',
  message = '다음 단원도 약점 진단해봐',
  buttonLabel = '확인',
  withButton = true,
  onConfirm,
}: {
  title: string
  /** aria-labelledby 연결용 — 시트(dialog)에서 쓰면 전달 */
  titleId?: string
  amount?: string
  /** 빈 문자열("")이면 안내 문구 줄 자체를 그리지 않는다 (가입 완료 뷰) */
  message?: string
  buttonLabel?: string
  /** false = 버튼을 바깥(페이지 footer 등)에서 CreditCelebrationButton 으로 직접 배치 */
  withButton?: boolean
  onConfirm: () => void
}) {
  return (
    <>
      <style>{`
        @keyframes fc-fade { from { opacity: 0 } }
        /* 웹 팝업 — 아래에서 떠오르며 살짝 오버슈트 후 안착 (스프링) */
        @keyframes fc-card {
          0% { opacity: 0; transform: translateY(64px) scale(0.94) }
          55% { opacity: 1 }
          72% { transform: translateY(-8px) scale(1.015) }
          100% { opacity: 1; transform: translateY(0) scale(1) }
        }
        @keyframes fc-rise { from { transform: translateY(100%) } }
        @keyframes fc-coin {
          0% { transform: rotateY(0deg) scale(0.4); opacity: 0 }
          18% { opacity: 1 }
          100% { transform: rotateY(1080deg) scale(1); opacity: 1 }
        }
        @keyframes fc-conf {
          0% { transform: translate(var(--fx), var(--fy)) rotate(calc(var(--rot) - 200deg)) scale(0); opacity: 0 }
          35% { opacity: 1 }
          100% { transform: translate(0, 0) rotate(var(--rot)) scale(1); opacity: 1 }
        }
        /* 콘텐츠 스태거 — 카드 안착 후 타이틀 → 금액 → 안내 → 버튼 순서로 떠오른다 */
        @keyframes fc-item { from { opacity: 0; transform: translateY(14px) } }
        @keyframes fc-amount {
          0% { opacity: 0; transform: translateY(12px) scale(0.8) }
          70% { transform: translateY(-2px) scale(1.06) }
          100% { opacity: 1; transform: translateY(0) scale(1) }
        }
        .fc-conf { animation: fc-conf 650ms cubic-bezier(0.22, 1, 0.36, 1) both }
        .fc-item { animation: fc-item 420ms cubic-bezier(0.22, 1, 0.36, 1) both }
      `}</style>

      {/* 코인(3D 스핀 등장) + 콘페티(코인 중심에서 버스트 → 시안 좌표 안착) */}
      <div className="relative size-[151px]" aria-hidden>
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="fc-conf absolute"
            style={
              {
                left: c.left,
                right: c.right,
                top: c.top,
                width: c.w,
                height: c.h,
                borderRadius: c.br,
                background: c.color,
                animationDelay: `${c.delay}ms`,
                '--rot': `${c.rot}deg`,
                '--fx': `${c.fx}px`,
                '--fy': `${c.fy}px`,
              } as CSSProperties
            }
          />
        ))}
        <span className="absolute bottom-[19px] left-1/2 h-[15px] w-[73px] -translate-x-1/2 rounded-full bg-[#160f0e]/10 blur-[10px]" />
        {/* 센터링(래퍼)과 스핀(이미지)을 분리 — 애니메이션 transform 이 translate 를 덮어쓰지 않게.
            perspective 는 래퍼에 있어야 rotateY 가 납작한 좌우 찌그러짐이 아닌 3D 회전으로 보인다 */}
        <div className="absolute left-1/2 top-[calc(50%+7.5px)] -translate-x-1/2 -translate-y-1/2 [perspective:500px]">
          <img
            src={coinRewardSvg}
            alt=""
            className="size-[80px] animate-[fc-coin_1100ms_cubic-bezier(0.22,1,0.36,1)_340ms_both]"
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-[4px] text-[#121417]">
        <p
          id={titleId}
          className="fc-item text-[22px] font-semibold leading-[1.4]"
          style={{ animationDelay: '420ms' }}
        >
          {title}
        </p>
        <p className="animate-[fc-amount_460ms_cubic-bezier(0.22,1,0.36,1)_520ms_both] text-[32px] font-bold leading-none">
          {amount}
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-[24px]">
        {message && (
          <p
            className="fc-item text-center text-[16px] font-semibold leading-[1.4] text-[#121417]"
            style={{ animationDelay: '620ms' }}
          >
            {message}
          </p>
        )}
        {withButton && <CreditCelebrationButton label={buttonLabel} onConfirm={onConfirm} />}
      </div>
    </>
  )
}
