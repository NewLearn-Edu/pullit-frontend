import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { fetchWrongNotes, type WrongNoteItem } from '@/user/api/attemptApi'
import { findWrongUnit } from '@/user/services/wrongNotes'
import { useUserStore } from '@/user/stores/userStore'
import { useSolveStore } from '@/user/stores/solveStore'
import { type Subject } from '@/user/stores/trialStore'
import { ReviewScreen } from '@/user/pages/trial/ReviewScreen'
import styles from '@/user/pages/trial/styles/TrialQuizPage.module.scss'

/**
 * 오답 다시 풀기 결과 (/wrong-note/:subject/units/:unitId/review/:problemId/result · 2026-09-04)
 *
 * 다시 풀기(RETRY 세션 · 문제 1개)의 답을 내면 목록으로 곧장 돌아가는 대신 여기로 온다 —
 * 같은 문제 페이지(ReviewScreen) 위에 결과를 얹는다.
 * - 정답: 「정답」 배지(서버가 오답노트에서 해소), 푸터 [해설 보기] [오답노트로]
 * - 오답: 「오답 N회」 배지(내 선택은 빨강), 푸터 [해설 보기] [다시 풀기]
 * - 마지막 제출의 서버 채점이 아직 안 왔으면 배지는 「채점 중」 — 응답이 오면 채워진다
 *
 * 데이터는 풀이 세션(solveStore)에서. 세션이 없으면(새로고침·직접 진입) 단원 오답 목록으로.
 * 오답 횟수는 서버가 방금 반영한 값을 다시 조회해 보여준다 (해소된 정답 문제는 목록에서 사라져 있다).
 */
export default function WrongNoteRetryResultPage() {
  const { subject = 'math', unitId = '', problemId = '' } = useParams<{
    subject: Subject
    unitId: string
    problemId: string
  }>()
  const navigate = useNavigate()
  const sessionStatus = useUserStore((s) => s.status)
  const session = useSolveStore((s) => s.session)
  const startSolveSession = useSolveStore((s) => s.startSession)
  const problem = session?.source === 'RETRY' ? session.problems[0] : undefined
  const result = useSolveStore((s) => (problem ? s.results[problem.id] : undefined))
  const listPath = `/wrong-note/${subject}/units/${encodeURIComponent(unitId)}`
  const resultPath = `${listPath}/review/${encodeURIComponent(problemId)}/result`

  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', {
        replace: true,
        state: { from: window.location.pathname + window.location.search },
      })
  }, [sessionStatus, navigate])

  // 세션이 없거나(새로고침) 다른 문제의 세션이면 목록으로
  useEffect(() => {
    if (!problem || problem.serverId !== decodeURIComponent(problemId)) navigate(listPath, { replace: true })
  }, [problem, problemId, navigate, listPath])

  // 채점이 끝나면 오답노트를 다시 조회 — 단원명·갱신된 오답 횟수 (정답이면 항목이 없다)
  const graded = !!result && !result.pending
  const [fresh, setFresh] = useState<{ unitName: string | null; item: WrongNoteItem | null } | null>(null)
  useEffect(() => {
    if (!graded) return
    let alive = true
    fetchWrongNotes(subject as Subject)
      .then((items) => {
        if (!alive) return
        const row = findWrongUnit(subject as Subject, items, decodeURIComponent(unitId)) ?? null
        const item = row?.items.find((it) => it.problemId === decodeURIComponent(problemId)) ?? null
        setFresh({ unitName: row?.name ?? null, item })
      })
      .catch(() => alive && setFresh({ unitName: null, item: null }))
    return () => {
      alive = false
    }
  }, [graded, subject, unitId, problemId])

  const badge = useMemo(() => {
    if (!result || result.pending) return { className: styles.resultBadge, text: '채점 중…' }
    if (result.correct) return { className: styles.resultBadgeCorrect, text: '정답' }
    const count = fresh?.item?.wrongCount
    return { className: styles.resultBadgeWrong, text: count ? `오답 ${count}회` : '오답' }
  }, [result, fresh])

  if (!problem || !result) return null

  /** 다시 풀기 — 같은 문제로 RETRY 세션을 다시 열고, 끝나면 이 결과 화면으로 */
  const retryAgain = () => {
    startSolveSession({ problems: [problem], source: 'RETRY', returnTo: listPath, resultTo: resultPath })
    navigate(`/solve/${subject}/0`, { replace: true })
  }

  const unitName = fresh?.unitName ?? decodeURIComponent(unitId)

  return (
    <ReviewScreen
      problem={problem}
      problemNo={1}
      unitLabel={`${subject === 'english' ? '영어' : '수학'} · ${unitName}`}
      answerNo={result.answerNo ?? null}
      serverExplanation={result.explanation ?? null}
      serverTranslation={result.translation ?? null}
      serverVocabulary={result.vocabulary ?? null}
      myChoice={result.selectedChoice}
      initialExplainOpen={false}
      drawingTools={false}
      onClose={() => navigate(listPath)}
      headerMeta={<div className={clsx(styles.resultBadge, badge.className)}>{badge.text}</div>}
      footer={({ openExplain, explainOpen }) => (
        <>
          <button
            type="button"
            onClick={openExplain}
            aria-expanded={explainOpen}
            className={styles.reviewSecondary}
          >
            해설 보기
          </button>
          {result.pending || result.correct ? (
            <button type="button" onClick={() => navigate(listPath)} className={styles.reviewPrimary}>
              오답노트로
            </button>
          ) : (
            <button type="button" onClick={retryAgain} className={styles.reviewPrimary}>
              다시 풀기
            </button>
          )}
        </>
      )}
    />
  )
}
