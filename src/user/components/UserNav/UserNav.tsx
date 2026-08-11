import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { useUserStore } from '@/user/stores/userStore'
import styles from './styles/UserNav.module.scss'
import { WrongNoteIcon } from '@/user/components/icons/WrongNoteIcon'
import { HomeIcon, MapIcon, ProfileIcon, ReportIcon } from '@/user/components/icons/NavIcons'

export type UserNavKey = 'recommend' | 'map' | 'wrongNote' | 'report' | 'my'

interface UserNavProps {
  active: UserNavKey
}

/**
 * 학생 서비스 공용 네비게이션.
 * - 데스크탑: 좌측 사이드바 (홈 · 약점 지도 · 오답노트 · 리포트 · 마이페이지)
 * - iPad · 모바일: 하단 네비 바 (홈 · 약점 지도 · 학습 기록)
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
          <NavItem to="/home" icon={<HomeIcon filled={active === 'recommend'} />} label="홈" active={active === 'recommend'} />
          <NavItem to="/weakness-map" icon={<MapIcon filled={active === 'map'} />} label="약점 지도" active={active === 'map'} />
          <NavItem to="/wrong-note" icon={<WrongNoteIcon size={20} filled={active === 'wrongNote'} />} label="오답노트" active={active === 'wrongNote'} />
          <NavItem to="/report" icon={<ReportIcon filled={active === 'report'} />} label="학습 리포트" active={active === 'report'} />
          <NavItem to="/my" icon={<ProfileIcon filled={active === 'my'} />} label="마이페이지" active={active === 'my'} />
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
          <HomeIcon filled={active === 'recommend'} />홈
        </Link>
        <Link
          to="/weakness-map"
          className={clsx(styles.bottomItem, active === 'map' && styles.bottomItemActive)}
        >
          <MapIcon filled={active === 'map'} />
          약점 지도
        </Link>
        <Link
          to="/report"
          // 오답노트는 학습 리포트 섹션 소속 — 하단 네비에서는 리포트를 활성 표시 (시안 2632-7566)
          className={clsx(
            styles.bottomItem,
            (active === 'report' || active === 'wrongNote') && styles.bottomItemActive,
          )}
        >
          <ReportIcon filled={active === 'report' || active === 'wrongNote'} />
          학습 리포트
        </Link>
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





function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
    </svg>
  )
}

