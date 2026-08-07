import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { useUserStore } from '@/user/stores/userStore'
import styles from './styles/UserNav.module.scss'

export type UserNavKey = 'recommend' | 'map' | 'wrongNote' | 'report' | 'my'

interface UserNavProps {
  active: UserNavKey
}

/**
 * 학생 서비스 공용 네비게이션.
 * - 데스크탑: 좌측 사이드바 (추천 · 자유 문제 · 오답노트 · 리포트 · 마이페이지 + 크레딧)
 * - iPad · 모바일: 하단 네비 바 (추천 · 자유 문제 · 리포트 — 시안 175)
 * 자유 문제 · 리포트 · 마이페이지는 아직 페이지 없음 (POC 시각만).
 */
export function UserNav({ active }: UserNavProps) {
  // 실제 세션 권한 — 이전 authStore 스텁(role:'admin' 하드코딩)은 모든 방문자에게 어드민 버튼을 노출했다
  const isAdmin = useUserStore((s) => s.me?.role === 'ADMIN')

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <aside className={styles.sidebar}>
        <Link to="/home" className={styles.logo}>
          풀잇
        </Link>
        <nav className={styles.nav}>
          <NavItem to="/home" icon={<HomeIcon />} label="추천" active={active === 'recommend'} />
          <NavItem to="/weakness-map" icon={<MapIcon />} label="약점 지도" active={active === 'map'} />
          <NavItem to="/wrong-note" icon={<BookmarkIcon />} label="오답노트" active={active === 'wrongNote'} />
          <NavItem icon={<ChartIcon />} label="리포트" active={active === 'report'} />
          <NavItem to="/my" icon={<PersonIcon />} label="마이페이지" active={active === 'my'} />
        </nav>
        <div className={styles.footer}>
          {/* ADMIN 권한일 때만 노출 · 어드민 콘솔 진입 */}
          {isAdmin && (
            <Link to="/admin" className={styles.adminButton}>
              <GearIcon /> 어드민
            </Link>
          )}
        </div>
      </aside>

      {/* iPad · 모바일 하단 네비 (Figma 2431-17022 — 홈 · 약점 지도 · 학습 기록) */}
      <nav className={styles.bottomNav} aria-label="메인 메뉴">
        <Link
          to="/home"
          className={clsx(styles.bottomItem, active === 'recommend' && styles.bottomItemActive)}
        >
          <HomeIcon />홈
        </Link>
        <Link
          to="/weakness-map"
          className={clsx(styles.bottomItem, active === 'map' && styles.bottomItemActive)}
        >
          <MapIcon />
          약점 지도
        </Link>
        <button type="button" className={clsx(styles.bottomItem, active === 'report' && styles.bottomItemActive)}>
          <ChartIcon />
          학습 기록
        </button>
      </nav>
    </>
  )
}

function NavItem({
  to,
  icon,
  label,
  active,
}: {
  to?: string
  icon: React.ReactNode
  label: string
  active?: boolean
}) {
  const className = clsx(styles.item, active && styles.itemActive)
  const inner = (
    <>
      <span className={styles.itemIcon}>{icon}</span>
      {label}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" className={className}>
      {inner}
    </button>
  )
}

/* --- 인라인 SVG 아이콘 --- */

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}

function BookmarkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18l-6-4-6 4V3z" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V13" />
      <path d="M12 21V7" />
      <path d="M19 21V3" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  )
}
