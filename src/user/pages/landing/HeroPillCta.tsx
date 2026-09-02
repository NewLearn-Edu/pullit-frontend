import { Link, useLocation } from 'react-router-dom'
import iconArrow from '@/assets/landing/icon-arrow-cta.svg'
import { openEarlybirdForm } from '@/user/services/earlybird'
import { useUserStore } from '@/user/stores/userStore'

/**
 * 히어로·하단 CTA 공용 흰 pill 버튼 (시안 Button/Hero-CTA · p15 r46 · 폰 p12).
 * - /earlybird: "사전 신청하기" → 구글폼
 * - 로그인 상태: "문제 풀러 가기" → /home (미완주는 홈 가드가 /start 로 보낸다)
 * - 비로그인: 진단 퍼널(/start)
 */
export default function HeroPillCta({ label }: { label: string }) {
  const earlybird = useLocation().pathname === '/earlybird'
  const me = useUserStore((s) => s.me)
  const pillClass =
    'group flex items-center gap-[12px] rounded-[46px] bg-white p-[15px] pl-[20px] text-[16px] font-bold text-[#121417] transition-transform hover:scale-[1.03] max-md:p-[12px] max-md:pl-[16px] max-md:text-[14px]'

  if (earlybird) {
    return (
      <button type="button" onClick={openEarlybirdForm} className={pillClass}>
        사전 신청하기
        <ArrowBadge />
      </button>
    )
  }

  if (me) {
    return (
      <Link to="/home" className={pillClass}>
        문제 풀러 가기
        <ArrowBadge />
      </Link>
    )
  }

  return (
    <Link to="/start" className={pillClass}>
      {label}
      <ArrowBadge />
    </Link>
  )
}

/** 28px 검정 원 + 14px 화살표 2장 — 호버 시 우상단으로 빠지고 새 화살표가 좌하단에서 들어온다 */
function ArrowBadge() {
  return (
    <span className="landing-cta-arrow flex size-[28px] shrink-0 rounded-full bg-[#1c1f25]">
      <img src={iconArrow} alt="" aria-hidden />
      <img src={iconArrow} alt="" aria-hidden />
    </span>
  )
}
