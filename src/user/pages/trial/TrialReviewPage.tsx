import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { QuizTopBar } from '@/user/components/quiz/QuizTopBar'
import { DrawingCanvasHandle, EraserMode, StrokeTool } from '@/user/components/quiz/DrawingCanvas'
import { ProblemNoteCanvas } from '@/user/components/quiz/ProblemNoteCanvas'
import { DrawingToolbar } from '@/user/components/quiz/DrawingToolbar'
import { TimerBadge } from '@/user/components/quiz/TimerBadge'
import { ExplainPanel } from '@/user/components/quiz/ExplainPanel'
import { ResizeDivider } from '@/user/components/quiz/ResizeDivider'
import { EnglishProblemRender, MathProblemRender } from '@/shared/components/ExamRender'
import { QuestionRender } from '@/shared/components/QuestionBlocks'
import { ExamScaleFrame } from '@/shared/components/ExamScaleFrame'
import { type Problem } from '@/user/data/mockProblems'
import { loadQuizProblems } from '@/user/services/problemSet'
import { useTrialStore } from '@/user/stores/trialStore'
import { CURRICULUM } from '@/user/data/curriculum'
import { formatKoreanDuration, PenToggleIcon } from '@/user/pages/trial/TrialQuizPage'
import styles from './styles/TrialQuizPage.module.scss'

type Subject = 'math' | 'english'

const SUBJECT_LABEL: Record<Subject, string> = {
  math: '수학 · 지수와 로그',
  english: '영어 · 주제',
}

