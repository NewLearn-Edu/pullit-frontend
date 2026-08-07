import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './user/pages/landing/LandingPage'
import HomePage from './user/pages/home/HomePage'
import WrongNotePage from './user/pages/wrongnote/WrongNotePage'
import MyPage from './user/pages/my/MyPage'
import LoginPage from './user/pages/auth/LoginPage'
import SignupPromptPage from './user/pages/auth/SignupPromptPage'
import SignupInfoPage from './user/pages/auth/SignupInfoPage'
import KakaoCallbackPage from './user/pages/auth/KakaoCallbackPage'
import NaverCallbackPage from './user/pages/auth/NaverCallbackPage'
import GoogleCallbackPage from './user/pages/auth/GoogleCallbackPage'
import TasteStartPage from './user/pages/taste/TasteStartPage'
import TasteQuizPage from './user/pages/taste/TasteQuizPage'
import TasteCompletePage from './user/pages/taste/TasteCompletePage'
import WeaknessResultPage from './user/pages/taste/WeaknessResultPage'

// 어드민은 지연 로드 — 학생 유저 번들에 어드민 코드·CSS 미포함
const AdminRoutes = lazy(() => import('./admin/routes'))

/**
 * POC 단계에서는 skill_node · 유형 선택 페이지를 스킵하고
 * 수학 = 지수와 로그 (sn-exp-log-01) · 영어 = 빈칸 추론 (en-blank) 로 강제.
 * 정책 (page 64847873) 상 "학생이 선택" 이지만 실서비스 붙일 때 열 예정.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/wrong-note" element={<WrongNotePage />} />
      <Route path="/my" element={<MyPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPromptPage />} />
      <Route path="/signup/info" element={<SignupInfoPage />} />
      <Route path="/auth/kakao/callback" element={<KakaoCallbackPage />} />
      <Route path="/auth/naver/callback" element={<NaverCallbackPage />} />
      <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
      <Route path="/taste" element={<TasteStartPage />} />
      <Route path="/taste/quiz/:subject/:index" element={<TasteQuizPage />} />
      <Route path="/taste/complete" element={<TasteCompletePage />} />
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
  )
}
