import { useEffect, useMemo, useRef, useState } from 'react'
import { Toast } from '@/user/components/Toast'
import { useNavigate, useParams } from 'react-router-dom'
import { WrongNoteIcon } from '@/user/components/icons/WrongNoteIcon'
import { PageHeader } from '@/user/components/PageHeader'
import { deleteWrongNote, fetchWrongNotes, restoreWrongNote, type WrongNoteItem } from '@/user/api/attemptApi'
import { findWrongUnit, formatWrongAt, isResolved, type WrongUnitRow } from '@/user/services/wrongNotes'
import { QuestionRender } from '@/shared/components/QuestionBlocks'
import { useUserStore } from '@/user/stores/userStore'
import { type Subject } from '@/user/stores/trialStore'
import styles from './styles/WrongNoteDetailPage.module.scss'

/**
 * 오답노트 상세 (/wrong-note/:subject/units/:unitId · Figma 2653-16311)
 * unitId = 단원 식별자 (약점 지도·홈과 공유하는 노드 id, 예: exp-log)
 * 단원의 오답 문제 목록 — 문제 N · 마지막 오답 시각 · 본문 미리보기 · 풀기 버튼.
 * 다시 풀기 = 풀이 세션(RETRY)으로 /solve 진입.
 * 맞혀도 목록에서 사라지지 않고 "해결" 칩만 붙는다 (2026-09-06) — 복습할 길을 남긴다.
 * 상단 개수는 아직 못 맞힌 문제 기준. 다시 풀기는 문제 단위(카드·버튼)로만 — "오답 전체 풀기"는 뺐다 (2026-09-06).
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
    if (sessionStatus === 'anonymous') navigate('/login', {
        replace: true,
        // 로그인 후 이 페이지로 복귀 (LoginPage 가 postLoginRedirect 로 저장)
        state: { from: window.location.pathname + window.location.search },
      })
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

  // 해결(다시 풀어 맞힘)은 목록에 남기되 개수에서는 뺀다
  const unresolvedCount = useMemo(
    () => (row?.items ?? []).filter((it) => !isResolved(it)).length,
    [row],
  )
  const resolvedCount = (row?.items.length ?? 0) - unresolvedCount

  const sortedItems = useMemo(() => {
    if (!row) return []
    const items = [...row.items]
    items.sort((a, b) => {
      const diff = (a.lastWrongAt ?? '').localeCompare(b.lastWrongAt ?? '')
      return sort === 'latest' ? -diff : diff
    })
    return items
  }, [row, sort])

  /** 문제 하나 다시 풀기 — 이 주소가 RETRY 세션을 열고 /solve 로 넘긴다 (WrongNoteReviewPage) */
  const retryPath = (problemId: string) =>
    `/wrong-note/${subject}/units/${encodeURIComponent(unitId)}/review/${encodeURIComponent(problemId)}`

  if (!row) return null


  return (
    <div className={styles.page}>
      <PageHeader backTo="/wrong-note" />

      <main className={styles.main}>
        <h1 className={styles.title}>{row.name}</h1>
        <div className={styles.countRow}>
          <p className={styles.count}>
            오답 {unresolvedCount}문제
            {resolvedCount > 0 && <span className={styles.resolvedCount}>해결 {resolvedCount}</span>}
          </p>

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
          {/* 고정 높이 미리보기(잘림) + 하단 정보 바 — 지문이 긴 문제도 카드 리듬 일정 */}
          {sortedItems.map((item: WrongNoteItem, i: number) => (
            <div key={item.problemId} className={styles.card}>
              {/* 미리보기 탭 = 바로 다시 풀기 (2026-09-06 — 읽기 전용 "문제 보기" 단계 없앰) */}
              <button
                type="button"
                aria-label={`문제 ${i + 1} 다시 풀기`}
                onClick={() => navigate(retryPath(item.problemId))}
                className={styles.cardPreview}
              >
                <div className={styles.cardProblem} aria-hidden>
                  <QuestionRender question={item.question ?? ''} subject={subject} />
                </div>
                <div className={styles.cardTint} aria-hidden />
                <div className={styles.cardFade} aria-hidden />
                {isResolved(item) ? (
                  <span className={styles.resolvedChip}>해결</span>
                ) : (
                  <span className={styles.wrongChip}>오답 {item.wrongCount}회</span>
                )}
              </button>

              <div className={styles.cardInfo}>
                <button
                  type="button"
                  aria-label={excluded.has(item.problemId) ? '오답노트에 다시 담기' : '오답노트에서 제외'}
                  onClick={() => toggleWrongNote(item.problemId)}
                  className={styles.noteToggle}
                >
                  <WrongNoteIcon size={20} filled={!excluded.has(item.problemId)} />
                </button>
                <div className={styles.cardMeta}>
                  <p className={styles.cardNo}>
                    {item.unitLarge && <>{item.unitLarge} · </>}문제 {i + 1}
                  </p>
                  <p className={styles.cardSub}>
                    {item.score != null && <>{item.score}점 · </>}
                    {item.difficulty && <>{difficultyLabel(item.difficulty)} · </>}
                    {formatWrongAt(item.lastWrongAt)}
                  </p>
                </div>
                {/* 다시 풀기 — 빈 문제로 바로 풀이 진입. 해설은 채점 뒤 결과 화면에서 (미리보기 탭과 같은 목적지) */}
                <button
                  type="button"
                  onClick={() => navigate(retryPath(item.problemId))}
                  className={styles.retryButton}
                >
                  다시 풀기
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Toast show={!!toast} fit bottom="calc(24px + env(safe-area-inset-bottom))" className={styles.toast}>
        {toast?.message}
      </Toast>
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


function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

