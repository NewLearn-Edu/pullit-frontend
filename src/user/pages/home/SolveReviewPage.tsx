import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TimerBadge } from '@/user/components/quiz/TimerBadge'
import { useSolveStore } from '@/user/stores/solveStore'
import { type Subject } from '@/user/stores/trialStore'
import { formatKoreanDuration } from '@/user/pages/trial/TrialQuizPage'
import { ReviewScreen } from '@/user/pages/trial/ReviewScreen'
import styles from '@/user/pages/trial/styles/TrialQuizPage.module.scss'

/**
 * 세트 풀이 해설 리뷰 (/solve/review/:subject/:index)
 * 세트 결과 화면(/solve/result)의 문항별 "해설" 진입 — 풀이 세션(solveStore)의 문제·채점 결과로
 * 맛보기 해설보기와 같은 화면(ReviewScreen)을 그린다. 닫으면 세트 결과로 돌아간다.
 */
export default function SolveReviewPage() {
  const navigate = useNavigate()
  const { subject: subjectParam, index } = useParams<{ subject: Subject; index: string }>()
  const subject: Subject = subjectParam === 'english' ? 'english' : 'math'
  const idx = Number(index ?? 0)

  const session = useSolveStore((s) => s.session)
  const problem = session?.problems[idx]
  const result = useSolveStore((s) => (problem ? s.results[problem.id] : undefined))

  useEffect(() => {
    if (!session || !problem) navigate('/home', { replace: true })
  }, [session, problem, navigate])

  if (!session || !problem) return null

  const unitLabel = `${subject === 'english' ? '영어' : '수학'}${session.unitName ? ` · ${session.unitName}` : ''}`
  const answerNo = result?.answerNo ?? (problem.answer !== 0 ? problem.answer : null)

  return (
    <ReviewScreen
      problem={problem}
      problemNo={idx + 1}
      unitLabel={unitLabel}
      answerNo={answerNo}
      serverExplanation={result?.explanation ?? null}
      serverTranslation={result?.translation ?? null}
      serverVocabulary={result?.vocabulary ?? null}
      myChoice={result?.selectedChoice ?? null}
      onClose={() => navigate(`/solve/result/${subject}`, { replace: true })}
      headerMeta={
        result && (
          <>
            <div className={styles.problemTime}>권장 {formatKoreanDuration(problem.tRecSec)}</div>
            <TimerBadge
              elapsedSec={Math.round(result.elapsedMs / 1000)}
              tRecSec={problem.tRecSec}
              tMaxSec={problem.tMaxSec}
              variant="onLight"
            />
          </>
        )
      }
    />
  )
}
