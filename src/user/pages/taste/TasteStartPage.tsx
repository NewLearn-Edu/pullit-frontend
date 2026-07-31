import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import AppHeader from '@/user/components/AppHeader'
import { useTasteStore, type Subject } from '@/user/stores/tasteStore'
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
  const [selected, setSelected] = useState<Subject>('math')

  const handleNext = () => {
    reset()
    navigate(`/taste/quiz/${selected}/0`)
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
          <button type="button" onClick={handleNext} className={styles.nextButton}>
            다음
          </button>
        </div>
      </main>
    </div>
  )
}