/**
 * 해설 리뷰 화면 (/trial/review/:subject/:index)
 * 결과 페이지(문항별 결과)의 "해설보기" 진입 — 왼쪽 문제 · 오른쪽 해설 패널.
 * 풀이 화면과 같은 골격. 선택은 없지만 필기는 된다 — 해설을 보며 손으로
 * 다시 풀어보는 화면이라 풀이와 같은 필기구를 띄운다 (2026-08-30).
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
  const myChoice = myResult?.selectedChoice ?? null

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

  // 필기 — 해설을 보며 다시 풀어보는 용도. 풀이 화면과 같은 도구 세트.
  // 캔버스는 문제·해설 두 장 — 툴바는 공유하고 undo/clear 는 마지막으로 쓴 쪽에 간다
  const [tool, setTool] = useState<StrokeTool>('mono')
  const [color, setColor] = useState('#120C0B')
  const [size, setSize] = useState(0.35)
  const [eraserMode, setEraserMode] = useState<EraserMode>('partial') // 지우개 종류 — 기본 일부 (패스노트와 동일)
  const [allowFinger, setAllowFinger] = useState(false)
  const [drawingEnabled, setDrawingEnabled] = useState(true)
  const canvasRef = useRef<DrawingCanvasHandle>(null)
  const explainCanvasRef = useRef<DrawingCanvasHandle>(null)
  const activeCanvasRef = useRef<'problem' | 'explain'>('problem')
  // 복원한 문제 필기의 세로 끝(px)만큼 캔버스 영역을 확보 (풀이 때 남긴 필기가 안 잘리게).
  // state 가 아니라 style 직접 — 획마다 화면 전체(해설 MathJax 포함)를 다시 그리지 않는다
  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const applyNoteHeight = (px: number) => {
    const el = canvasAreaRef.current
    if (el) el.style.minHeight = px > 0 ? `${px}px` : ''
  }
  const activeCanvas = () =>
    activeCanvasRef.current === 'explain' ? explainCanvasRef.current : canvasRef.current
  // 정답 번호 — 서버 세트 문항은 로컬 answer 가 0 이라 서버 채점 응답을 우선
  const resolvedAnswerNo =
    myResult?.serverAnswerNo ?? (problem && problem.answer !== 0 ? problem.answer : null)

  // 풀이 기록 없이 접근하면 결과 페이지로 (세트 로드가 끝난 뒤에만 판정)
  useEffect(() => {
    if (problems && !problem) navigate('/weakness', { replace: true })
  }, [problems, problem, navigate])

  const [panelWidth, setPanelWidth] = useState(420)
  const [resizing, setResizing] = useState(false)

  if (!problem) return null

  return (
    <div className={styles.page}>
      {/* progress 미전달 — "성적 상승까지 N문제"는 풀이 진행 문구라 리뷰에선 뺀다 */}
      <QuizTopBar
        subjectLabel={unitLabel}
        onClose={() => navigate('/weakness')}
        rightExtra={
          <button
            type="button"
            onClick={() => setDrawingEnabled(!drawingEnabled)}
            aria-pressed={drawingEnabled}
            aria-label={drawingEnabled ? '필기 도구 끄기' : '필기 도구 켜기'}
            className={clsx(styles.penToggle, drawingEnabled && styles.penToggleActive)}
          >
            <PenToggleIcon />
          </button>
        }
      />

      <DrawingToolbar
        tool={tool}
        color={color}
        size={size}
        eraserMode={eraserMode}
        allowFinger={allowFinger}
        drawingEnabled={drawingEnabled}
        onToolChange={setTool}
        onColorChange={setColor}
        onSizeChange={setSize}
        onEraserModeChange={setEraserMode}
        onAllowFingerChange={setAllowFinger}
        onDrawingEnabledChange={setDrawingEnabled}
        onUndo={() => activeCanvas()?.undo()}
        onClear={() => activeCanvas()?.clear()}
      />

      <div className={styles.content}>
        <main className={styles.main}>
          <section className={styles.problemCard}>
            <div className={styles.problemHeader}>
              <div className={styles.problemTitleWrap}>
                <h2 className={styles.problemTitle}>문제 {idx + 1}</h2>
              </div>
              {myResult && (
                <div className={styles.problemMeta}>
                  <div className={styles.problemTime}>
                    권장 {formatKoreanDuration(problem.tRecSec)}
                  </div>
                  {/* 라이브 타이머 대신 내가 푼 시간 — 색 단계(경고·초과)는 그대로 재활용 */}
                  <TimerBadge
                    elapsedSec={Math.round((myResult.elapsedMs ?? 0) / 1000)}
                    tRecSec={problem.tRecSec}
                    tMaxSec={problem.tMaxSec}
                    variant="onLight"
                  />
                </div>
              )}
            </div>

            <div ref={canvasAreaRef} className={styles.canvasArea}>
              {/* 500px 기준 고정 조판 → 폭 비례 확대 (줄바꿈 불변 · 퀴즈와 동일 정책).
                  보기도 퀴즈·어드민과 같은 시험지형(pv-choices) — 칩 박스 없음.
                  정답 = 채운 원문자 ❶~❺ · 내 오답 = 빨강 */}
              <ExamScaleFrame>
              <div className={clsx('pv-body', subject === 'english' && 'en')}>
                <div className={styles.bodyWrap}>
                  <ReviewProblemBody problem={problem} />

                  {problem.choices.length > 0 && (
                    <div className="pv-choices">
                      {problem.choices.map((choice, i) => {
                        const choiceNo = i + 1
                        const isAnswer = choiceNo === resolvedAnswerNo
                        const isMyWrong = choiceNo === myChoice && !isAnswer
                        const answerText = choice.replace(/^[①②③④⑤]\s*/, '')
                        const ChoiceRender =
                          subject === 'english' ? EnglishProblemRender : MathProblemRender
                        return (
                          <span
                            key={choiceNo}
                            className={clsx('choice', isAnswer && 'correct')}
                            style={isMyWrong ? { color: '#ff385c' } : undefined}
                          >
                            <span className="choice-num">
                              {choiceNo}
                            </span>
                            <span>
                              <ChoiceRender text={answerText} />
                            </span>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              </ExamScaleFrame>

              <div className={styles.spacer} />

              <div
                className={styles.canvasOverlay}
                onPointerDownCapture={() => (activeCanvasRef.current = 'problem')}
              >
                {/* 풀이 때 남긴 문제 필기(problem.pnk)를 그대로 불러온다 */}
                <ProblemNoteCanvas
                  key={problem.serverId ?? problem.id}
                  ref={canvasRef}
                  problemCode={problem.serverId}
                  target="problem"
                  tool={tool}
                  color={color}
                  size={size}
                  eraserMode={eraserMode}
                  disabled={!drawingEnabled}
                  allowFinger={allowFinger}
                  onContentHeight={applyNoteHeight}
                />
              </div>
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
          problem={problem}
          answerNo={myResult?.serverAnswerNo}
          serverExplanation={myResult?.serverExplanation}
          revealed
          width={panelWidth}
          resizing={resizing}
          drawing={{
            tool,
            color,
            size,
            eraserMode,
            disabled: !drawingEnabled,
            allowFinger,
            canvasRef: explainCanvasRef,
            onActivate: () => (activeCanvasRef.current = 'explain'),
          }}
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
