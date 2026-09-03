import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { trackPageView } from './user/services/metaPixel'
import { type Subject } from './user/stores/trialStore'
import { CURRICULUM } from './user/data/curriculum'
import LandingPage from './user/pages/landing/LandingPage'
import HomePage from './user/pages/home/HomePage'
import WrongNotePage from './user/pages/wrongnote/WrongNotePage'
import WrongNoteDetailPage from './user/pages/wrongnote/WrongNoteDetailPage'
import WrongNoteReviewPage from './user/pages/wrongnote/WrongNoteReviewPage'
import MyPage from './user/pages/my/MyPage'
import ProfileEditPage from './user/pages/my/ProfileEditPage'
import CreditHistoryPage from './user/pages/my/CreditHistoryPage'
import ReportPage from './user/pages/report/ReportPage'
import WeaknessMapPage from './user/pages/map/WeaknessMapPage'
import UnitResultPage from './user/pages/home/UnitResultPage'
import SolveResultPage from './user/pages/home/SolveResultPage'
import SolveSetResultPage from './user/pages/home/SolveSetResultPage'
import SolveReviewPage from './user/pages/home/SolveReviewPage'
import PolicyPage from './user/pages/policy/PolicyPage'
import EarlybirdEntryPage from './user/pages/earlybird/EarlybirdEntryPage'
import LoginPage from './user/pages/auth/LoginPage'
import SignupPromptPage from './user/pages/auth/SignupPromptPage'
import SignupCompletePage from '@/user/pages/auth/SignupCompletePage'
import SignupInfoPage from './user/pages/auth/SignupInfoPage'
import KakaoCallbackPage from './user/pages/auth/KakaoCallbackPage'
import NaverCallbackPage from './user/pages/auth/NaverCallbackPage'
import GoogleCallbackPage from './user/pages/auth/GoogleCallbackPage'
import TrialStartPage from './user/pages/trial/TrialStartPage'
import TrialIntroPage from './user/pages/trial/TrialIntroPage'
import TrialQuizPage from './user/pages/trial/TrialQuizPage'
import TrialReviewPage from './user/pages/trial/TrialReviewPage'
import WeaknessResultPage from './user/pages/trial/WeaknessResultPage'
import RecommendPage from './user/pages/recommend/RecommendPage'
import AccessGate from './AccessGate'
import RequireTrialDone from './user/components/RequireTrialDone'

// 어드민은 지연 로드 — 학생 유저 번들에 어드민 코드·CSS 미포함
const AdminRoutes = lazy(() => import('./admin/routes'))

/**
 * 이 기기에서 가장 최근에 진단한 과목 — 알림톡처럼 과목을 모르는 진입에서 추론용.
 * 진단 캐시(pullit_trial_progress)는 localStorage 라 다음날 재방문에도 남는다.
 */
function latestStudiedSubject(): Subject | null {
  try {
    const raw = localStorage.getItem('pullit_trial_progress')
    if (!raw) return null
    const persisted = JSON.parse(raw) as {
      state?: { diagnosed?: Record<string, { date?: string; time?: string }> }
    }
    const diagnosed = persisted.state?.diagnosed
    if (!diagnosed) return null
    const subjectByName = new Map<string, Subject>()
    for (const subject of ['math', 'english'] as const)
      for (const category of CURRICULUM[subject])
        for (const unit of category.units) subjectByName.set(unit.name, subject)
    let best: { at: string; subject: Subject } | null = null
    for (const [name, diag] of Object.entries(diagnosed)) {
      const subject = subjectByName.get(name)
      if (!subject || !diag?.date) continue
      const at = `${diag.date} ${diag.time ?? '00:00'}`
      if (!best || at > best.at) best = { at, subject }
    }
    return best?.subject ?? null
  } catch {
    return null
  }
}

/**
 * 알림톡 랜딩 (/today) → /recommend.
 * 버튼 링크는 쿼리 없는 고정 URL 이라 과목을 모른다 — ①쿼리 ②이 기기의 최근 진단
 * 과목 ③둘 다 없으면 과목 선택 화면 순서로 보낸다. 나머지 쿼리는 보존.
 */
function TodayRedirect() {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  if (!params.get('subject')) {
    const last = latestStudiedSubject()
    if (last) params.set('subject', last)
  }
  const query = params.toString()
  return <Navigate to={`/recommend${query ? `?${query}` : ''}`} replace />
}

/**
 * POC 단계에서는 skill_node · 유형 선택 페이지를 스킵하고
 * 수학 = 지수와 로그 (sn-exp-log-01) · 영어 = 빈칸 추론 (en-blank) 로 강제.
 * 정책 (page 64847873) 상 "학생이 선택" 이지만 실서비스 붙일 때 열 예정.
 */
