import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { fetchMe, type MeResult } from '@/user/api/authApi'
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

  // 현재 로그인 사용자 (GET /api/users/me) · 비로그인·오류 시 null → 폴백 표시
  const [me, setMe] = useState<MeResult | null>(null)
  useEffect(() => {
    fetchMe().then(setMe)
  }, [])
  const meName = me?.name ?? me?.nickname ?? '관리자'

  // 레일 섹션: 대시보드 = home, 목록·업로드·맛보기 = problem, 회원 = member
  const isProblem =
    pathname.includes('/problems/') || pathname.includes('/upload') || pathname.includes('/trial-tests/')
  const isMember = pathname.includes('/members')
  const isList = pathname.includes('/problems/')
  const isTrial = pathname.includes('/trial-tests/')
  const isUpload = pathname.includes('/upload')

  const soonMenus = [
    { name: '통계', ico: <IcoStats /> },
    { name: '설정', ico: <IcoSettings /> },
  ]

  const navClass = ({ isActive }: { isActive: boolean }) => clsx('nav-item', isActive && 'active')

  return (
    <>
      <nav className="rail">
        <button
          className={clsx('rail-item', !isProblem && !isMember && 'active')}
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
        <button
          className={clsx('rail-item', isMember && 'active')}
          onClick={() => navigate('/admin/members/all')}
        >
          <span className="rico"><IcoMember /></span>
          <span>회원</span>
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

        {!isProblem && !isMember && (
          <NavLink to="/admin" end className={navClass}>
            <span className="ico"><IcoDashboard /></span>
            대시보드
          </NavLink>
        )}

        {isMember && (
          <>
            <div className="nav-label">회원</div>
            <NavLink to="/admin/members/all" className={navClass}>
              <span className="ico"><IcoMember /></span>
              전체 회원
            </NavLink>
            <NavLink to="/admin/members" end className={navClass}>
              <span className="ico"><IcoMember /></span>
              관리자 계정
            </NavLink>
          </>
        )}

        {isProblem && (
          <>
            <div className="nav-label">문제</div>
            <NavLink to="/admin/problems/math" className={navClass}>
              <span className="ico"><IcoList /></span>
              수학
            </NavLink>
            <NavLink to="/admin/problems/english" className={navClass}>
              <span className="ico"><IcoList /></span>
              영어
            </NavLink>

            <div className="nav-label">맛보기 테스트</div>
            <NavLink to="/admin/trial-tests/math" className={navClass}>
              <span className="ico"><IcoList /></span>
              수학
            </NavLink>
            <NavLink to="/admin/trial-tests/english" className={navClass}>
              <span className="ico"><IcoList /></span>
              영어
            </NavLink>

            <div className="nav-label">업로드</div>
            <NavLink to="/admin/upload" className={navClass}>
              <span className="ico"><IcoUpload /></span>
              문제 업로드
            </NavLink>
          </>
        )}

        {/* 현재 로그인 사용자 · /api/users/me 실데이터 (비로그인 시 폴백 "관리자") */}
        <div className="sidebar-foot">
          <span className="avatar">{meName.charAt(0)}</span>
          <div className="who">
            <b>{meName}</b>
            <span>{me?.role === 'ADMIN' ? '관리자' : me ? '회원' : '미로그인'}</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className={clsx('main-inner', (isList || isTrial) && 'wide', isUpload && 'mid')}>
          {isProblem && <ProblemKpi />}
          <Outlet />
        </div>
      </main>
    </>
  )
}
