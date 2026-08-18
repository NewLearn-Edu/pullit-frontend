import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import OnboardingHeader from '@/user/components/OnboardingHeader'
import { useTrialStore, type Subject } from '@/user/stores/trialStore'
import { useUserStore } from '@/user/stores/userStore'
import { flushAttemptQueue } from '@/user/services/attemptQueue'
import { useTrialFunnelGuard } from '@/user/hooks/useTrialFunnelGuard'
import styles from './styles/TrialStartPage.module.scss'

interface SubjectOption {
  value: Subject
  title: string
  sub: string
}

// 서브텍스트는 단원·유형 명칭 정책의 표시 명칭 — 맛보기 고정 영역 (수학 지수·로그 · 영어 주제)
const SUBJECT_OPTIONS: SubjectOption[] = [
  { value: 'math', title: '수학', sub: '지수·로그' },
  { value: 'english', title: '영어', sub: '주제' },
]

/**
 * 맛보기 진단 · 과목 선택 페이지 (Figma 2253-118)
 * 과목 하나를 골라 "다음" → 해당 과목 3문제 풀이 → 완주.
 */
export default function TrialStartPage() {
  const navigate = useNavigate()
  const ensureSession = useUserStore((s) => s.ensureSession)
  const reset = useTrialStore((s) => s.reset)
  const setLastSubject = useTrialStore((s) => s.setLastSubject)
  const [selected, setSelected] = useState<Subject>('math')
  const [pending, setPending] = useState(false)
  const [sessionFailed, setSessionFailed] = useState(false)

  // 맛보기를 이미 완주한 회원만 홈으로 — 미완이면 방금 가입한 회원도 퍼널을 탄다
  useTrialFunnelGuard()

  /**
   * 퀴즈 직행 — 인트로(/start)가 랜딩 → 과목 선택 앞 단계로 옮겨가면서
   * 인트로가 하던 reset·setLastSubject 를 여기(퀴즈 진입 직전)서 처리한다
   */
  const start = () => {
    reset()
    setLastSubject(selected)
    navigate(`/trial/quiz/${selected}/0`)
  }

  const handleNext = async () => {
    setPending(true)
    setSessionFailed(false)
    // 게스트 계정이 있어야 풀이가 서버에 쌓이고 가입 시 기록이 승계된다
    const me = await ensureSession()
    setPending(false)

    if (!me) {
      setSessionFailed(true)   // 진행 자체는 막지 않고 "그래도 시작" 을 열어준다
      return
    }
    flushAttemptQueue()        // 이전 세션 미전송분 회수 (진행을 막지 않음)
    start()
  }

  return (
    <div className={styles.page}>
      {/* 시안 2824-4756 헤더 — 우측 닫기 X 만 (로고 없음) */}
      <OnboardingHeader onClose={() => navigate('/')} />

      <main className={styles.main}>
        <h1 className={styles.title}>어떤 과목의 약점을 볼래?</h1>
        <p className={styles.subtitle}>약한 단원을 찾아 매일 3문제를 추천해줄게</p>

        <div className={styles.cards} role="radiogroup" aria-label="과목 선택">
          {SUBJECT_OPTIONS.map((opt) => {
            const active = selected === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(opt.value)}
                className={clsx(styles.card, active && styles.cardSelected)}
              >
                <span className={styles.cardBody}>
                  <span className={styles.cardTitle}>{opt.title}</span>
                  <span className={styles.cardSub}>{opt.sub}</span>
                </span>
                <span
                  aria-hidden
                  className={clsx(styles.radio, active && styles.radioSelected)}
                />
              </button>
            )
          })}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            onClick={handleNext}
            disabled={pending}
            className={styles.nextButton}
          >
            {pending ? '준비 중…' : '다음'}
          </button>

          {/* 세션 확보 실패 — 기록은 못 남기지만 진단 자체는 볼 수 있게 열어준다 */}
          {sessionFailed && (
            <div className="mt-md text-center">
              <p className="text-body-sm text-body">
                지금은 기록을 저장할 수 없어요. 결과는 볼 수 있어요.
              </p>
              <button
                type="button"
                onClick={start}
                className="mt-sm text-body-sm font-semibold text-primary underline"
              >
                그래도 시작하기
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
