import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMe } from '@/user/hooks/useMe'
import LandingNav from './LandingNav'
import HeroSection from './HeroSection'
import MarqueeStrip from './MarqueeStrip'
import IntroSection from './IntroSection'
import FeatureSection from './FeatureSection'
import AnalyticsSection from './AnalyticsSection'
import ReviewsSection from './ReviewsSection'
import CtaSection from './CtaSection'
import FaqSection from './FaqSection'
import LandingFooter from './LandingFooter'
import screenshotRecommend from '@/assets/landing/screenshot-recommend.png'
import screenshotAnalysis from '@/assets/landing/screenshot-analysis.png'
import screenshotReminder from '@/assets/landing/screenshot-reminder.png'

/** 메인 랜딩 — Figma Landing Pages > Desktop-1920 (2032:4) 기준 */
export default function LandingPage() {
  const navigate = useNavigate()
  // 조회 전용(loadMe) — 세션이 없어도 게스트를 만들지 않는다.
  // 쿠키가 살아있는 재방문자(게스트·회원)는 마케팅 랜딩을 건너뛰고 홈으로.
  const { me } = useMe()

  useEffect(() => {
    if (me) navigate('/home', { replace: true })
  }, [me, navigate])

  return (
    <main className="min-h-dvh bg-black">
      <LandingNav />
      <HeroSection />
      <MarqueeStrip />
      <IntroSection />
      <FeatureSection
        title={
          <>
            추천 문제만 풀어
            <br />
            약점은 알아서 찾아줄게
          </>
        }
        subtitle="단원 별로 현재 실력을 확인하고 약점을 파악해"
        image={screenshotRecommend}
        imageAlt="오늘의 추천 문제 화면"
      />
      <FeatureSection
        imageFirst
        title={
          <>
            어디가 약한지
            <br />
            한눈에 보여줄게
          </>
        }
        subtitle="단원별 정답률과 연결된 단원까지 한 눈에 확인할 수 있어"
        image={screenshotAnalysis}
        imageAlt="단원별 약점 분석 화면"
      />
      <FeatureSection
        title={
          <>
            약점 문제 미루면
            <br />
            끝까지 쫓아간다
          </>
        }
        subtitle="오늘 풀 문제를 놓치지 않게 해줄게"
        image={screenshotReminder}
        imageAlt="학습 리마인더 알림 화면"
      />
      <AnalyticsSection />
      <ReviewsSection />
      <CtaSection />
      <FaqSection />
      <LandingFooter />
    </main>
  )
}
