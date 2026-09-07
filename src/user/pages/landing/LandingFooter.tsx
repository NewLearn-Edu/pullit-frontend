import logoFooter from '@/assets/landing/logo-footer.svg'

/**
 * 푸터 (ver.2 · 2801-5672) — 좌: 로고·태그라인 / 우: 링크·사업자 정보·저작권.
 * 사업자 정보·법적 고지문 링크는 심사 요건이라 유지. 폰(3194-6840)은 한 열로 쌓인다.
 * 시안의 "고객센터" 링크는 연결 대상이 아직 없어 제외.
 * 시안의 Google Play · App Store 배지는 스토어 출시 전이라 뺐다 (2026-09-07). 출시 후 다시 붙인다.
 */
export default function LandingFooter() {
  return (
    <footer className="flex w-full flex-col items-center py-[40px]">
      <div className="flex w-full max-w-[1000px] items-start gap-[15.6px] px-[24px] max-md:flex-col max-md:gap-[24px]">
        <div className="flex min-w-0 flex-1 flex-col gap-[24px]">
          <img src={logoFooter} alt="풀잇" className="h-[22px] w-[44px]" />
          <p className="break-keep text-[12.5px] font-medium text-[#80858b]">
            고등학생을 위한 수능 수학 영어 약점 진단 기반 문제 추천 서비스
          </p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-[24px]">
          <nav className="flex items-center gap-[40px] text-[14px] font-medium text-white" aria-label="법적 고지">
            <a href="/policies/terms" className="hover:underline">
              이용약관
            </a>
            <a href="/policies/privacy" className="hover:underline">
              개인정보처리방침
            </a>
          </nav>
          {/* 사업자 정보 — 사업자등록증(2026-01-12 발급) 기준 */}
          <div className="flex flex-col text-[12.5px] font-medium leading-[1.5] text-[#80858b]">
            <p className="break-keep">주식회사 뉴런소프트 · 대표 최영재 · 사업자등록번호 591-88-03234</p>
            <p className="break-keep">서울특별시 관악구 봉천로 545, 서울창업센터 관악(봉천동)</p>
          </div>
          <p className="text-[12.5px] text-[#80858b]">© 2026 Pullit. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
