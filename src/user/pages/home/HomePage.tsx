import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { UserNav } from '@/user/components/UserNav'
import { SubjectTabs } from '@/user/components/SubjectTabs'
import { CreditBadge } from '@/user/components/CreditBadge'
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
      {/* 공용 네비게이션 · 데스크탑 사이드바 + 모바일 하단 바 */}
      <UserNav active="recommend" />

      <main className={styles.main}>
        {/* 모바일 · iPad 상단 헤더 */}
        <header className={clsx(styles.mobileOnly, styles.mobileHeader)}>
          <Link to="/home" className={styles.logo}>
            풀잇
          </Link>
          <div className={styles.mobileHeaderRight}>
            <CreditBadge credit={CREDIT} />
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
          <CreditBadge credit={CREDIT} size="md" />
        </div>

        {/* 과목 탭 */}
        <div className={styles.tabsWrap}>
          <SubjectTabs value={subject} onChange={setSubject} />
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
          <button
            type="button"
            onClick={() => navigate('/wrong-note')}
            className={styles.quickLink}
          >
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

    </div>
  )
}

/* --- 인라인 SVG 아이콘 --- */

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
