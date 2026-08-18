import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import AppHeader from '@/user/components/AppHeader'
import { type Subject } from '@/user/stores/trialStore'
import { selectIsMember, useUserStore } from '@/user/stores/userStore'
import { flushAttemptQueue } from '@/user/services/attemptQueue'
import { useMe } from '@/user/hooks/useMe'
import styles from './styles/TrialStartPage.module.scss'

interface SubjectOption {
  value: Subject
  icon: string
  title: string
  sub: string
}

const SUBJECT_OPTIONS: SubjectOption[] = [
  { value: 'math', icon: '수', title: '수학', sub: '지수와 로그' },
  { value: 'english', icon: '영', title: '영어', sub: '빈칸 추론' },
]

/**
 * 맛보기 진단 · 과목 선택 페이지 (Figma 2253-118)
 * 과목 하나를 골라 "다음" → 해당 과목 3문제 풀이 → 완주.
 */
export default function TrialStartPage() {
  const navigate = useNavigate()
  const ensureSession = useUserStore((s) => s.ensureSession)
  const [selected, setSelected] = useState<Subject>('math')
  const [pending, setPending] = useState(false)
  const [sessionFailed, setSessionFailed] = useState(false)

  // 회원은 맛보기 퍼널 대상이 아니다 — 홈으로 (조회 전용이라 게스트 생성 없음)
  useMe()
  const isMember = useUserStore(selectIsMember)
  useEffect(() => {
    if (isMember) navigate('/home', { replace: true })
  }, [isMember, navigate])

  /**
   * 시네마틱 인트로(/start/:subject)로 — reset·setLastSubject 는 인트로의
   * 시작하기 클릭에서 처리되므로 여기선 이동만 한다 (실패해도 기존 결과 보존)
   */
  const start = () => navigate(`/start/${selected}`)

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
      <AppHeader onClose={() => navigate('/')} />

      <main className={styles.main}>
        <h1 className={styles.title}>어떤 과목을 진단할까요?</h1>
        <p className={styles.subtitle}>약한 단원을 찾아 매일 3문제를 추천해요.</p>

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
                <span
                  className={clsx(
                    styles.cardIcon,
                    active && styles.cardIconSelected,
                  )}
                >
                  {opt.icon}
                </span>
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
