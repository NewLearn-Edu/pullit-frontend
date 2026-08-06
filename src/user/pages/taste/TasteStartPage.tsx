import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import AppHeader from '@/user/components/AppHeader'
import { useTasteStore, type Subject } from '@/user/stores/tasteStore'
import { useUserStore } from '@/user/stores/userStore'
import { flushAttemptQueue } from '@/user/services/attemptQueue'
import styles from './styles/TasteStartPage.module.scss'

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
 * 과목 하나를 골라 "다음" → 해당 과목 4문제 풀이 → 완주.
 */
export default function TasteStartPage() {
  const navigate = useNavigate()
  const reset = useTasteStore((s) => s.reset)
  const setLastSubject = useTasteStore((s) => s.setLastSubject)
  const ensureSession = useUserStore((s) => s.ensureSession)
  const [selected, setSelected] = useState<Subject>('math')
  const [pending, setPending] = useState(false)
  const [sessionFailed, setSessionFailed] = useState(false)

  /** 세션 확보 후 퀴즈로 — 실패해도 reset 하지 않아 기존 결과가 날아가지 않는다 */
  const start = () => {
    reset()
    setLastSubject(selected)
    navigate(`/taste/quiz/${selected}/0`)
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
