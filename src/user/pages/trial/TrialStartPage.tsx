import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import OnboardingHeader from '@/user/components/OnboardingHeader'
import { useTrialStore, type Subject } from '@/user/stores/trialStore'
import { flushAttemptQueue } from '@/user/services/attemptQueue'
import { isEarlybird } from '@/user/services/earlybird'
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
  const reset = useTrialStore((s) => s.reset)
  const setLastSubject = useTrialStore((s) => s.setLastSubject)
  const [selected, setSelected] = useState<Subject>('math')

  // 맛보기를 이미 완주한 회원만 홈으로 — 미완이면 방금 가입한 회원도 퍼널을 탄다
  useTrialFunnelGuard()

  /**
   * 퀴즈 직행 — 세션 없이 시작한다. users 로우는 결과 화면 이후 /signup 에서
   * 건너뛰기(게스트) 또는 소셜 가입 시점에만 생성된다 (2026-08-19 확정).
   * 풀이 기록은 큐에 쌓였다가 그 시점에 일괄 전송된다.
   */
  const handleNext = () => {
    flushAttemptQueue() // 세션 있는 재도전(미완 회원)의 이전 미전송분 회수 — 익명이면 no-op
    reset()
    setLastSubject(selected)
    navigate(`/trial/quiz/${selected}/0`)
  }

  return (
    <div className={styles.page}>
      {/* 시안 2824-4756 헤더 — 우측 닫기 X 만 (로고 없음) */}
      {/* 얼리버드 테스터의 X 는 얼리버드 랜딩으로 — 일반 랜딩(/)은 비밀번호 게이트 뒤라 막힌다 */}
      <OnboardingHeader onClose={() => navigate(isEarlybird() ? '/earlybird' : '/')} />

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
          <button type="button" onClick={handleNext} className={styles.nextButton}>
            다음
          </button>
        </div>
      </main>
    </div>
  )
}
