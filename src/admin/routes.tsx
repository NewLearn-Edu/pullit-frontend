import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import AdminLayout from './AdminLayout'
import DashboardPage from './pages/DashboardPage'
import ProblemListPage from './pages/ProblemListPage'
import ProblemUploadPage from './pages/ProblemUploadPage'
import './admin.css'

/**
 * /admin/* 전체 라우트. App.tsx 에서 React.lazy 로 로드되므로
 * 어드민 코드·CSS는 유저 번들에 포함되지 않는다.
 */
export default function AdminRoutes() {
  const role = useAuthStore((s) => s.role)
  // 권한 가드 — 로그인 연동 전에는 authStore 스텁(admin)이라 항상 통과
  if (role !== 'admin') return <Navigate to="/" replace />

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="problems/:subject" element={<ProblemListPage />} />
        <Route path="upload/:subject" element={<ProblemUploadPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  )
}
