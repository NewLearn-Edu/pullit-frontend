import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrialFunnelGuard } from '@/user/hooks/useTrialFunnelGuard'

/**
 * 마케팅 진입용 시네마틱 인트로 (/start)
 *
 * 랜딩 "무료로 약점 확인하기" → 이 페이지 → 시작하기 → 과목 선택(/trial).
 * 카피 전체(4줄 + 버튼)가 한번에 딱 슬램 등장하고, 숫자만 슬롯머신처럼
 * 짧게 굴러 떨어진다: "하루 90분 → … → 15분", "9문제 → 6문제 → 3문제".
 * 숫자가 3에 딱 멈추는 순간(~0.6초) 화면이 울리고(셰이크 + 쇼크웨이브) 붉은 잔광이
 * 남는다 — 줄어드는 카운트다운 자체가 "뭐? 딱 이것만?" 이라는 카피의 메시지다.
 * 총 ~1초 완결. (순차 버전 원복: legacy/checkpoints/intro-v1-slot-sequential.tsx)
 *
 * 연출은 전부 CSS 타임라인(animation-delay) — 탭하면 즉시 최종 화면으로 스킵.
 * 게스트 세션은 여기서 만들지 않는다 — 과목 선택(/trial)의 "다음" 클릭에서 확보
 * (광고 링크 크롤러가 게스트를 양산하지 않게 명시적 상호작용에서만).
 */

/** 등장 슬램 — 크게 잡혔다가 블러가 걷히며 제자리에 박힌다 */
const SLAM = 'intro-anim animate-[intro-slam_520ms_cubic-bezier(0.19,1,0.22,1)_both]'

interface RollerProps {
  /** 슬롯 셀 — 마지막 셀이 최종값. 전 셀 글자수 동일해야 폭이 안 흔들린다 */
  cells: string[]
  /** 트랙 롤 keyframes 이름 (셀 수에 맞는 것) */
  animation: string
  /** 롤 시작 시점 (ms) */
  delay: number
  /** 최종 셀 강조 색 tailwind 클래스 */
  finalClassName: string
}

/** 슬롯머신 숫자 롤러 — 세로로 굴러 떨어지다 마지막 값에 스냅 */
function Roller({ cells, animation, delay, finalClassName }: RollerProps) {
  return (
    <>
      <span aria-hidden className="intro-roll">
        <span className={`intro-roll-track ${animation}`} style={{ animationDelay: `${delay}ms` }}>
          {cells.map((cell, i) => (
            <span key={cell} className={i === cells.length - 1 ? finalClassName : undefined}>
              {cell}
            </span>
          ))}
        </span>
      </span>
      <span className="sr-only">{cells[cells.length - 1]}</span>
    </>
  )
}

