import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { fetchMe, type MeResult } from '@/user/api/authApi'
import { ToastProvider, useToast } from './components/toast'
import { ProblemKpi } from './components/ProblemKpi'
import {
  IcoAdmin,
  IcoClose,
  IcoCredit,
  IcoDashboard,
  IcoEnglish,
  IcoEnglishTest,
  IcoHome,
  IcoList,
  IcoMath,
  IcoMathTest,
  IcoMember,
  IcoMenu,
  IcoMoon,
  IcoOtp,
  IcoProblem,
  IcoSettings,
  IcoStats,
  IcoSun,
  IcoUpload,
} from './components/icons'

type Theme = 'light' | 'dark'

type NavItem = { to: string; label: string; ico: ReactNode; end?: boolean }
type NavGroup = { label?: string; items: NavItem[] }
type NavSection = { key: 'home' | 'problem' | 'member' | 'stats'; label: string; ico: ReactNode; home: string; groups: NavGroup[] }

/**
 * 네비 구조 단일 소스 — 레일(섹션) · 사이드바(현재 섹션의 그룹) · 모바일 드로어(전 섹션) 가 전부 여기서 그린다.
 * 섹션 판별(isProblem 등)은 pathname 기준이라 여기 경로와 어긋나면 사이드바가 홈으로 떨어진다.
 */
const NAV_SECTIONS: NavSection[] = [
  {
    key: 'home', label: '홈', ico: <IcoHome />, home: '/admin',
    groups: [{ items: [{ to: '/admin', label: '대시보드', ico: <IcoDashboard />, end: true }] }],
  },
  {
    key: 'problem', label: '문제', ico: <IcoProblem />, home: '/admin/problems/math',
    groups: [
      { label: '문제', items: [
        { to: '/admin/problems/math', label: '수학', ico: <IcoMath /> },
        { to: '/admin/problems/english', label: '영어', ico: <IcoEnglish /> },
        { to: '/admin/review', label: '문제 검수', ico: <IcoList /> },
        { to: '/admin/problems/inventory', label: '문제 재고', ico: <IcoStats /> },
      ] },
      { label: '맛보기 테스트', items: [
        { to: '/admin/trial-tests/math', label: '수학 테스트', ico: <IcoMathTest /> },
        { to: '/admin/trial-tests/english', label: '영어 테스트', ico: <IcoEnglishTest /> },
      ] },
      { label: '업로드', items: [{ to: '/admin/upload', label: '문제 업로드', ico: <IcoUpload /> }] },
    ],
  },
  {
    key: 'member', label: '회원', ico: <IcoMember />, home: '/admin/members/all',
    groups: [
      { label: '회원', items: [
        { to: '/admin/members/all', label: '전체 회원', ico: <IcoMember /> },
        { to: '/admin/members', label: '관리자 계정', ico: <IcoAdmin />, end: true },
      ] },
      { label: '인증번호', items: [{ to: '/admin/members/verifications', label: '인증번호 조회', ico: <IcoOtp /> }] },
      { label: '크레딧', items: [{ to: '/admin/credits', label: '크레딧 관리', ico: <IcoCredit /> }] },
      { label: '정책', items: [{ to: '/admin/policies', label: '정책 관리', ico: <IcoList /> }] },
    ],
  },
  {
    key: 'stats', label: '통계', ico: <IcoStats />, home: '/admin/stats/visits',
    groups: [
      { label: '마케팅', items: [{ to: '/admin/stats/visits', label: '유입 · 퍼널', ico: <IcoStats /> }] },
      { label: '학습 리포트', items: [{ to: '/admin/stats/unit-averages', label: '평균 관리', ico: <IcoList /> }] },
    ],
  },
]

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
  // 문제 섹션에 속하는 경로 — 하나라도 빠지면 사이드바가 홈 섹션으로 떨어진다
  const isProblem =
    pathname.includes('/problems/') ||
    pathname.includes('/upload') ||
    pathname.includes('/trial-tests/') ||
    pathname.includes('/review')
  const isMember =
    pathname.includes('/members') || pathname.includes('/credits') || pathname.includes('/policies')
  const isStats = pathname.includes('/stats')
  const isList = pathname.includes('/problems/')
  const isTrial = pathname.includes('/trial-tests/')
  const isMembersAll = pathname.includes('/members/all') // 전체 회원 — 필터·10컬럼 표라 넓게 (2026-09-07)
  const isVisits = pathname.includes('/stats/visits') // 유입 · 퍼널 — 소재별 10컬럼 표라 넓게 (2026-09-09)
  // 업로드·검수는 문제(524)+해설(524) 2단이라 같은 폭을 쓴다
  const isUpload = pathname.includes('/upload') || pathname.includes('/review')

  const sectionKey: NavSection['key'] = isProblem ? 'problem' : isMember ? 'member' : isStats ? 'stats' : 'home'
  const section = NAV_SECTIONS.find((s) => s.key === sectionKey) ?? NAV_SECTIONS[0]

  const soonMenus = [{ name: '설정', ico: <IcoSettings /> }]

  // 모바일(≤800px) 드로어 — 레일·사이드바가 숨는 폭에서 유일한 이동 수단. 경로가 바뀌면 닫힌다
  const [drawerOpen, setDrawerOpen] = useState(false)
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  const navClass = ({ isActive }: { isActive: boolean }) => clsx('nav-item', isActive && 'active')

  return (
    <>
      <nav className="rail">
        {NAV_SECTIONS.map((sec) => (
          <button
            key={sec.key}
            className={clsx('rail-item', sectionKey === sec.key && 'active')}
            onClick={() => navigate(sec.home)}
          >
            <span className="rico">{sec.ico}</span>
            <span>{sec.label}</span>
          </button>
        ))}
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

        {section.groups.map((g, i) => (
          <NavGroupList key={g.label ?? i} group={g} navClass={navClass} />
        ))}

        {/* 현재 로그인 사용자 · /api/users/me 실데이터 (비로그인 시 폴백 "관리자") */}
        <div className="sidebar-foot">
          <span className="avatar">{meName.charAt(0)}</span>
          <div className="who">
            <b>{meName}</b>
            <span>{me?.role === 'ADMIN' ? '관리자' : me ? '회원' : '미로그인'}</span>
          </div>
        </div>
      </aside>

      <MobileBar
        open={drawerOpen}
        onOpen={() => setDrawerOpen(true)}
        onClose={() => setDrawerOpen(false)}
        onToggleTheme={onToggleTheme}
        sectionKey={sectionKey}
        navClass={navClass}
        meName={meName}
        meRole={me?.role === 'ADMIN' ? '관리자' : me ? '회원' : '미로그인'}
      />

      <main className="main">
        <div className={clsx('main-inner', (isList || isTrial || isMembersAll) && 'wide', isVisits && 'xwide', isUpload && 'mid')}>
          {isProblem && <ProblemKpi />}
          <Outlet />
        </div>
      </main>
    </>
  )
}

