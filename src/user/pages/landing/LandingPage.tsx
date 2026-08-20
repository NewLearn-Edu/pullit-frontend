import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMe } from '@/user/hooks/useMe'
import { isCompleteMember } from '@/user/stores/userStore'
import { hasCompletedTrial } from '@/user/services/trialGate'
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
  const navigate = useNavigate()
  // 조회 전용(loadMe) — 세션이 없어도 게스트를 만들지 않는다.
  // 쿠키가 살아있는 재방문자(게스트·회원)는 마케팅 랜딩을 건너뛰고 홈으로.
  const { me } = useMe()

  // UTM 유입 카운트 — 리다이렉트 전에 1회 기록 (마운트 시점의 쿼리로)
  useEffect(() => {
    reportUtmVisit()
  }, [])

  // 일반 랜딩(/)에 도착하면 얼리버드 모드 해제 — /earlybird 로 다시 들어가야만 켜진다.
  // (얼리버드 진입점은 이 컴포넌트를 /earlybird 경로에서 재사용하므로 경로로 구분)
  useEffect(() => {
    if (window.location.pathname === '/') clearEarlybird()
  }, [])

  useEffect(() => {
    // 세션이 있는 재방문자(게스트·프로필 완료 회원)는 맛보기 완주 여부로 분기 —
    // 완주 → 홈, 미완 → 퍼널(/start). 미완주 유저가 홈에 가는 일이 없어야 한다 (2026-08-19).
    // 프로필 미완성 회원은 랜딩을 그대로 본다 — 생년월일 입력은 소셜 로그인을
    // 직접 눌렀을 때만 안내 (finishLogin → /signup/info). 판정 불가면 홈 (퍼널 오감금 방지)
    if (!me) return
    if (me.type !== 'GUEST' && !isCompleteMember(me)) return
    let alive = true
    hasCompletedTrial()
      .then((done) => {
        if (alive) navigate(done ? '/home' : '/start', { replace: true })
      })
      .catch(() => {
        if (alive) navigate('/home', { replace: true })
      })
    return () => {
      alive = false
    }
  }, [me, navigate])

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
