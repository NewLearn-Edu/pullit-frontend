import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserNav } from '@/user/components/UserNav'
import { PageHeader } from '@/user/components/PageHeader'
import { SubjectTabs } from '@/user/components/SubjectTabs'
import { CreditBadge } from '@/user/components/CreditBadge'
import { WrongNoteIcon } from '@/user/components/icons/WrongNoteIcon'
import { ProfileIcon } from '@/user/components/icons/NavIcons'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import { type Subject } from '@/user/stores/tasteStore'
import { ENGLISH_ABILITIES } from '@/user/data/englishAbilities'
import { ScoreComparisonCard } from './components/ScoreComparisonCard'
import { StreakHeatmapCard } from './components/StreakHeatmapCard'
import { WeeklyLearningCard } from './components/WeeklyLearningCard'
import styles from './styles/ReportPage.module.scss'

/** 비교 대상 — 수학은 대분류, 영어는 독해 능력 4분류 */
const CATEGORIES: Record<Subject, string[]> = {
  math: ['대수', '미적분 I', '확률과 통계'],
  english: ENGLISH_ABILITIES.map((a) => a.name),
}

/**
 * 학습 리포트 (/report · Figma 2678-8990)
 * 회색 배경 위 카드 3장 — 평균 점수 비교 · 학습 연속일 · 이번 주 학습.
 * 헤더 과목 토글은 세 카드 전체에 적용된다 (전 구간 동일 과목 기준).
 */
export default function ReportPage() {
  const navigate = useNavigate()
  const { me } = useMe()
  const sessionStatus = useUserStore((s) => s.status)

  // 리포트는 계정 단위 데이터 — 세션 없으면 로그인으로
  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', {
        replace: true,
        // 로그인 후 이 페이지로 복귀 (LoginPage 가 postLoginRedirect 로 저장)
        state: { from: window.location.pathname + window.location.search },
      })
  }, [sessionStatus, navigate])

  const [subject, setSubject] = useState<Subject>('math')

  // 오늘 날짜는 한 번만 고정 — 렌더마다 새 Date 를 만들면 자식 useMemo 가 매번 무효화된다
  const today = useMemo(() => new Date(), [])

  return (
    <div className={styles.page}>
      <UserNav active="report" />

      <main className={styles.main}>
        {/* 상단 헤더 — 홈·오답노트와 동일 문법 */}
        <PageHeader
          left={<CreditBadge credit={me?.creditBalance ?? 0} />}
          center={<SubjectTabs pill value={subject} onChange={setSubject} />}
          hideRightOnDesktop
          right={
            <>
              <button
                type="button"
                aria-label="오답노트"
                onClick={() => navigate('/wrong-note')}
                className={styles.iconCircle}
              >
                <WrongNoteIcon size={18} />
              </button>
              <button
                type="button"
                aria-label="마이페이지"
                onClick={() => navigate('/my')}
                className={styles.iconCircle}
              >
                <ProfileIcon size={18} />
              </button>
            </>
          }
        />

        <div className={styles.content}>
          <h1 className={styles.title}>학습 리포트</h1>

          <ScoreComparisonCard subject={subject} categories={CATEGORIES[subject]} />
          <StreakHeatmapCard today={today} />
          <WeeklyLearningCard subject={subject} today={today} />
        </div>
      </main>
    </div>
  )
}
