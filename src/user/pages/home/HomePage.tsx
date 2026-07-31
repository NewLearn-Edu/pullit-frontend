import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { useTasteStore, type Subject } from '@/user/stores/tasteStore'
import styles from './styles/HomePage.module.scss'

// POC 목 데이터 · 백엔드 연동 시 API 로 대체
const HERO: Record<Subject, { unit: string; desc: string }> = {
  math: {
    unit: '지수와 로그',
    desc: '약점 결과 기준 · 예상 6분 · 기본 유형부터 다시 잡아요',
  },
  english: {
    unit: '빈칸 추론',
    desc: '약점 결과 기준 · 예상 6분 · 기본 유형부터 다시 잡아요',
  },
}

const UNITS: Record<Subject, Array<{ cat: string; name: string }>> = {
  math: [
    { cat: '대수', name: '삼각함수' },
    { cat: '대수', name: '사인법칙과 코사인 법칙' },
    { cat: '대수', name: '등차수열과 등비수열' },
  ],
  english: [
    { cat: '유형', name: '주제 추론' },
    { cat: '유형', name: '제목 추론' },
    { cat: '유형', name: '요약문 완성' },
  ],
}

const CREDIT = 5

/**
 * 메인 홈 (Figma 173~175)
 * - 데스크탑 (>=1024px): 좌측 사이드바 · 히어로 2열 · 단원 카드 그리드
 * - iPad · 모바일 (<1024px): 상단 헤더 · 하단 네비 바 · 단원 리스트
 */
