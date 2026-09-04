import { Link, useLocation } from 'react-router-dom'
import logoNav from '@/assets/landing/logo-nav.svg'
import { openEarlybirdForm } from '@/user/services/earlybird'
import { useMe } from '@/user/hooks/useMe'

/** 시안 3158-4457 — 반투명 검정 + 블러 20, 버튼 p12 r12, 로그인 회색 40% · CTA 흰색 40% */
const BTN = 'flex items-center justify-center whitespace-nowrap rounded-[12px] p-[12px] text-[16px] font-semibold text-white transition-colors max-md:text-[14px]'
const BTN_GHOST = `${BTN} bg-[rgba(64,70,76,0.4)] hover:bg-[rgba(64,70,76,0.65)]`
const BTN_CTA = `${BTN} bg-white/40 hover:bg-white/55`

export default function LandingNav() {
  // 얼리버드 UI 는 /earlybird 경로에서만 — 플래그가 아니라 URL 로 판정해
  // 일반 랜딩(/)이 얼리버드 모양으로 새지 않는다
  const earlybird = useLocation().pathname === '/earlybird'
  // 조회 전용(loadMe) — 세션 없는 방문자에게 게스트를 만들지 않는다
  const { me } = useMe()
  const displayName = me ? me.name ?? me.nickname ?? '회원' : null

  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex min-w-[350px] justify-center bg-black/10 pt-[var(--safe-top)] backdrop-blur-[20px]">
      <div className="flex w-full max-w-[1000px] items-center justify-between gap-[24px] px-[24px] py-[14px] max-md:px-lg">
        <Link to="/" aria-label="풀잇 홈" className="shrink-0">
          <img src={logoNav} alt="풀잇" className="h-[22px] w-[44px]" />
        </Link>

        <div className="flex shrink-0 items-center gap-[8px]">
          {earlybird ? (
            // 얼리버드 테스트 — 로그인 없이 "사전 신청하기"(구글폼) 버튼 하나만
            <button type="button" onClick={openEarlybirdForm} className={BTN_CTA}>
              사전 신청하기
            </button>
          ) : me ? (
            // 로그인 상태 — 프로필(이니셜 아바타 + 이름) + "문제 풀러 가기"
            <>
              <Link
                to="/my"
                className="flex items-center gap-[8px] rounded-[12px] px-[8px] py-[6px] transition-colors hover:bg-white/10"
                aria-label="마이페이지"
              >
                <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-[14px] font-bold text-white max-md:size-[26px] max-md:text-[12px]">
                  {displayName!.charAt(0)}
                </span>
                <span className="max-w-[120px] truncate whitespace-nowrap text-[15px] font-semibold text-white max-md:hidden">
                  {displayName}
                </span>
              </Link>
              <Link to="/home" className={BTN_CTA}>
                문제 풀러 가기
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className={BTN_GHOST}>
                로그인
              </Link>
              <Link to="/start" className={BTN_CTA}>
                무료로 약점 진단하기
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
