import { Link } from 'react-router-dom'
import logoNav from '@/assets/landing/logo-nav.svg'

export default function LandingNav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex flex-col items-center justify-center bg-[rgba(18,20,23,0.2)] backdrop-blur-md">
      <div className="w-full max-w-[1280px]">
        <div className="flex items-center justify-between px-[40px] py-[16px] max-md:px-lg">
          <Link to="/" aria-label="풀잇 홈">
            <img src={logoNav} alt="풀잇" className="h-[28px] w-[56px]" />
          </Link>
          <Link
            to="/taste"
            className="flex items-center justify-center rounded-[8px] bg-primary px-[20px] py-[12px] text-[16px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            무료로 약점 확인하기
          </Link>
        </div>
      </div>
    </nav>
  )
}