/** 사이드바 · 드로어 공용 — 섹션 라벨(선택) + 메뉴 아이템 */
function NavGroupList({
  group,
  navClass,
}: {
  group: NavGroup
  navClass: (p: { isActive: boolean }) => string
}) {
  return (
    <>
      {group.label && <div className="nav-label">{group.label}</div>}
      {group.items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className={navClass}>
          <span className="ico">{it.ico}</span>
          {it.label}
        </NavLink>
      ))}
    </>
  )
}

/**
 * 모바일 상단 바 + 메뉴 드로어 (≤800px 에서만 표시 · CSS 로 제어).
 * 데스크톱의 레일(섹션) + 사이드바(메뉴) 두 단계를 그대로 — 상단 세그먼트로 섹션을 고르고 아래에 그 섹션 메뉴만.
 * 섹션 제목을 메뉴 위에 같이 나열하면 메뉴 아이템과 구분이 안 돼 이 구조로 바꿈 (2026-09-10).
 * 딤 클릭 · ESC · 경로 변경 시 닫히고, 열려 있는 동안 본문 스크롤은 잠근다.
 */
function MobileBar({
  open,
  onOpen,
  onClose,
  onToggleTheme,
  sectionKey,
  navClass,
  meName,
  meRole,
}: {
  open: boolean
  onOpen: () => void
  onClose: () => void
  onToggleTheme: () => void
  sectionKey: NavSection['key']
  navClass: (p: { isActive: boolean }) => string
  meName: string
  meRole: string
}) {
  // 드로어 안에서 고른 섹션 — 열 때마다 현재 경로의 섹션으로 되돌린다
  const [sec, setSec] = useState<NavSection['key']>(sectionKey)
  useEffect(() => {
    if (open) setSec(sectionKey)
  }, [open, sectionKey])
  const current = NAV_SECTIONS.find((s) => s.key === sec) ?? NAV_SECTIONS[0]

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <>
      <header className="mbar">
        <div className="brand">
          <span className="brand-mark">P</span>
          pullit <small>admin</small>
        </div>
        <button type="button" className="mbar-btn" onClick={onOpen} aria-label="메뉴 열기" aria-expanded={open}>
          <IcoMenu />
        </button>
      </header>

      <div className={clsx('mnav-dim', open && 'open')} onClick={onClose} aria-hidden={!open} />
      <aside className={clsx('mnav', open && 'open')} aria-hidden={!open} aria-label="관리자 메뉴">
        <div className="mnav-head">
          <div className="brand">
            <span className="brand-mark">P</span>
            pullit <small>admin</small>
          </div>
          <button type="button" className="mbar-btn" onClick={onClose} aria-label="메뉴 닫기">
            <IcoClose />
          </button>
        </div>

        <div className="seg mnav-seg" role="tablist" aria-label="섹션">
          {NAV_SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={sec === s.key}
              className={sec === s.key ? 'on' : undefined}
              onClick={() => setSec(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mnav-body">
          {current.groups.map((g, i) => (
            <NavGroupList key={`${current.key}:${g.label ?? i}`} group={g} navClass={navClass} />
          ))}
        </div>

        <div className="mnav-foot">
          <div className="sidebar-foot">
            <span className="avatar">{meName.charAt(0)}</span>
            <div className="who">
              <b>{meName}</b>
              <span>{meRole}</span>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm theme-toggle" onClick={onToggleTheme}>
            <span className="ico">
              <IcoMoon />
              <IcoSun />
            </span>
            테마
          </button>
        </div>
      </aside>
    </>
  )
}
