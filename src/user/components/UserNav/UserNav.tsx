import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { useUserStore } from '@/user/stores/userStore'
import { useTrialStore } from '@/user/stores/trialStore'
import styles from './styles/UserNav.module.scss'
import { WrongNoteIcon } from '@/user/components/icons/WrongNoteIcon'
import { HomeIcon, MapIcon, ProfileIcon, ReportIcon } from '@/user/components/icons/NavIcons'
import { RecommendIcon } from '@/user/components/icons/RecommendIcon'

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
  // 나브 추천 버튼은 과목 선택 뷰를 건너뛴다 (2026-08-26 정책) — 마지막 학습 과목으로
  const lastSubject = useTrialStore((s) => s.lastSubject)
  const todayLink = `/today?subject=${lastSubject ?? 'math'}`

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <aside className={styles.sidebar}>
        <Link to="/home" className={styles.logo}>
          풀잇
        </Link>
        <nav className={styles.nav}>
          {/* 오늘의 추천은 홈의 추천 문제 CTA 가 담당 — 사이드바에서는 뺀다 (2026-08-27) */}
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

      {/* iPad · 모바일 하단 네비 (Figma 3450-8896 — 홈 · 약점 지도 · 추천 문제 · 학습 기록 · 마이) */}
      <nav className={styles.bottomNav} aria-label="메인 메뉴">
        {/* 가운데 FAB 자리에 솟은 언덕 — 바 상단선이 그대로 이어진다 */}
        <NavHump />
        <BottomItem to="/home" label="홈" active={active === 'recommend'}>
          <HomeIcon size={21} filled />
        </BottomItem>
        <BottomItem to="/weakness-map" label="약점 지도" active={active === 'map'}>
          <MapIcon size={21} filled />
        </BottomItem>
        {/* 추천 문제 — 아이콘 자리는 언덕 위로 뜬 FAB 가 대신한다 (시안도 아이콘 프레임이 비어 있음) */}
        <Link to={todayLink} className={clsx(styles.bottomItem, styles.bottomCenter)}>
          <span className={styles.bottomIcon} aria-hidden />
          추천 문제
          <span className={styles.bottomFab} aria-hidden>
            <RecommendIcon size={48} />
          </span>
        </Link>
        {/* 오답노트는 학습 기록 섹션 소속 — 하단 네비에서는 학습 기록을 활성 표시 */}
        <BottomItem
          to="/report"
          label="학습 기록"
          active={active === 'report' || active === 'wrongNote'}
        >
          <ReportIcon size={21} filled />
        </BottomItem>
        <BottomItem to="/my" label="마이" active={active === 'my'}>
          <ProfileIcon size={21} filled />
        </BottomItem>
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

/** 하단 네비 한 칸 — 21px 아이콘 + 5px 간격 + 12px SemiBold 라벨 */
function BottomItem({
  to,
  label,
  active,
  children,
}: {
  to: string
  label: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className={clsx(styles.bottomItem, active && styles.bottomItemActive)}
      aria-current={active ? 'page' : undefined}
    >
      <span className={styles.bottomIcon}>{children}</span>
      {label}
    </Link>
  )
}

/* --- 인라인 SVG 아이콘 --- */

/**
 * 하단 네비 상단 곡선 (Figma Union 3450:8848).
 * 바 상단선(y=11)에서 시작해 가운데 32.97px 지점에서 11px 솟았다가 다시 내려온다.
 * 양 끝 컨트롤 포인트가 수평이라 바의 border-top 과 이음매 없이 이어진다.
 * 좌표는 stroke 1px 이 border-top 행(바 기준 y 0~1)에 정확히 얹히도록 0.5 내렸다.
 */
const HUMP_PATH =
  'M0 11.5C5.937 11.5 11.37 8.53 16.372 5.33C21.149 2.275 26.85 0.5 32.973 0.5C39.096 0.5 44.797 2.275 49.574 5.33C54.576 8.53 60.009 11.5 65.946 11.5'

function NavHump() {
  return (
    <svg className={styles.bottomHump} viewBox="0 0 65.946 12" fill="none" aria-hidden>
      <path d={`${HUMP_PATH}V12H0V11.5Z`} fill="#fff" />
      <path d={HUMP_PATH} stroke="#E5E7EA" strokeWidth="1" />
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