/**
 * Meta Pixel PageView — SPA 는 라우트가 바뀌어도 문서가 다시 로드되지 않아
 * 픽셀이 자동 집계하지 못한다. pathname 이 바뀔 때마다 직접 쏜다
 * (search 변화는 제외 — 과목 탭 토글 등 쿼리 갱신이 조회수를 부풀리지 않게).
 */
function MetaPixelPageView() {
  const { pathname } = useLocation()
  useEffect(() => {
    trackPageView(pathname)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <AccessGate>
    <MetaPixelPageView />
    <Routes>
      <Route path="/" element={<LandingPage />} />
      {/* 오픈 전 테스트 배포용 진입점 — 얼리버드 모드 표식 후 랜딩으로 */}
      <Route path="/earlybird" element={<EarlybirdEntryPage />} />
      {/* 회원 영역 — 세션 없음 → /login · 맛보기 미완주 → /start. 판정 전엔 그리지 않는다 (RequireTrialDone).
          퍼널(/start → /trial → /trial/quiz → /weakness)·로그인·가입·정책·랜딩만 가드 밖 */}
      <Route element={<RequireTrialDone />}>
        <Route path="/home" element={<HomePage />} />
        {/* 추천 랜딩 — 알림톡 딥링크(과목 선택) · 나브 추천 버튼(?subject= 로 선택 생략) */}
        <Route path="/recommend" element={<RecommendPage />} />
        {/* 구 경로 — 이미 발송된 알림톡 링크가 /today 라 쿼리까지 실어 넘긴다 */}
        <Route path="/today" element={<TodayRedirect />} />
        <Route path="/wrong-note" element={<WrongNotePage />} />
        <Route path="/wrong-note/:subject/units/:unitId" element={<WrongNoteDetailPage />} />
        {/* 오답노트 해설 — 카드의 "해설" 버튼 진입 (오답노트 API 의 정답·해설로 리뷰 화면) */}
        <Route path="/wrong-note/:subject/units/:unitId/review/:problemId" element={<WrongNoteReviewPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/my" element={<MyPage />} />
        <Route path="/my/profile" element={<ProfileEditPage />} />
        {/* 크레딧 내역 — 마이페이지 › 학습 관리 */}
        <Route path="/my/credits" element={<CreditHistoryPage />} />
        <Route path="/weakness-map" element={<WeaknessMapPage />} />
        {/* 약점 그래프 잠금 해제 진행 — subject = math|english, slug = curriculum 카테고리 */}
        {/* 진단 결과 재열람 — 홈 소단원 리스트의 완료 행에서 진입 */}
        <Route path="/unit-result/:subject/:unitName" element={<UnitResultPage />} />
        {/* 세트 풀이 완료 — 소단원 평균 점수 변동 (진단 이후 풀이는 /weakness 대신 이 화면) */}
        <Route path="/solve-result/:subject/:unitName" element={<SolveResultPage />} />
        {/* 세트 풀이 결과(문항별 · 3620-8224) → 완료 → 점수 변동(/solve-result). 해설은 리뷰 화면 */}
        <Route path="/solve/result/:subject" element={<SolveSetResultPage />} />
        <Route path="/solve/review/:subject/:index" element={<SolveReviewPage />} />
        {/* 자유 풀이 — 홈·오답노트에서만 진입하므로 회원 영역과 같은 게이트 */}
        <Route path="/solve/:subject/:index" element={<TrialQuizPage mode="solve" />} />
      </Route>
      {/* 법적 고지문 — terms · privacy · marketing (비로그인 열람 가능) */}
      <Route path="/policies/:slug" element={<PolicyPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPromptPage />} />
      <Route path="/signup/info" element={<SignupInfoPage />} />
      <Route path="/signup-complete" element={<SignupCompletePage />} />
      <Route path="/auth/kakao/callback" element={<KakaoCallbackPage />} />
      <Route path="/auth/naver/callback" element={<NaverCallbackPage />} />
      <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
      {/* 마케팅 인트로 → 과목 선택 → 퀴즈 순서 (랜딩 CTA 는 /start 로 진입) */}
      <Route path="/start" element={<TrialIntroPage />} />
      <Route path="/trial" element={<TrialStartPage />} />
      <Route path="/trial/quiz/:subject/:index" element={<TrialQuizPage />} />
      <Route path="/trial/review/:subject/:index" element={<TrialReviewPage />} />
      <Route path="/weakness" element={<WeaknessResultPage />} />
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={null}>
            <AdminRoutes />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </AccessGate>
  )
}