export default function TrialIntroPage() {
  const navigate = useNavigate()
  const [skipped, setSkipped] = useState(false)

  // 맛보기를 이미 완주한 회원만 홈으로 — 미완이면 방금 가입한 회원도 퍼널을 탄다
  // (내부의 useMe 는 조회 전용 loadMe 라 게스트를 만들지 않는다 — 크롤러 안전)
  useTrialFunnelGuard()

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      onClick={() => setSkipped(true)}
      className={`relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-black px-[24px] pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)] ${
        skipped ? 'intro-skip' : ''
      }`}
    >
      <style>{`
        @keyframes intro-slam {
          0% { opacity: 0; transform: scale(2.1); filter: blur(12px) }
          55% { opacity: 1; filter: blur(0) }
          72% { transform: scale(0.965) }
          100% { opacity: 1; transform: scale(1); filter: blur(0) }
        }
        /* 5칸 롤 — 틱이 점점 느려지다(슬롯 감속) 마지막에 살짝 넘겼다 되돌아온다 */
        @keyframes intro-roll5 {
          0%   { transform: translateY(0);        filter: blur(0) }
          20%  { transform: translateY(-1.12em);  filter: blur(3px) }
          40%  { transform: translateY(-2.24em);  filter: blur(3px) }
          62%  { transform: translateY(-3.36em);  filter: blur(2px) }
          86%  { transform: translateY(-4.62em);  filter: blur(0) }
          100% { transform: translateY(-4.48em);  filter: blur(0) }
        }
        @keyframes intro-roll3 {
          0%   { transform: translateY(0);        filter: blur(0) }
          38%  { transform: translateY(-1.12em);  filter: blur(3px) }
          80%  { transform: translateY(-2.36em);  filter: blur(0) }
          100% { transform: translateY(-2.24em);  filter: blur(0) }
        }
        /* "3문제" 착지 임팩트 — 화면 울림 + 쇼크웨이브 링 + 붉은 섬광 */
        @keyframes intro-shake {
          0%, 100% { transform: translate(0, 0) }
          12% { transform: translate(-8px, 4px) }
          28% { transform: translate(7px, -5px) }
          44% { transform: translate(-5px, 3px) }
          62% { transform: translate(3px, -2px) }
          80% { transform: translate(-2px, 1px) }
        }
        /* 0% 는 반드시 opacity 0 — fill:both 라 딜레이 동안 첫 프레임이 화면에 남는다 */
        @keyframes intro-shock {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.2) }
          8% { opacity: 0.8 }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(2.4) }
        }
        @keyframes intro-flash {
          0%, 100% { opacity: 0 }
          25% { opacity: 1 }
        }
        @keyframes intro-fade { from { opacity: 0 } }
        @keyframes intro-rise { from { opacity: 0; transform: translateY(16px) } }

        .intro-roll {
          display: inline-block;
          overflow: hidden;
          height: 1.12em;
          line-height: 1.12;
          vertical-align: -0.18em;
        }
        .intro-roll-track { display: block; will-change: transform }
        .intro-roll-track > span {
          display: block;
          height: 1.12em;
          line-height: 1.12;
          text-align: center;
          font-variant-numeric: tabular-nums; /* 셀 간 숫자 폭 통일 — 착지 후 마침표 틈 방지 */
        }

        /* 탭 스킵 · 모션 최소화 — 전 타임라인을 즉시 최종 프레임으로 */
        .intro-skip .intro-anim, .intro-skip .intro-anim * {
          animation-duration: 0ms !important;
          animation-delay: 0ms !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .intro-anim, .intro-anim * {
            animation-duration: 0ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      {/* 임팩트 이후 남는 붉은 잔광 — 바닥 쪽에서 은은하게 */}
      <div
        aria-hidden
        style={{ animationDelay: '620ms' }}
        className="intro-anim pointer-events-none absolute inset-0 animate-[intro-fade_1400ms_ease_both] bg-[radial-gradient(58%_46%_at_50%_62%,rgba(255,56,92,0.13),transparent_70%)]"
      />
      {/* 착지 섬광 */}
      <div
        aria-hidden
        style={{ animationDelay: '620ms' }}
        className="intro-anim pointer-events-none absolute inset-0 animate-[intro-flash_450ms_ease-out_both] bg-[radial-gradient(50%_40%_at_50%_46%,rgba(255,56,92,0.2),transparent_72%)]"
      />

      {/* 카피 스택 — "3문제" 착지 순간 통째로 울린다 */}
      <div
        style={{ animationDelay: '620ms' }}
        className="intro-anim relative flex w-full max-w-[760px] animate-[intro-shake_380ms_linear_both] flex-col items-center gap-[18px] text-center max-md:gap-[14px]"
      >
        <p
          style={{ animationDelay: '100ms' }}
          className={`${SLAM} break-keep text-[24px] font-semibold leading-[1.25] text-[#b7bbc2] max-md:text-[19px]`}
        >
          수학 영어, 하루{' '}
          <Roller
            cells={['90분', '60분', '45분', '30분', '15분']}
            animation="animate-[intro-roll5_450ms_cubic-bezier(0.3,0,0.2,1)_both]"
            delay={150}
            finalClassName="font-bold text-white"
          />
          .
        </p>

        <div className="relative">
          {/* 쇼크웨이브 링 */}
          <span
            aria-hidden
            style={{ animationDelay: '620ms' }}
            className="intro-anim pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[340px] animate-[intro-shock_620ms_cubic-bezier(0.22,0.9,0.3,1)_both] rounded-full border-2 border-[#ff385c]/70 max-md:h-[230px] max-md:w-[230px]"
          />
          <p
            style={{ animationDelay: '100ms' }}
            className={`${SLAM} relative break-keep font-paperlogy text-[92px] font-bold leading-[1.1] text-white max-md:text-[56px]`}
          >
            딱{' '}
            <Roller
              cells={['9문제', '6문제', '3문제']}
              animation="animate-[intro-roll3_420ms_cubic-bezier(0.3,0,0.2,1)_both]"
              delay={200}
              finalClassName="text-[#ff385c]"
            />
            .
          </p>
        </div>

        <p
          style={{ animationDelay: '100ms' }}
          className={`${SLAM} break-keep text-[30px] font-bold leading-[1.25] text-[#ff385c] max-md:text-[23px]`}
        >
          너의 약점만 골라서 준다.
        </p>

        <p
          style={{ animationDelay: '100ms' }}
          className={`${SLAM} mt-[36px] break-keep text-[24px] font-semibold leading-[1.25] text-white max-md:mt-[26px] max-md:text-[19px]`}
        >
          그럼, 시작한다.
        </p>
      </div>

      <div className="relative mt-[44px] h-[56px] max-md:mt-[34px]">
        <button
          type="button"
          onClick={() => navigate('/trial')}
          style={{ animationDelay: '100ms' }}
          className="intro-anim h-[56px] w-[280px] animate-[intro-rise_460ms_cubic-bezier(0.22,0.9,0.3,1)_both] rounded-[14px] bg-[#ff385c] text-[17px] font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] max-md:w-[240px]"
        >
          시작하기
        </button>
      </div>
    </div>
  )
}
