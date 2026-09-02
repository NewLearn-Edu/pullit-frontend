import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { fetchMe } from '@/user/api/authApi'
import AdminLayout from './AdminLayout'
import DashboardPage from './pages/DashboardPage'
import ProblemListPage from './pages/ProblemListPage'
import ProblemUploadPage from './pages/ProblemUploadPage'
import ProblemReviewPage from './pages/ProblemReviewPage'
import TrialTestPage from './pages/TrialTestPage'
import MembersPage from './pages/MembersPage'
import AllMembersPage from './pages/AllMembersPage'
import PhoneVerificationsPage from './pages/PhoneVerificationsPage'
import CreditsPage from './pages/CreditsPage'
import PoliciesPage from './pages/PoliciesPage'
import VisitStatsPage from './pages/VisitStatsPage'
import UnitAveragesPage from './pages/UnitAveragesPage'
import ProblemInventoryPage from './pages/ProblemInventoryPage'
import './admin.css'

/**
 * /admin/* 전체 라우트. App.tsx 에서 React.lazy 로 로드되므로
 * 어드민 코드·CSS는 유저 번들에 포함되지 않는다.
 *
 * 진입 가드 — /api/users/me 로 실검증:
 * - 비로그인 · 토큰 만료/불량 → /login
 * - 로그인했지만 ADMIN 아님 → /home
 */
export default function AdminRoutes() {
  const [status, setStatus] = useState<'checking' | 'allowed'>('checking')
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    fetchMe().then((me) => {
      if (!alive) return
      if (!me) navigate('/login', { replace: true })
      else if (me.role !== 'ADMIN') navigate('/home', { replace: true })
      else setStatus('allowed')
    })
    return () => {
      alive = false
    }
  }, [navigate])

  if (status !== 'allowed') return null

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="problems/inventory" element={<ProblemInventoryPage />} />
        <Route path="problems/:subject" element={<ProblemListPage />} />
        <Route path="review" element={<ProblemReviewPage />} />
        <Route path="upload" element={<ProblemUploadPage />} />
        <Route path="upload/:subject" element={<ProblemUploadPage />} />
        <Route path="trial-tests/:subject" element={<TrialTestPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="members/all" element={<AllMembersPage />} />
        <Route path="members/verifications" element={<PhoneVerificationsPage />} />
        <Route path="credits" element={<CreditsPage />} />
        <Route path="policies" element={<PoliciesPage />} />
        <Route path="stats/visits" element={<VisitStatsPage />} />
        <Route path="stats/unit-averages" element={<UnitAveragesPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  )
}
