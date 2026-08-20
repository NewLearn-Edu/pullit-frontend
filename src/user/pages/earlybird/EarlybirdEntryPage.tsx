import { useEffect } from 'react'
import LandingPage from '@/user/pages/landing/LandingPage'
import { enterEarlybird } from '@/user/services/earlybird'
import { reportEarlybirdDirectVisit } from '@/user/services/visitMetrics'

/**
 * /earlybird — 오픈 전 테스트 배포용 랜딩.
 * 얼리버드 모드 표식을 심고 랜딩을 그대로 렌더한다 (URL 은 /earlybird 유지).
 * 나브·CTA 가 "사전 신청하기"(구글폼)로 바뀌고 로그인·가입 경로가 막힌다.
 * 방문 집계: utm 링크는 랜딩의 reportUtmVisit 이, utm 없는 직접 방문은
 * 여기서 source=earlybird·campaign=direct 로 visit_events 에 남긴다.
 */
export default function EarlybirdEntryPage() {
  enterEarlybird()

  useEffect(() => {
    reportEarlybirdDirectVisit()
  }, [])

  return <LandingPage />
}
