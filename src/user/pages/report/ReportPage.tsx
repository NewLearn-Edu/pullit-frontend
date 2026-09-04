import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserNav } from '@/user/components/UserNav'
import { PageHeader } from '@/user/components/PageHeader'
import { SubjectTabs } from '@/user/components/SubjectTabs'
import { CreditBadge } from '@/user/components/CreditBadge'
import { Skeleton } from '@/user/components/Skeleton'
import { WrongNoteIcon } from '@/user/components/icons/WrongNoteIcon'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import { type Subject } from '@/user/stores/trialStore'
import { fetchDailyActivity, type DailyActivity } from '@/user/api/attemptApi'
import { ScoreComparisonCard } from './components/ScoreComparisonCard'
import { StreakHeatmapCard } from './components/StreakHeatmapCard'
import { WeeklyLearningCard } from './components/WeeklyLearningCard'
import styles from './styles/ReportPage.module.scss'

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

  // 일별 학습량 — 잔디(1년)와 이번 주 차트가 같은 데이터를 나눠 쓴다.
  // 도착 전에는 두 카드 자리에 스켈레톤 (빈 잔디 → 채움 깜빡임 방지).
  // 실패해도 게이트는 열어 빈 상태로나마 그린다 (스켈레톤에 갇히지 않게)
  const [activity, setActivity] = useState<DailyActivity[]>([])
  const [activityLoaded, setActivityLoaded] = useState(false)
  useEffect(() => {
    fetchDailyActivity()
      .then(setActivity)
      .catch(() => {})
      .finally(() => setActivityLoaded(true))
  }, [])
  // joinedAt(잔디 시작 기준)까지 확정된 뒤에 그린다 — 53주 → 가입 월 판 재계산 점프 방지
  const cardsReady = activityLoaded && sessionStatus === 'ready'

  return (
    <div className={styles.page}>
      <UserNav active="report" subject={subject} />

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
            </>
          }
        />

        <div className={styles.content}>
          <h1 className={styles.title}>학습 리포트</h1>

          <ScoreComparisonCard subject={subject} />
          {cardsReady ? (
            <>
              <StreakHeatmapCard today={today} activity={activity} joinedAt={me?.joinedAt} />
              <WeeklyLearningCard activity={activity} today={today} />
            </>
          ) : (
            <>
              <Skeleton style={{ height: 272 }} />
              <Skeleton style={{ height: 336 }} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
