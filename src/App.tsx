import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './user/pages/landing/LandingPage'
import HomePage from './user/pages/home/HomePage'
import WrongNotePage from './user/pages/wrongnote/WrongNotePage'
import WrongNoteDetailPage from './user/pages/wrongnote/WrongNoteDetailPage'
import MyPage from './user/pages/my/MyPage'
import ProfileEditPage from './user/pages/my/ProfileEditPage'
import ReportPage from './user/pages/report/ReportPage'
import WeaknessMapPage from './user/pages/map/WeaknessMapPage'
import UnlockProgressPage from './user/pages/unlock/UnlockProgressPage'
import UnitResultPage from './user/pages/home/UnitResultPage'
import PolicyPage from './user/pages/policy/PolicyPage'
import EarlybirdEntryPage from './user/pages/earlybird/EarlybirdEntryPage'
import LoginPage from './user/pages/auth/LoginPage'
import SignupPromptPage from './user/pages/auth/SignupPromptPage'
import SignupInfoPage from './user/pages/auth/SignupInfoPage'
import KakaoCallbackPage from './user/pages/auth/KakaoCallbackPage'
import NaverCallbackPage from './user/pages/auth/NaverCallbackPage'
import GoogleCallbackPage from './user/pages/auth/GoogleCallbackPage'
import TrialStartPage from './user/pages/trial/TrialStartPage'
import TrialIntroPage from './user/pages/trial/TrialIntroPage'
import TrialQuizPage from './user/pages/trial/TrialQuizPage'
import TrialReviewPage from './user/pages/trial/TrialReviewPage'
import WeaknessResultPage from './user/pages/trial/WeaknessResultPage'
import TodayPage from './user/pages/today/TodayPage'
import AccessGate from './AccessGate'
import RequireTrialDone from './user/components/RequireTrialDone'

// 어드민은 지연 로드 — 학생 유저 번들에 어드민 코드·CSS 미포함
const AdminRoutes = lazy(() => import('./admin/routes'))

/**
 * POC 단계에서는 skill_node · 유형 선택 페이지를 스킵하고
 * 수학 = 지수와 로그 (sn-exp-log-01) · 영어 = 빈칸 추론 (en-blank) 로 강제.
 * 정책 (page 64847873) 상 "학생이 선택" 이지만 실서비스 붙일 때 열 예정.
 */
export default function App() {
  return (
    <AccessGate>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      {/* 오픈 전 테스트 배포용 진입점 — 얼리버드 모드 표식 후 랜딩으로 */}
      <Route path="/earlybird" element={<EarlybirdEntryPage />} />
      {/* 회원 영역 — 맛보기 미완주면 /my 포함 어디든 /start 퍼널로 (RequireTrialDone) */}
      <Route element={<RequireTrialDone />}>
        <Route path="/home" element={<HomePage />} />
        {/* 오늘의 추천 랜딩 — 알림톡 딥링크(과목 선택) · 나브 추천 버튼(?subject= 로 선택 생략) */}
        <Route path="/today" element={<TodayPage />} />
        <Route path="/wrong-note" element={<WrongNotePage />} />
        <Route path="/wrong-note/:subject/units/:unitId" element={<WrongNoteDetailPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/my" element={<MyPage />} />
      <Route path="/my/profile" element={<ProfileEditPage />} />
        <Route path="/weakness-map" element={<WeaknessMapPage />} />
        {/* 약점 그래프 잠금 해제 진행 — subject = math|english, slug = curriculum 카테고리 */}
        <Route path="/unlock/:subject/:slug" element={<UnlockProgressPage />} />
        {/* 진단 결과 재열람 — 홈 소단원 리스트의 완료 행에서 진입 */}
        <Route path="/unit-result/:subject/:unitName" element={<UnitResultPage />} />
        {/* 자유 풀이 — 홈·오답노트에서만 진입하므로 회원 영역과 같은 게이트 */}
        <Route path="/solve/:subject/:index" element={<TrialQuizPage mode="solve" />} />
      </Route>
      {/* 법적 고지문 — terms · privacy · marketing (비로그인 열람 가능) */}
      <Route path="/policies/:slug" element={<PolicyPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPromptPage />} />
      <Route path="/signup/info" element={<SignupInfoPage />} />
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
