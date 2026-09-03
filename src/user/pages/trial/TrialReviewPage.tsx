import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TimerBadge } from '@/user/components/quiz/TimerBadge'
import { type Problem } from '@/user/data/mockProblems'
import { loadQuizProblems } from '@/user/services/problemSet'
import { useTrialStore } from '@/user/stores/trialStore'
import { CURRICULUM } from '@/user/data/curriculum'
import { formatKoreanDuration } from '@/user/pages/trial/TrialQuizPage'
import { ReviewScreen } from './ReviewScreen'
import styles from './styles/TrialQuizPage.module.scss'

type Subject = 'math' | 'english'

const SUBJECT_LABEL: Record<Subject, string> = {
  math: '수학 · 지수와 로그',
  english: '영어 · 주제',
}

/**
 * 해설 리뷰 화면 (/trial/review/:subject/:index)
 * 결과 페이지(문항별 결과)의 "해설보기" 진입 — 진단 세션(trialStore)의 세트·채점 결과로 그린다.
 * 화면 골격은 ReviewScreen (오답노트 해설과 공용).
 * 헤더에는 라이브 타이머 대신 내가 푼 시간(결과 기록)을 보여준다.
 */
export default function TrialReviewPage() {
  const { subject, index } = useParams<{ subject: Subject; index: string }>()
  const navigate = useNavigate()
  const idx = Number(index ?? 0)

  const { mathSkillNodeId, englishTypeId, mathResults, englishResults } = useTrialStore()

  // 풀이 화면과 같은 세트 (problemSet 캐시 공유) — null = 로드 전
  const [problems, setProblems] = useState<Problem[] | null>(null)
  useEffect(() => {
    const nodeId = subject === 'math' ? mathSkillNodeId : englishTypeId
    if (!subject || !nodeId) {
      setProblems([])
      return
    }
    let alive = true
    loadQuizProblems(subject, nodeId).then((list) => {
      if (alive) setProblems(list)
    })
    return () => {
      alive = false
    }
  }, [subject, mathSkillNodeId, englishTypeId])

  const problem = problems?.[idx]

  const myResult = useMemo(() => {
    const results = subject === 'math' ? mathResults : englishResults
    return results.find((r) => r.problemId === problem?.id) ?? null
  }, [subject, mathResults, englishResults, problem])

  // 내가 푼 단원명 — 세트의 nodeId 를 커리큘럼에서 역조회 (하드코딩 라벨은 폴백)
  const solvedNodeId = subject === 'math' ? mathSkillNodeId : englishTypeId
  const unitLabel = useMemo(() => {
    if (!subject) return ''
    for (const category of CURRICULUM[subject]) {
      const unit = category.units.find((u) => u.nodeId === solvedNodeId)
      if (unit) return `${subject === 'math' ? '수학' : '영어'} · ${unit.name}`
    }
    return SUBJECT_LABEL[subject]
  }, [subject, solvedNodeId])

  // 풀이 기록 없이 접근하면 결과 페이지로 (세트 로드가 끝난 뒤에만 판정)
  useEffect(() => {
    if (problems && !problem) navigate('/weakness', { replace: true })
  }, [problems, problem, navigate])

  if (!problem) return null

  // 정답 번호 — 서버 세트 문항은 로컬 answer 가 0 이라 서버 채점 응답을 우선
  const answerNo = myResult?.serverAnswerNo ?? (problem.answer !== 0 ? problem.answer : null)

  return (
    <ReviewScreen
      problem={problem}
      problemNo={idx + 1}
      unitLabel={unitLabel}
      answerNo={answerNo}
      serverExplanation={myResult?.serverExplanation ?? null}
      serverTranslation={myResult?.serverTranslation ?? problem.translation ?? null}
      serverVocabulary={myResult?.serverVocabulary ?? problem.vocabulary ?? null}
      myChoice={myResult?.selectedChoice ?? null}
      onClose={() => navigate('/weakness')}
      headerMeta={
        myResult && (
          <>
            <div className={styles.problemTime}>권장 {formatKoreanDuration(problem.tRecSec)}</div>
            {/* 라이브 타이머 대신 내가 푼 시간 — 색 단계(경고·초과)는 그대로 재활용 */}
            <TimerBadge
              elapsedSec={Math.round((myResult.elapsedMs ?? 0) / 1000)}
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
