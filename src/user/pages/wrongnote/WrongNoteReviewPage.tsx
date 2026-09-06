import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchWrongNotes, type WrongNoteItem } from '@/user/api/attemptApi'
import { findWrongUnit, toSolveProblem, type WrongUnitRow } from '@/user/services/wrongNotes'
import { useUserStore } from '@/user/stores/userStore'
import { useSolveStore } from '@/user/stores/solveStore'
import { clearProblemNotes } from '@/user/services/problemNotes'
import { type Subject } from '@/user/stores/trialStore'

/**
 * 오답노트 문제 진입 (/wrong-note/:subject/units/:unitId/review/:problemId)
 *
 * 2026-09-06 부터 "문제 보기"(해설·다시 풀기 버튼이 있는 읽기 전용 화면)를 거치지 않고
 * 들어오자마자 바로 풀 수 있게 한다 — 이 주소는 RETRY 풀이 세션을 열고 /solve 로 넘기는 길목이다.
 * - 예전 필기(문제·해설)는 지우고 빈 문제로 시작 — 이번에 새로 푼 필기만 남긴다
 * - 채점(완료)하면 결과 화면(WrongNoteRetryResultPage)에서 정답·오답 배지와 함께
 *   [해설 보기] [다시 풀기 / 오답노트로] 가 나온다. 이번에 그린 필기는 그 화면에서 그대로 보인다
 * - history 는 replace — 결과 화면·풀이 화면에서 뒤로 가면 이 길목이 아니라 단원 오답 목록으로
 *
 * 목록에서 넘어올 때도 문제 데이터는 오답노트 API 로 다시 조회한다 (주소를 직접 열거나
 * 새로고침해도 같은 길로 들어오게). 문제가 없으면(해소됐거나 잘못된 주소) 단원 목록으로.
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

  const item = useMemo(() => {
    const items = row?.items ?? []
    return items.find((it: WrongNoteItem) => it.problemId === decodeURIComponent(problemId)) ?? null
  }, [row, problemId])

  // 조회를 마쳤으면 바로 풀이로 — 문제가 없으면(해소됐거나 잘못된 주소) 단원 목록으로.
  // StrictMode 의 이중 실행·재조회로 세션을 두 번 열지 않게 한 번만 넘긴다
  const startedRef = useRef(false)
  useEffect(() => {
    // 비회원은 위 효과가 /login 으로 보낸다 — 그 뒤에 풀이로 덮어쓰지 않게 여기서 멈춘다
    if (!loaded || startedRef.current || sessionStatus === 'anonymous') return
    startedRef.current = true
    if (!item) {
      navigate(listPath, { replace: true })
      return
    }
    // 처음 푸는 것처럼 — 예전 풀이 때 남긴 필기를 지우고 빈 문제로 넘긴다.
    // 이번에 그린 필기는 채점(완료)하며 화면을 떠날 때 저장된다 (ProblemNoteCanvas)
    void clearProblemNotes(item.problemId)
    startSolveSession({
      problems: [toSolveProblem(item, 0)],
      source: 'RETRY',
      returnTo: listPath,
      resultTo: `${listPath}/review/${encodeURIComponent(item.problemId)}/result`,
    })
    navigate(`/solve/${subject}/0`, { replace: true })
  }, [loaded, item, listPath, navigate, sessionStatus, startSolveSession, subject])

  return null
}
