import logoFooter from '@/assets/landing/logo-footer.svg'
import badgeGooglePlay from '@/assets/landing/badge-google-play.svg'
import badgeAppStore from '@/assets/landing/badge-app-store.svg'

export default function LandingFooter() {
  return (
    <footer className="flex w-full flex-col items-center bg-surface py-[40px]">
      <div className="flex w-full max-w-[1280px] flex-col gap-[20px] px-[40px] max-md:px-lg">
        <div className="flex flex-col gap-[12px]">
          <img src={logoFooter} alt="풀잇" className="h-[28px] w-[56px]" />
          <p className="text-[16px] font-medium text-[#80858b]">
            고등학생을 위한 약점 기반 문제 추천 학습 서비스
          </p>
        </div>

        <div className="flex items-start gap-[8px] max-md:flex-col">
          <img
            src={badgeGooglePlay}
            alt="Google Play에서 다운로드"
            className="h-[40px] rounded-[6px] border border-[#e5e7ea]"
          />
          <img
            src={badgeAppStore}
            alt="App Store에서 다운로드"
            className="h-[40px] rounded-[6px] border border-[#e5e7ea]"
          />
        </div>

        {/* 사업자 정보 — 사업자등록증(2026-01-12 발급) 기준 */}
        <div className="flex flex-col gap-[4px] border-t border-[#e5e7ea] pt-[24px] text-[14px] leading-[1.7] text-[#80858b]">
          <p className="break-keep">
            주식회사 뉴런소프트 · 대표 최영재 · 사업자등록번호 591-88-03234
          </p>
          <p className="break-keep">서울특별시 관악구 봉천로 545, 서울창업센터 관악(봉천동)</p>
          {/* 법적 고지문 — 개인정보처리방침은 관행상 굵게 구분 */}
          <p className="mt-[4px] flex gap-[16px]">
            <a href="/policies/terms" className="hover:underline">
              이용약관
            </a>
            <a href="/policies/privacy" className="font-semibold text-[#5e6368] hover:underline">
              개인정보처리방침
            </a>
          </p>
        </div>

        <div className="flex items-start justify-between">
          <p className="text-[16px] text-[#80858b]">© 2026 Pullit. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
