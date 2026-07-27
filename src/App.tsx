import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import TasteStartPage from './pages/taste/TasteStartPage'
import TasteQuizPage from './pages/taste/TasteQuizPage'
import TasteCompletePage from './pages/taste/TasteCompletePage'

/**
 * POC 단계에서는 skill_node · 유형 선택 페이지를 스킵하고
 * 수학 = 지수와 로그 (sn-exp-log-01) · 영어 = 빈칸 추론 (en-blank) 로 강제.
 * 정책 (page 64847873) 상 "학생이 선택" 이지만 실서비스 붙일 때 열 예정.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/taste" element={<TasteStartPage />} />
      <Route path="/taste/quiz/:subject/:index" element={<TasteQuizPage />} />
      <Route path="/taste/complete" element={<TasteCompletePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