export default function HomePage() {
  const navigate = useNavigate()
  const reset = useTasteStore((s) => s.reset)
  const [subject, setSubject] = useState<Subject>('math')

  // 추천 문제 풀기 · POC 는 맛보기 퀴즈 플로우로 진입
  const startQuiz = () => {
    reset()
    navigate(`/taste/quiz/${subject}/0`)
  }

  const hero = HERO[subject]
  const units = UNITS[subject]

  return (
    <div className={styles.page}>
      {/* 데스크탑 사이드바 */}
      <aside className={styles.sidebar}>
        <Link to="/home" className={styles.sidebarLogo}>
          풀잇
        </Link>
        <nav className={styles.sidebarNav}>
          <SidebarItem icon={<HomeIcon />} label="추천 문제" active />
          <SidebarItem icon={<DocIcon />} label="자유 문제" />
          <SidebarItem icon={<ChartIcon />} label="리포트" />
        </nav>
        <div className={styles.sidebarFooter}>
          <button type="button" className={styles.bellButton} aria-label="알림">
            <BellIcon />
          </button>
          <span className={styles.avatar}>S</span>
        </div>
      </aside>

      <main className={styles.main}>
        {/* 모바일 · iPad 상단 헤더 */}
        <header className={clsx(styles.mobileOnly, styles.mobileHeader)}>
          <Link to="/home" className={styles.sidebarLogo}>
            풀잇
          </Link>
          <div className={styles.mobileHeaderRight}>
            <span className={styles.creditPillSmall}>
              <span className={styles.creditSpark}>✦</span> {CREDIT}
            </span>
            <span className={styles.avatarMuted}>
              <PersonIcon />
            </span>
          </div>
        </header>

        {/* 데스크탑 헤딩 + 크레딧 */}
        <div className={clsx(styles.desktopOnly, styles.heading)}>
          <div>
            <p className={styles.headingEyebrow}>매일 3문제</p>
            <h1 className={styles.headingTitle}>약한 단원부터, 지금 바로 풀어.</h1>
          </div>
          <span className={styles.creditPill}>
            <span className={styles.creditSpark}>✦</span> 크레딧 {CREDIT}
          </span>
        </div>

        {/* 과목 탭 */}
        <div className={styles.tabs} role="tablist" aria-label="과목">
          <button
            type="button"
            role="tab"
            aria-selected={subject === 'math'}
            onClick={() => setSubject('math')}
            className={clsx(styles.tab, subject === 'math' && styles.tabActive)}
          >
            수학
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subject === 'english'}
            onClick={() => setSubject('english')}
            className={clsx(styles.tab, subject === 'english' && styles.tabActive)}
          >
            영어
          </button>
        </div>

        {/* 히어로 행 · 빨간 추천 카드 + (데스크탑) 학습 상태 */}
        <div className={styles.heroRow}>
          <div className={styles.heroCard}>
            <span className={styles.heroBadge}>매일 3문제</span>
            <h2 className={styles.heroTitle}>{hero.unit}</h2>
            <p className={styles.heroDesc}>{hero.desc}</p>
            <button type="button" onClick={startQuiz} className={styles.heroButton}>
              추천 문제 풀기
            </button>
          </div>

          <div className={clsx(styles.desktopOnly, styles.statusCard)}>
            <h3 className={styles.statusTitle}>내 학습 상태</h3>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>진단한 단원</span>
              <span className={styles.statusValue}>1 / 21</span>
            </div>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>약점 단원</span>
              <span className={clsx(styles.statusValue, styles.statusValueDanger)}>
                1개
              </span>
            </div>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>쌓인 오답</span>
              <span className={styles.statusValue}>2문제</span>
            </div>
            <button type="button" className={styles.statusButton}>
              리포트 보기 <ChevronRightIcon />
            </button>
          </div>
        </div>

        {/* 모바일 · 로드맵 / 오답노트 퀵 링크 */}
        <div className={clsx(styles.mobileOnly, styles.quickLinks)}>
          <button type="button" className={styles.quickLink}>
            <MapIcon /> 로드맵
          </button>
          <button type="button" className={styles.quickLink}>
            <BookmarkIcon /> 오답노트
          </button>
        </div>

        {/* 빨리 풀기 (데스크탑) / 추천 단원 (모바일) */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>빨리 풀기</h2>
              <p className={clsx(styles.desktopOnly, styles.sectionSub)}>
                아직 약점 진단 못한 단원을 이어서 풀어봐
              </p>
            </div>
            <button type="button" className={styles.sectionMore}>
              모든 단원 보기 <ChevronRightIcon />
            </button>
          </div>

          {/* 데스크탑 · 카드 그리드 */}
          <div className={styles.unitGrid}>
            {units.map((u) => (
              <div key={u.name} className={styles.unitCard}>
                <span className={styles.unitCat}>{u.cat}</span>
                <h3 className={styles.unitName}>{u.name}</h3>
                <button type="button" onClick={startQuiz} className={styles.unitButton}>
                  테스트 시작
                </button>
              </div>
            ))}
          </div>

          {/* 모바일 · 리스트 행 */}
          <div className={styles.unitList}>
            {units.map((u) => (
              <div key={u.name} className={styles.unitRow}>
                <div className={styles.unitRowBody}>
                  <span className={styles.unitRowCat}>{u.cat}</span>
                  <span className={styles.unitRowName}>{u.name}</span>
                </div>
                <button
                  type="button"
                  onClick={startQuiz}
                  className={styles.unitRowButton}
                >
                  문제 풀기
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* 하단 네비게이션 (iPad · 모바일) */}
      <nav className={clsx(styles.mobileOnly, styles.bottomNav)} aria-label="메인 메뉴">
        <button type="button" className={clsx(styles.bottomNavItem, styles.bottomNavItemActive)}>
          <HomeIcon />
          추천 문제
        </button>
        <button type="button" className={styles.bottomNavItem}>
          <DocIcon />
          자유 문제
        </button>
        <button type="button" className={styles.bottomNavItem}>
          <ChartIcon />
          리포트
        </button>
      </nav>
    </div>
  )
}

function SidebarItem({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
}) {
  return (
    <button
      type="button"
      className={clsx(styles.sidebarItem, active && styles.sidebarItemActive)}
    >
      <span
        className={clsx(
          styles.sidebarItemIcon,
          active && styles.sidebarItemIconActive,
        )}
      >
        {icon}
      </span>
      {label}
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

function DocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
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

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function BookmarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18l-6-4-6 4V3z" />
    </svg>
  )
}
