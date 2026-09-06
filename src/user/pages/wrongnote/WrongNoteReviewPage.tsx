import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchWrongNotes, type WrongNoteItem } from '@/user/api/attemptApi'
import { findWrongUnit, toSolveProblem, type WrongUnitRow } from '@/user/services/wrongNotes'
import { useUserStore } from '@/user/stores/userStore'
import { useSolveStore } from '@/user/stores/solveStore'
import { clearProblemNotes } from '@/user/services/problemNotes'
import { type Subject } from '@/user/stores/trialStore'
import { ReviewScreen } from '@/user/pages/trial/ReviewScreen'
import styles from '@/user/pages/trial/styles/TrialQuizPage.module.scss'

/**
 * 오답노트 문제 보기 (/wrong-note/:subject/units/:unitId/review/:problemId · 2026-09-02 방향 확정)
 * 오답노트 카드를 누르면 오는 "문제 페이지" — 풀이 화면 골격(ReviewScreen)이지만 선택지·모르겠어요 대신
 * 아래에 [해설 보기] [다시 풀기] 가 있다. 해설은 오답노트 API 가 내려주는 정답·해설
 * (이미 틀린 문제라 "풀이 중 차단" 정책과 충돌 없음). 다시 풀기 = RETRY 풀이 세션으로 /solve 진입.
 * 마지막으로 고른 선지(lastSubmittedNo)는 채운 원문자, 못 맞힌 정답은 빨강 — 다시 풀기 결과 화면과 같은 표기.
 * "모르겠어요"로 넘긴 제출은 고른 선지가 없어 정답만 빨갛게 나온다.
 *
 * 필기는 들어오자마자 켜져 있다 (2026-09-06) — 해설을 보며 손으로 다시 풀어보는 화면이라
 * 풀이 화면과 같은 필기구를 띄운다. 다시 풀기로 넘어갈 때는 그 필기를 지우고 빈 문제로 시작한다.
 */
export default function WrongNoteReviewPage() {
  const { subject = 'math', unitId = '', problemId = '' } = useParams<{
    subject: Subject
    unitId: string
    problemId: string
  }>()
  const navigate = useNavigate()
  const sessionStatus = useUserStore((s) => s.status)
  const startSolveSession = useSolveStore((s) => s.startSession)
  const listPath = `/wrong-note/${subject}/units/${encodeURIComponent(unitId)}`

  const [row, setRow] = useState<WrongUnitRow | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', {
        replace: true,
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

  const target = useMemo(() => {
    const items = row?.items ?? []
    const index = items.findIndex((it: WrongNoteItem) => it.problemId === decodeURIComponent(problemId))
    return index >= 0 ? { item: items[index], index } : null
  }, [row, problemId])

  // 조회를 마쳤는데 문제가 없으면(해소됐거나 잘못된 주소) 목록으로
  useEffect(() => {
    if (loaded && !target) navigate(listPath, { replace: true })
  }, [loaded, target, navigate, listPath])

  if (!row || !target) return null

  const { item, index } = target
  const problem = toSolveProblem(item, index)
  const answerNo = item.answerIndex ?? item.answerValue ?? null

  /**
   * 다시 풀기 — 이 문제 하나로 RETRY 세션. 제출하면 결과 화면(정답 → 오답노트 해소 안내 / 오답 → 다시 풀기)으로,
   * X 로 나가면 단원 오답 목록으로 (맞히면 서버가 오답노트에서 해소)
   */
  const retry = () => {
    // 처음 푸는 것처럼 — 문제 보기에서 한 필기도, 예전 풀이 때 남긴 필기도 지우고 빈 문제로 넘긴다
    void clearProblemNotes(item.problemId)
    startSolveSession({
      problems: [toSolveProblem(item, 0)],
      source: 'RETRY',
      returnTo: listPath,
      resultTo: `${listPath}/review/${encodeURIComponent(item.problemId)}/result`,
    })
    navigate(`/solve/${subject}/0`)
  }

  return (
    <ReviewScreen
      problem={problem}
      problemNo={index + 1}
      unitLabel={`${subject === 'english' ? '영어' : '수학'} · ${row.name}`}
      answerNo={answerNo}
      serverExplanation={item.explanation ?? null}
      serverTranslation={item.translation ?? null}
      serverVocabulary={item.vocabulary ?? null}
      myChoice={item.lastSubmittedNo}
      initialExplainOpen={false}
      onClose={() => navigate(listPath)}
      headerMeta={<div className={styles.problemTime}>오답 {item.wrongCount}회</div>}
      footer={({ toggleExplain, explainOpen }) => (
        <>
          <button
            type="button"
            onClick={toggleExplain}
            aria-expanded={explainOpen}
            className={styles.reviewSecondary}
          >
            {explainOpen ? '해설 닫기' : '해설 보기'}
          </button>
          <button type="button" onClick={retry} className={styles.reviewPrimary}>
            다시 풀기
          </button>
        </>
      )}
    />
  )
}
