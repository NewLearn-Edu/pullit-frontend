import { useEffect, useState } from 'react'
import { fetchAttemptHistory, type AttemptHistoryItem } from '@/user/api/attemptApi'
import { AttemptHistoryStrip, historySummary } from './AttemptHistoryStrip'
import styles from './styles/AttemptHistorySection.module.scss'

interface AttemptHistorySectionProps {
  problemId: string
  /** 이미 손에 있는 이력 (오답노트 목록 응답의 attempts) — 주면 따로 조회하지 않는다 */
  preloaded?: AttemptHistoryItem[]
}

/**
 * 풀이 이력 — 문제 보기·다시 풀기 결과의 문제 카드 아래 (2026-09-06).
 * 단원 상세 카드와 같은 띠(AttemptHistoryStrip)를 쓴다 — 한 정보를 두 모양으로 그리지 않는다.
 * 여기선 폭이 넉넉해 회차를 더 보여주고, 제목 옆에 "몇 회에 맞혔는지" 한 줄 요약을 붙인다.
 */
export function AttemptHistorySection({ problemId, preloaded }: AttemptHistorySectionProps) {
  const [fetched, setFetched] = useState<AttemptHistoryItem[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (preloaded) return
    let alive = true
    setFetched(null)
    setFailed(false)
    fetchAttemptHistory(problemId)
      .then((list) => alive && setFetched(list))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [problemId, preloaded])

  const items = preloaded ?? fetched
  // 조회 중엔 자리를 잡지 않는다 — 도착하면 그때 나타난다(빈 자리 깜빡임 방지)
  if (failed || !items || items.length === 0) return null

  return (
    <section className={styles.wrap} aria-label="풀이 이력">
      <div className={styles.head}>
        <h3 className={styles.title}>풀이 이력</h3>
        <span className={styles.summary}>{historySummary(items)}</span>
      </div>
      <div className={styles.strip}>
        <AttemptHistoryStrip attempts={items} limit={8} />
      </div>
    </section>
  )
}
