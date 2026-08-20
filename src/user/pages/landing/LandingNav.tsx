import { Link, useLocation } from 'react-router-dom'
import logoNav from '@/assets/landing/logo-nav.svg'
import { openEarlybirdForm } from '@/user/services/earlybird'

export default function LandingNav() {
  // 얼리버드 UI 는 /earlybird 경로에서만 — 플래그가 아니라 URL 로 판정해
  // 일반 랜딩(/)이 얼리버드 모양으로 새지 않는다
  const earlybird = useLocation().pathname === '/earlybird'
  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex min-w-[350px] flex-col items-center justify-center bg-[rgba(15,16,19,0.55)] backdrop-blur-md">
      <div className="w-full max-w-[1600px]">
        <div className="flex items-center justify-between gap-[10px] px-[40px] py-[14px] max-md:px-lg max-md:py-[10px]">
          <Link to="/" aria-label="풀잇 홈" className="shrink-0">
            <img src={logoNav} alt="풀잇" className="h-[26px] w-[52px] max-md:h-[20px] max-md:w-[40px]" />
          </Link>

          <div className="flex shrink-0 items-center gap-[10px] max-md:gap-[6px]">
            {earlybird ? (
              // 얼리버드 테스트 — 로그인 없이 "사전 신청하기"(구글폼) 버튼 하나만
              <button
                type="button"
                onClick={openEarlybirdForm}
                className="flex items-center justify-center whitespace-nowrap rounded-[10px] bg-[#e8e9eb] px-[18px] py-[11px] text-[15px] font-semibold text-[#121417] transition-colors hover:bg-white max-md:px-[12px] max-md:py-[9px] max-md:text-[13px]"
              >
                사전 신청하기
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center justify-center whitespace-nowrap rounded-[10px] bg-[#26282d] px-[18px] py-[11px] text-[15px] font-semibold text-white transition-colors hover:bg-[#31343a] max-md:px-[12px] max-md:py-[9px] max-md:text-[13px]"
                >
                  로그인
                </Link>
                <Link
                  to="/start"
                  className="flex items-center justify-center whitespace-nowrap rounded-[10px] bg-[#e8e9eb] px-[18px] py-[11px] text-[15px] font-semibold text-[#121417] transition-colors hover:bg-white max-md:px-[12px] max-md:py-[9px] max-md:text-[13px]"
                >
                  무료로 약점 진단하기
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
