import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { QuizTopBar } from '@/user/components/quiz/QuizTopBar'
import { ExplainPanel } from '@/user/components/quiz/ExplainPanel'
import { ResizeDivider } from '@/user/components/quiz/ResizeDivider'
import { MathProblemRender } from '@/shared/components/ExamRender'
import { QuestionRender } from '@/shared/components/QuestionBlocks'
import { type Problem } from '@/user/data/mockProblems'
import { loadQuizProblems } from '@/user/services/problemSet'
import { useTrialStore } from '@/user/stores/trialStore'
import styles from './styles/TrialQuizPage.module.scss'

type Subject = 'math' | 'english'

const SUBJECT_LABEL: Record<Subject, string> = {
  math: '수학 · 지수와 로그',
  english: '영어 · 주제',
}

/**
 * 해설 리뷰 화면 (/trial/review/:subject/:index)
 * 결과 페이지(문항별 결과)의 "해설보기" 진입 — 왼쪽 문제 · 오른쪽 해설 패널.
 * 풀이 화면과 같은 골격이지만 타이머·필기·선택 없이 읽기 전용이다.
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
  const myChoice = myResult?.selectedChoice ?? null

  // 풀이 기록 없이 접근하면 결과 페이지로 (세트 로드가 끝난 뒤에만 판정)
  useEffect(() => {
    if (problems && !problem) navigate('/weakness', { replace: true })
  }, [problems, problem, navigate])

  const [tab, setTab] = useState<'answer' | 'explanation'>('explanation')
  const [panelWidth, setPanelWidth] = useState(420)
  const [resizing, setResizing] = useState(false)

  if (!problem) return null

  return (
    <div className={styles.page}>
      <QuizTopBar
        progress={{ current: idx + 1, total: problems.length }}
        subjectLabel={SUBJECT_LABEL[subject as Subject]}
        onClose={() => navigate('/weakness')}
      />

      <div className={styles.content}>
        <main className={styles.main}>
          <section className={styles.problemCard}>
            <div className={styles.problemHeader}>
              <div className={styles.problemTitleWrap}>
                <h2 className={styles.problemTitle}>문제 {idx + 1}</h2>
              </div>
            </div>

            <div className={styles.canvasArea}>
              <div className={styles.bodyWrap}>
                <ReviewProblemBody problem={problem} />
              </div>

              {/* 주관식 — 정답·내 답을 칩으로 표시 */}
              {problem.choices.length === 0 && (
                <div className={styles.choicesWrap}>
                  <div className={styles.choicesGrid} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                    <span className={clsx(styles.choiceChip, styles.choiceChipCorrect)}>
                      <span className={styles.choiceValue}>정답 {problem.answer}</span>
                    </span>
                    <span
                      className={clsx(
                        styles.choiceChip,
                        myChoice !== problem.answer && styles.choiceChipWrong,
                      )}
                    >
                      <span className={styles.choiceValue}>내 답 {myChoice ?? '-'}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* 보기 — 읽기 전용 · 정답은 검정, 내 오답은 빨강으로 표시.
                  영어는 수능 지면처럼 한 줄에 하나씩 */}
              <div className={styles.choicesWrap}>
                <div
                  className={clsx(
                    styles.choicesGrid,
                    subject === 'english' && styles.choicesGridEn,
                  )}
                >
                  {problem.choices.map((choice, i) => {
                    const choiceNo = i + 1
                    const isAnswer = choiceNo === problem.answer
                    const isMyWrong = choiceNo === myChoice && !isAnswer
                    const answerText = choice.replace(/^[①②③④⑤]\s*/, '')
                    return (
                      <span
                        key={choiceNo}
                        className={clsx(
                          styles.choiceChip,
                          isAnswer && styles.choiceChipCorrect,
                          isMyWrong && styles.choiceChipWrong,
                        )}
                      >
                        {/* 정답은 채운 원문자 ❶~❺ (U+2776) — 어드민 미리보기와 동일 규칙 */}
                        <span className={styles.choiceNum}>
                          {String.fromCodePoint((isAnswer ? 0x2775 : 0x245f) + choiceNo)}
                        </span>
                        <span className={styles.choiceValue}>
                          <MathProblemRender text={answerText} />
                        </span>
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className={styles.spacer} />
            </div>
          </section>

          <ResizeDivider
            show
            onStart={() => setResizing(true)}
            onDrag={(dx) =>
              setPanelWidth((w) => Math.max(300, Math.min(800, w - dx)))
            }
            onEnd={() => setResizing(false)}
          />
        </main>

        <ExplainPanel
          open
          onClose={() => navigate('/weakness')}
          tab={tab}
          onTabChange={setTab}
          problem={problem}
          serverExplanation={myResult?.serverExplanation}
          revealed
          width={panelWidth}
          resizing={resizing}
        />
      </div>
    </div>
  )
}

function ReviewProblemBody({ problem }: { problem: Problem }) {
  const pointsBadge = <span className={styles.pointsBadge}>[{problem.points}점]</span>
  const hasConditions = !!problem.conditions && problem.conditions.length > 0
  const hasQuestion = !!problem.question

  return (
    <div className={styles.problemBody}>
      <div>
        {/* 신규 규격 문항은 bodyText 가 question 블록 직렬화 — 블록 렌더러가 판별해 조판.
            배점은 발문 끝 인라인 (수능 지면 규칙) */}
        <QuestionRender
          question={problem.bodyText}
          subject={problem.subject}
          scoreBadge={!hasConditions && !hasQuestion ? pointsBadge : undefined}
        />
      </div>
      {hasConditions && (
        <div className={styles.conditionsBox}>
          {problem.conditions!.map((c, i) => (
            <div key={i} className="pv-box-item">
              <MathProblemRender text={c} />
            </div>
          ))}
        </div>
      )}
      {hasQuestion && (
        <div>
          <MathProblemRender text={problem.question!} />
          {pointsBadge}
        </div>
      )}
    </div>
  )
}
