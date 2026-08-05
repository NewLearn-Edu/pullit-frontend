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

        <div className="flex items-start justify-between pt-[24px]">
          <p className="text-[16px] text-[#80858b]">© 2026 Pullit. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
