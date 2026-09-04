import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { WrongNoteIcon } from '@/user/components/icons/WrongNoteIcon'
import { UserNav } from '@/user/components/UserNav'
import { PageHeader } from '@/user/components/PageHeader'
import { SubjectTabs } from '@/user/components/SubjectTabs'
import { CreditBadge } from '@/user/components/CreditBadge'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import { type Subject } from '@/user/stores/trialStore'
import { MATH_MAP_NODES } from '@/user/data/mathWeaknessMap'
import { ENGLISH_MAP_NODES } from '@/user/data/englishWeaknessMap'
import { fetchWrongNotes, type WrongNoteItem } from '@/user/api/attemptApi'
import { groupWrongNotes } from '@/user/services/wrongNotes'
import styles from './styles/WrongNotePage.module.scss'

/**
 * 오답노트 (/wrong-note · Figma 2632-7566)
 * 홈과 같은 헤더·대분류 칩 아래, 소단원(유형)별 오답 수 행 목록.
 * 단원 목록은 약점 지도 그래프 노드에서 파생, 오답 수는 서버 원장
 * (GET /api/attempts/wrong-notes — 마지막 시도가 오답인 문제) 실데이터.
 */
export default function WrongNotePage() {
  const navigate = useNavigate()
  const { me } = useMe()
  const sessionStatus = useUserStore((s) => s.status)

  const [subject, setSubject] = useState<Subject>('math')
  const [items, setItems] = useState<WrongNoteItem[]>([])

  // 세션(게스트·회원) 필요 — 오답 원장이 계정 단위
  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', {
        replace: true,
        // 로그인 후 이 페이지로 복귀 (LoginPage 가 postLoginRedirect 로 저장)
        state: { from: window.location.pathname + window.location.search },
      })
  }, [sessionStatus, navigate])

  useEffect(() => {
    let alive = true
    fetchWrongNotes(subject)
      .then((list) => alive && setItems(list))
      .catch(() => alive && setItems([])) // 실패 시 빈 목록 (행은 0개 표시)
    return () => {
      alive = false
    }
  }, [subject])

  const nodes = subject === 'math' ? MATH_MAP_NODES : ENGLISH_MAP_NODES
  const cats = useMemo(() => [...new Set(nodes.map((n) => n.cat))], [nodes])
  const [cat, setCat] = useState(cats[0])

  const changeSubject = (s: Subject) => {
    setSubject(s)
    const nextNodes = s === 'math' ? MATH_MAP_NODES : ENGLISH_MAP_NODES
    setCat(nextNodes[0].cat)
  }

  const rows = useMemo(
    () => groupWrongNotes(subject, items).filter((r) => r.cat === cat),
    [subject, items, cat],
  )

  return (
    <div className={styles.page}>
      <UserNav active="wrongNote" subject={subject} />

      <main className={styles.main}>
        {/* 상단 헤더 — 홈과 동일 문법 · 오답노트 아이콘은 활성(채움) 상태 */}
        <PageHeader
          left={<CreditBadge credit={me?.creditBalance ?? 0} />}
          center={<SubjectTabs pill value={subject} onChange={changeSubject} />}
          hideRightOnDesktop
          right={
            <>
              <span className={clsx(styles.iconCircle, styles.iconCircleActive)} aria-hidden>
                <WrongNoteIcon filled />
              </span>
            </>
          }
        />

        <div className={styles.content}>
          <h1 className={styles.title}>오답노트</h1>

          {/* 대분류(수학) / 능력(영어) 칩 */}
          <div className={styles.chips}>
            {cats.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={clsx(styles.chip, cat === c && styles.chipActive)}
              >
                {c}
              </button>
            ))}
          </div>

          {/* 소단원별 오답 행 — 오답 있는 단원만 상세로 진입, 없는 단원은 비활성 표시 (눌리지 않음) */}
          <div className={styles.list}>
            {rows.map((r) => {
              const count = r.items.length
              const empty = count === 0
              return (
                <button
                  key={r.key}
                  type="button"
                  disabled={empty}
                  aria-disabled={empty}
                  onClick={() => navigate(`/wrong-note/${subject}/units/${encodeURIComponent(r.key)}`)}
                  className={clsx(styles.row, empty && styles.rowDisabled)}
                >
                  <span className={styles.rowName}>{r.name}</span>
                  <span className={styles.rowRight}>
                    {!empty && <span className={styles.countBadge}>{count}개</span>}
                    <ChevronIcon />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

/* --- 인라인 SVG 아이콘 --- */



function ChevronIcon() {
  // 색은 부모(.rowChevron)에서 — 비활성 행이면 더 흐리게
  return (
    <svg className={styles.rowChevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}
