import { useEffect } from 'react'
import { useMe } from '@/user/hooks/useMe'
import { reportUtmVisit } from '@/user/services/visitMetrics'
import { clearEarlybird } from '@/user/services/earlybird'
import LandingNav from './LandingNav'
import HeroSection from './HeroSection'
import RadarSection from './RadarSection'
import RecommendSection from './RecommendSection'
import UnitsSection from './UnitsSection'
import GraphSection from './GraphSection'
import ReviewsSection from './ReviewsSection'
import FaqSection from './FaqSection'
import CtaSection from './CtaSection'
import LandingFooter from './LandingFooter'
import './landing.css'

/**
 * 메인 랜딩 — Figma ver.2 (웹 2801-5435 · 폰 3194-6264) 기준.
 * 섹션 순서는 시안 그대로: 히어로 → 약점 레이더 → 추천 → 문항 규모 → 성과 → 후기 → FAQ → CTA → 푸터
 */
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

  // index.html 인라인 스크립트가 흰 화면 플래시 방지용으로 칠한 검은 배경을
  // 랜딩 바탕색으로 맞추고, 떠날 때 원복 — 흰 배경 페이지로 이동해도 잔상이 남지 않게
  useEffect(() => {
    document.documentElement.style.background = '#121417'
    return () => {
      document.documentElement.style.background = ''
    }
  }, [])

  return (
    // 이미지·로고를 드래그하면 브라우저가 반투명 고스트 이미지를 끌고 나오는 것 방지
    // (CSS user-drag 는 Chrome/Safari, onDragStart 차단은 Firefox 까지 커버)
    <main className="landing min-h-dvh bg-[#121417]" onDragStart={(e) => e.preventDefault()}>
      <LandingNav />
      <HeroSection />
      <RadarSection />
      <RecommendSection />
      <UnitsSection />
      <GraphSection />
      <ReviewsSection />
      <FaqSection />
      <CtaSection />
      <LandingFooter />
    </main>
  )
}
