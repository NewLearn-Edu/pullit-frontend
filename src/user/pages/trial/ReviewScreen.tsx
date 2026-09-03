import { useEffect, useRef, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { QuizTopBar } from '@/user/components/quiz/QuizTopBar'
import { DrawingCanvasHandle, EraserMode, StrokeTool } from '@/user/components/quiz/DrawingCanvas'
import { ProblemNoteCanvas } from '@/user/components/quiz/ProblemNoteCanvas'
import { DrawingToolbar } from '@/user/components/quiz/DrawingToolbar'
import { ExplainPanel } from '@/user/components/quiz/ExplainPanel'
import { ResizeDivider } from '@/user/components/quiz/ResizeDivider'
import { EnglishProblemRender, MathProblemRender } from '@/shared/components/ExamRender'
import { QuestionRender } from '@/shared/components/QuestionBlocks'
import { ExamScaleFrame } from '@/shared/components/ExamScaleFrame'
import { type Problem } from '@/user/data/mockProblems'
import { PenToggleIcon } from '@/user/pages/trial/TrialQuizPage'
import styles from './styles/TrialQuizPage.module.scss'

interface ReviewScreenProps {
  problem: Problem
  /** 카드 제목 "문제 N" 의 N */
  problemNo: number
  /** 상단 바 라벨 — "수학 · 지수·로그" */
  unitLabel: string
  /** 정답 번호(객관식) 또는 정답값(단답형) — 서버 값 우선, 없으면 로컬 answer */
  answerNo: number | null
  /** 서버 해설 (블록 직렬화) — 없으면 목 데이터 해설 */
  serverExplanation: string | null
  /** 서버 지문 해석(영어, 블록 직렬화) — 있으면 해설 패널에 "해석" 탭이 생긴다 */
  serverTranslation?: string | null
  /** 내가 고른 선지 — 오답 선지를 빨갛게. 기록이 없으면 null */
  myChoice: number | null
  /** 문제 헤더 우측 슬롯 — 권장 시간·내가 푼 시간 등 (없으면 비움) */
  headerMeta?: ReactNode
  /**
   * 해설 패널을 처음부터 열어 둘지. 맛보기 결과의 "해설보기"는 열린 채 시작하고 닫으면 화면을 나간다.
   * false 면 문제만 먼저 보이고, footer 의 "해설 보기"로 열었다 닫을 수 있다 (오답노트)
   */
  initialExplainOpen?: boolean
  /** 문제 카드 아래 액션 영역 — 풀이 화면의 답안 바 자리 (다시 풀기 등). openExplain 으로 해설을 연다 */
  footer?: (ctx: { openExplain: () => void; explainOpen: boolean }) => ReactNode
  onClose: () => void
}

/**
 * 해설 리뷰 화면 골격 — 왼쪽 문제(필기 가능) · 오른쪽 해설 패널.
 * 맛보기 결과의 "해설보기"(TrialReviewPage)와 오답노트의 "해설"(WrongNoteReviewPage)이
 * 데이터 출처만 다르고 같은 화면을 쓴다. 풀이 화면과 같은 골격이고 선택은 없지만 필기는 된다 —
 * 해설을 보며 손으로 다시 풀어보는 화면이라 풀이와 같은 필기구를 띄운다 (2026-08-30).
 */
export function ReviewScreen({
  problem,
  problemNo,
  unitLabel,
  answerNo,
  serverExplanation,
  serverTranslation = null,
  myChoice,
  headerMeta,
  initialExplainOpen = true,
  footer,
  onClose,
}: ReviewScreenProps) {
  const subject = problem.subject
  const [explainOpen, setExplainOpen] = useState(initialExplainOpen)
  // 처음부터 열린 화면(맛보기 해설보기)은 패널 닫기 = 화면 나가기, 아니면 패널만 접는다
  const closeExplain = initialExplainOpen ? onClose : () => setExplainOpen(false)

  // 필기 — 캔버스는 문제·해설 두 장. 툴바는 공유하고 undo/clear 는 마지막으로 쓴 쪽에 간다
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

  const [panelWidth, setPanelWidth] = useState(420)
  const [resizing, setResizing] = useState(false)

  // 액션 푸터는 풀이 화면 답안 바와 같은 fixed 바 — 패널이 inline 사이드바(md+)로 열리면
  // 문제 칼럼(뷰포트 − 패널 폭)의 가운데로 옮겨 패널 폭 변화에 따라 문제 카드와 함께 움직인다
  const tabletUp = useTabletUp()
  const footerPanelW = explainOpen && tabletUp ? panelWidth : 0

  return (
    <div className={styles.page}>
      {/* progress 미전달 — "성적 상승까지 N문제"는 풀이 진행 문구라 리뷰에선 뺀다 */}
      <QuizTopBar
        subjectLabel={unitLabel}
        onClose={onClose}
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
                <h2 className={styles.problemTitle}>문제 {problemNo}</h2>
              </div>
              {headerMeta && <div className={styles.problemMeta}>{headerMeta}</div>}
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
                          const isAnswer = choiceNo === answerNo
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
                              <span className="choice-num">{choiceNo}</span>
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

          {footer && (
            <div
              className={styles.answerBar}
              style={{
                left: `calc((100% - ${footerPanelW}px) / 2)`,
                transition: resizing ? 'none' : 'left 300ms ease',
              }}
            >
              <div className={styles.reviewFooterRow}>
                {footer({ openExplain: () => setExplainOpen(true), explainOpen })}
              </div>
            </div>
          )}

          <ResizeDivider
            show={explainOpen}
            onStart={() => setResizing(true)}
            onDrag={(dx) => setPanelWidth((w) => Math.max(300, Math.min(800, w - dx)))}
            onEnd={() => setResizing(false)}
          />
        </main>

        <ExplainPanel
          open={explainOpen}
          onClose={closeExplain}
          problem={problem}
          answerNo={answerNo}
          serverExplanation={serverExplanation}
          serverTranslation={serverTranslation}
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

/** md(768px) 이상 — 해설 패널이 오버레이가 아니라 inline 사이드바로 열리는 구간 */
function useTabletUp(): boolean {
  const [tabletUp, setTabletUp] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = (e: MediaQueryListEvent) => setTabletUp(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return tabletUp
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
