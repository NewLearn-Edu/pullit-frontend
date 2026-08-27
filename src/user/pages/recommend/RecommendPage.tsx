import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import OnboardingHeader from '@/user/components/OnboardingHeader'
import RecommendReveal from './RecommendReveal'
import { SET_CREDIT_COST } from '@/user/stores/trialProgressStore'
import { useUserStore } from '@/user/stores/userStore'
import type { Subject } from '@/user/stores/trialStore'
import styles from './styles/RecommendPage.module.scss'

interface SubjectOption {
  value: Subject
  title: string
  /** 과목이 다루는 범위 — 어느 쪽을 고를지 판단할 재료 */
  sub: string
}

const SUBJECT_OPTIONS: SubjectOption[] = [
  { value: 'math', title: '수학', sub: '대수 · 미적분 I · 확률과 통계' },
  { value: 'english', title: '영어', sub: '16유형 · 4영역' },
]

/**
 * 추천 랜딩 (/recommend) — 알림톡 버튼·나브 추천 버튼의 공용 진입점 (2026-08-26 정책)
 *
 * - 쿼리 없이 오면(알림톡) 과목 선택 카드 2장 "뭐부터 풀래?"
 * - ?subject=math|english 로 오면(앱 나브 버튼·홈 추천 CTA) 선택 뷰를 건너뛰고
 *   바로 추천 리빌(RecommendReveal)로 — 전체 단원 캔버스에서 풀어야 할 곳을 집어 준다
 *
 * 과목은 따로 돈다 (수학 탭에서는 수학, 영어 탭에서는 영어).
 */
export default function RecommendPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const sessionStatus = useUserStore((s) => s.status)

  const raw = searchParams.get('subject')
  const subject: Subject | null = raw === 'math' || raw === 'english' ? raw : null

  // 로그인 필요 페이지 — 세션 조회를 마쳤는데 아무 세션도 없으면 로그인으로
  useEffect(() => {
    if (sessionStatus === 'anonymous')
      navigate('/login', {
        replace: true,
        state: { from: window.location.pathname + window.location.search },
      })
  }, [sessionStatus, navigate])

  const closeToHome = () => navigate('/home', { replace: true })

  // ── 추천 리빌 ──────────────────────────────────────────────────────────────
  // 세션이 준비돼야 진단 기록·크레딧을 함께 읽을 수 있다
  if (subject) {
    if (sessionStatus !== 'ready') {
      return (
        <div className={styles.page}>
          <OnboardingHeader onClose={closeToHome} />
          <main className={styles.main}>
            <div className={styles.status}>
              <span className={styles.spinner} aria-hidden />
            </div>
          </main>
        </div>
      )
    }
    return <RecommendReveal key={subject} subject={subject} />
  }

  // ── 과목 선택 (알림톡 랜딩) ────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <OnboardingHeader onClose={closeToHome} />

      <main className={styles.main}>
        <h1 className={styles.title}>오늘의 3문제 도착!</h1>
        <p className={styles.subtitle}>뭐부터 풀래?</p>

        <div className={styles.cards}>
          {SUBJECT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSearchParams({ subject: opt.value }, { replace: true })}
              className={styles.card}
            >
              <span className={styles.cardBody}>
                <span className={styles.cardTitle}>{opt.title}</span>
                <span className={styles.cardSub}>{opt.sub}</span>
              </span>
              <span className={styles.cardChevron} aria-hidden>
                <ChevronIcon />
              </span>
            </button>
          ))}
        </div>

        <div className={styles.creditNote}>
          <span className={styles.creditNoteIcon} aria-hidden>
            i
          </span>
          <p className={styles.creditNoteText}>
            문제를 풀 때{' '}
            <span className={styles.creditNoteStrong}>크레딧 {SET_CREDIT_COST}개</span>가 사용돼
          </p>
        </div>
      </main>
    </div>
  )
}

/** 카드 우측 셰브런 — 홈 소단원 카드와 같은 규격(20px · 1.6 stroke) */
function ChevronIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="m7.5 4.5 6 5.5-6 5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
