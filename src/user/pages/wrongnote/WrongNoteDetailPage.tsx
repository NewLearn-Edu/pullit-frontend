import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteWrongNote, fetchWrongNotes, restoreWrongNote, type WrongNoteItem } from '@/user/api/attemptApi'
import { findWrongUnit, formatWrongAt, type WrongUnitRow } from '@/user/services/wrongNotes'
import { EnglishProblemRender, MathProblemRender } from '@/shared/components/ExamRender'
import { useUserStore } from '@/user/stores/userStore'
import { type Subject } from '@/user/stores/tasteStore'
import styles from './styles/WrongNoteDetailPage.module.scss'

/**
 * 오답노트 상세 (/wrong-note/:subject/units/:unitId · Figma 2653-16311)
 * unitId = 단원 식별자 (약점 지도·홈과 공유하는 노드 id, 예: exp-log)
 * 단원의 오답 문제 목록 — 문제 N · 마지막 오답 시각 · 본문 미리보기 · 풀기 버튼.
 * 다시 풀기 플로우는 후속 (버튼은 POC 시각만).
 */
export default function WrongNoteDetailPage() {
  const { subject = 'math', unitId = '' } = useParams<{ subject: Subject; unitId: string }>()
  const navigate = useNavigate()
  const sessionStatus = useUserStore((s) => s.status)

  const [row, setRow] = useState<WrongUnitRow | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [sort, setSort] = useState<SortOrder>('latest')
  // 이번 화면에서 제외 토글한 문제 — 목록에서 바로 지우지 않고(당황 방지) 재진입 시 반영
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ key: number; message: string } | null>(null)
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  // 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    if (!sortOpen) return
    const close = (e: MouseEvent) => {
      if (!sortRef.current?.contains(e.target as Node)) setSortOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [sortOpen])

  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', { replace: true })
  }, [sessionStatus, navigate])

  useEffect(() => {
    let alive = true
    fetchWrongNotes(subject as Subject)
      .then((items) => {
        if (!alive) return
        setRow(findWrongUnit(subject as Subject, items, decodeURIComponent(unitId)) ?? null)
      })
      .catch(() => alive && setRow(null))
      .finally(() => alive && setLoaded(true))
    return () => {
      alive = false
    }
  }, [subject, unitId])

  // 조회를 마쳤는데 단원이 없거나 오답이 비어 있으면 목록으로
  useEffect(() => {
    if (loaded && (!row || row.items.length === 0)) navigate('/wrong-note', { replace: true })
  }, [loaded, row, navigate])

  // 토스트 2.4초 뒤 자동 소멸
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(timer)
  }, [toast])

  const toggleWrongNote = async (problemId: string) => {
    const isExcluded = excluded.has(problemId)
    try {
      if (isExcluded) {
        await restoreWrongNote(problemId)
      } else {
        await deleteWrongNote(problemId)
      }
      setExcluded((prev) => {
        const next = new Set(prev)
        if (isExcluded) next.delete(problemId)
        else next.add(problemId)
        return next
      })
      setToast({
        key: Date.now(),
        message: isExcluded ? '오답노트에 다시 담았어요.' : '오답노트에서 제외됐습니다.',
      })
    } catch {
      setToast({ key: Date.now(), message: '잠시 후 다시 시도해주세요.' })
    }
  }

  const sortedItems = useMemo(() => {
    if (!row) return []
    const items = [...row.items]
    items.sort((a, b) => {
      const diff = (a.lastWrongAt ?? '').localeCompare(b.lastWrongAt ?? '')
      return sort === 'latest' ? -diff : diff
    })
    return items
  }, [row, sort])

  if (!row) return null

  const ProblemRender = subject === 'english' ? EnglishProblemRender : MathProblemRender

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" aria-label="뒤로" onClick={() => navigate('/wrong-note')} className={styles.back}>
          <BackIcon />
        </button>
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>{row.name}</h1>
        <div className={styles.countRow}>
          <p className={styles.count}>오답 {row.items.length}문제</p>

          {/* 정렬 — 마지막 오답 시각 기준 */}
          <div ref={sortRef} className={styles.sort}>
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className={styles.sortButton}
            >
              {SORT_LABEL[sort]}
              <ChevronDownIcon />
            </button>
            {sortOpen && (
              <div className={styles.sortMenu}>
                {(Object.keys(SORT_LABEL) as SortOrder[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSort(key)
                      setSortOpen(false)
                    }}
                    className={key === sort ? styles.sortItemActive : styles.sortItem}
                  >
                    {SORT_LABEL[key]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.list}>
          {/* 고정 높이 미리보기(잘림) + 하단 정보 바 — 지문이 긴 문제도 카드 리듬 일정
              다시 풀기 플로우 후속 (버튼은 POC 시각만) */}
          {sortedItems.map((item: WrongNoteItem, i: number) => (
            <div key={item.problemId} className={styles.card}>
              <div className={styles.cardPreview}>
                <div className={styles.cardProblem} aria-hidden>
                  <ProblemRender text={item.question ?? ''} />
                  {item.passage && (
                    <div className={styles.cardPassage}>
                      <ProblemRender text={item.passage} />
                    </div>
                  )}
                </div>
                <div className={styles.cardTint} aria-hidden />
                <div className={styles.cardFade} aria-hidden />
                <span className={styles.wrongChip}>오답 {item.wrongCount}회</span>
              </div>

              <div className={styles.cardInfo}>
                <button
                  type="button"
                  aria-label={excluded.has(item.problemId) ? '오답노트에 다시 담기' : '오답노트에서 제외'}
                  onClick={() => toggleWrongNote(item.problemId)}
                  className={styles.noteToggle}
                >
                  <BookmarkIcon filled={!excluded.has(item.problemId)} />
                </button>
                <div className={styles.cardMeta}>
                  <p className={styles.cardNo}>
                    {item.unitLarge && <>{item.unitLarge} · </>}문제 {i + 1}
                  </p>
                  <p className={styles.cardSub}>
                    {item.points != null && <>{item.points}점 · </>}
                    {item.difficulty && <>{difficultyLabel(item.difficulty)} · </>}
                    {formatWrongAt(item.lastWrongAt)}
                  </p>
                </div>
                <button type="button" className={styles.retryButton}>
                  다시 풀기
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {toast && (
        <div key={toast.key} className={styles.toast} role="status">
          {toast.message}
        </div>
      )}

      {/* 하단 고정 — 단원 오답 전체 다시 풀기 (플로우 후속) */}
      <div className={styles.footer}>
        <button type="button" className={styles.solveAllButton}>
          오답 전체 풀기
        </button>
      </div>
    </div>
  )
}

type SortOrder = 'latest' | 'oldest'

const SORT_LABEL: Record<SortOrder, string> = {
  latest: '최신순',
  oldest: '오래된순',
}

const DIFFICULTY_LABEL: Record<string, string> = {
  basic: '기본',
  normal: '보통',
  advanced: '심화',
}

function difficultyLabel(difficulty: string): string {
  return DIFFICULTY_LABEL[difficulty.toLowerCase()] ?? difficulty
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18l-6-4-6 4V3z" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}
