import { Link, useLocation } from 'react-router-dom'
import { openEarlybirdForm } from '@/user/services/earlybird'

/**
 * 히어로·하단 CTA 공용 흰 pill 버튼.
 * 일반 랜딩(/)은 진단 퍼널(/start)로, /earlybird 에서만 "사전 신청하기"(구글폼)로.
 */
export default function HeroPillCta({ label }: { label: string }) {
  const earlybird = useLocation().pathname === '/earlybird'
  const pillClass =
    'flex items-center gap-[12px] rounded-full bg-white py-[16px] pl-[28px] pr-[14px] text-[17px] font-semibold text-[#121417] transition-transform hover:scale-[1.03] max-md:py-[13px] max-md:text-[15px]'

  if (earlybird) {
    return (
      <button type="button" onClick={openEarlybirdForm} className={pillClass}>
        사전 신청하기
        <ArrowBadge />
      </button>
    )
  }

  return (
    <Link to="/start" className={pillClass}>
      {label}
      <ArrowBadge />
    </Link>
  )
}

function ArrowBadge() {
  return (
    <span className="flex size-[32px] items-center justify-center rounded-full bg-[#121417] max-md:size-[28px]">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M3 11L11 3M11 3H4.6M11 3v6.4"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
