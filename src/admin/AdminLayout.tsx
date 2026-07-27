import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { ToastProvider, useToast } from './components/toast'
import { ProblemKpi } from './components/ProblemKpi'
import {
  IcoDashboard,
  IcoHome,
  IcoList,
  IcoMember,
  IcoMoon,
  IcoProblem,
  IcoSettings,
  IcoStats,
  IcoSun,
  IcoUpload,
} from './components/icons'

type Theme = 'light' | 'dark'

function initTheme(): Theme {
  try {
    const saved = localStorage.getItem('pa-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* localStorage 접근 불가 환경 → 시스템 설정 사용 */
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function AdminLayout() {
  const [theme, setTheme] = useState<Theme>(initTheme)

  useEffect(() => {
    try {
      localStorage.setItem('pa-theme', theme)
    } catch {
      /* noop */
    }
  }, [theme])

  return (
    <div className="admin-root" data-theme={theme}>
      <ToastProvider>
        <LayoutBody onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
      </ToastProvider>
    </div>
  )
}

function LayoutBody({ onToggleTheme }: { onToggleTheme: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const toast = useToast()

  // 레일 섹션: 대시보드 = home, 목록·업로드 = problem
  const isProblem = pathname.includes('/problems/') || pathname.includes('/upload/')
  const isList = pathname.includes('/problems/')

  const soonMenus = [
    { name: '회원', ico: <IcoMember /> },
    { name: '통계', ico: <IcoStats /> },
    { name: '설정', ico: <IcoSettings /> },
  ]

  const navClass = ({ isActive }: { isActive: boolean }) => clsx('nav-item', isActive && 'active')

  return (
    <>
      <nav className="rail">
        <button
          className={clsx('rail-item', !isProblem && 'active')}
          onClick={() => navigate('/admin')}
        >
          <span className="rico"><IcoHome /></span>
          <span>홈</span>
        </button>
        <button
          className={clsx('rail-item', isProblem && 'active')}
          onClick={() => navigate('/admin/problems/math')}
        >
          <span className="rico"><IcoProblem /></span>
          <span>문제</span>
        </button>
        {soonMenus.map(({ name, ico }) => (
          <button
            key={name}
            className="rail-item disabled"
            onClick={() => toast(`${name} 메뉴는 준비 중이에요`)}
          >
            <span className="rico">{ico}</span>
            <span>{name}</span>
          </button>
        ))}
        <button className="rail-item theme-toggle" onClick={onToggleTheme}>
          <span className="rico">
            <IcoMoon />
            <IcoSun />
          </span>
          <span>테마</span>
        </button>
      </nav>

      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">P</span>
          pullit <small>admin</small>
        </div>

        {!isProblem && (
          <NavLink to="/admin" end className={navClass}>
            <span className="ico"><IcoDashboard /></span>
            대시보드
          </NavLink>
        )}

        {isProblem && (
          <>
            <div className="nav-label">수학 문제</div>
            <NavLink to="/admin/problems/math" className={navClass}>
              <span className="ico"><IcoList /></span>
              문제 목록
            </NavLink>
            <NavLink to="/admin/upload/math" className={navClass}>
              <span className="ico"><IcoUpload /></span>
              문제 업로드
            </NavLink>

            <div className="nav-label">영어 문제</div>
            <NavLink to="/admin/problems/english" className={navClass}>
              <span className="ico"><IcoList /></span>
              문제 목록
            </NavLink>
            <NavLink to="/admin/upload/english" className={navClass}>
              <span className="ico"><IcoUpload /></span>
              문제 업로드
            </NavLink>
          </>
        )}

        <div className="sidebar-foot">
          <span className="avatar">YK</span>
          <div className="who">
            <b>유이현</b>
            <span>관리자</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className={clsx('main-inner', isList && 'wide')}>
          {isProblem && <ProblemKpi />}
          <Outlet />
        </div>
      </main>
    </>
  )
}
