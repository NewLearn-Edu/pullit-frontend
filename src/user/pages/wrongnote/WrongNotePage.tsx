import { useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { UserNav } from '@/user/components/UserNav'
import { type Subject } from '@/user/stores/tasteStore'
import styles from './styles/WrongNotePage.module.scss'

// POC 목 데이터 · 백엔드 연동 시 API 로 대체
interface WrongUnit {
  name: string
  count: number
  cat: string
}

const WRONG_UNITS: Record<Subject, WrongUnit[]> = {
  math: [
    { name: '확률의 곱셈정리', count: 3, cat: '확률과 통계' },
    { name: '이항분포', count: 3, cat: '확률과 통계' },
    { name: '수열의 극한', count: 2, cat: '미적분' },
  ],
  english: [
    { name: '빈칸 추론', count: 2, cat: '독해' },
    { name: '어법', count: 1, cat: '어법' },
  ],
}

const CREDIT = 5

/**
 * 오답노트 (Figma 177)
 * 틀린 문제를 단원별로 묶어 보여주고 복습 진입.
 */
export default function WrongNotePage() {
  const [subject, setSubject] = useState<Subject>('math')

  const units = WRONG_UNITS[subject]
  const totalCount = units.reduce((s, u) => s + u.count, 0)

  return (
    <div className={styles.page}>
      <UserNav active="wrongNote" credit={CREDIT} />

      <main className={styles.main}>
        {/* 모바일 상단 헤더 */}
        <header className={styles.mobileHeader}>
          <Link to="/home" className={styles.logo}>
            풀잇
          </Link>
          <span className={styles.creditPillSmall}>
            <span className={styles.creditSpark}>✦</span> {CREDIT}
          </span>
        </header>

        <div className={styles.panel}>
          <h1 className={styles.title}>오답노트</h1>
          <p className={styles.subtitle}>틀린 문제를 단원별로 모았어요</p>

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

          {/* 목록 헤더 */}
          <div className={styles.listHead}>
            <h2 className={styles.listCount}>틀린 문제 {totalCount}개</h2>
            <span className={styles.listSort}>최근 오답순</span>
          </div>

          {/* 오답 단원 카드 목록 */}
          {units.length > 0 ? (
            <div className={styles.list}>
              {units.map((u) => (
                <div key={u.name} className={styles.card}>
                  <div className={styles.cardBody}>
                    <span className={styles.cardName}>{u.name}</span>
                    <span className={styles.cardMeta}>
                      오답 {u.count}개 · {u.cat}
                    </span>
                  </div>
                  {/* POC · 복습 플로우 미구현 (시각만) */}
                  <button type="button" className={styles.reviewButton}>
                    복습하기
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>아직 틀린 문제가 없어요</p>
          )}
        </div>
      </main>
    </div>
  )
}
