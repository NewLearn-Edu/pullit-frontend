import { useEffect } from 'react'
import { useMe } from '@/user/hooks/useMe'
import { reportUtmVisit } from '@/user/services/visitMetrics'
import { clearEarlybird } from '@/user/services/earlybird'
import LandingNav from './LandingNav'
import HeroSection from './HeroSection'
import RadarSection from './RadarSection'
import UnitsSection from './UnitsSection'
import RecommendSection from './RecommendSection'
import GraphSection from './GraphSection'
import ReviewsSection from './ReviewsSection'
import FaqSection from './FaqSection'
import CtaSection from './CtaSection'
import LandingFooter from './LandingFooter'
import './landing.css'

/** 메인 랜딩 — Figma ver.2 (2801:5435) 기준 리디자인 (2026-08-20) */
export default function LandingPage() {
  // 조회 전용(loadMe) — 세션이 없어도 게스트를 만들지 않는다.
  // 로그인 상태여도 랜딩에 머문다 (2026-08-20) — 나브·CTA 가 프로필/"문제 풀러 가기"로 바뀔 뿐
  useMe()

  // UTM 유입 카운트 — 리다이렉트 전에 1회 기록 (마운트 시점의 쿼리로)
  useEffect(() => {
    reportUtmVisit()
  }, [])

  // 일반 랜딩(/)에 도착하면 얼리버드 모드 해제 — /earlybird 로 다시 들어가야만 켜진다.
  // (얼리버드 진입점은 이 컴포넌트를 /earlybird 경로에서 재사용하므로 경로로 구분)
  useEffect(() => {
    if (window.location.pathname === '/') clearEarlybird()
  }, [])

  // 로그인 상태여도 랜딩에 머문다 (2026-08-20 개편) — 자동 리다이렉트 없이
  // 나브가 프로필 + "문제 풀러 가기"(→ /home, 미완주는 홈 가드가 /start 로)로 바뀐다.

  // index.html 인라인 스크립트가 흰 화면 플래시 방지용으로 칠한 검은 배경을
  // 랜딩을 떠날 때 원복 — 흰 배경 페이지로 이동해도 잔상이 남지 않게
  useEffect(() => {
    document.documentElement.style.background = '#000'
    return () => {
      document.documentElement.style.background = ''
    }
  }, [])

  return (
    <main className="min-h-dvh bg-[#131417]">
      <LandingNav />
      <HeroSection />
      <RadarSection />
      <UnitsSection />
      <RecommendSection />
      <GraphSection />
      <ReviewsSection />
      <FaqSection />
      <CtaSection />
      <LandingFooter />
    </main>
  )
}
