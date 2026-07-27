import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { QuizTopBar } from '@/components/quiz/QuizTopBar'
import { DrawingCanvas, DrawingCanvasHandle, StrokeTool } from '@/components/quiz/DrawingCanvas'
import { DrawingToolbar } from '@/components/quiz/DrawingToolbar'
import { ExplainPanel } from '@/components/quiz/ExplainPanel'
import { ResizeDivider } from '@/components/quiz/ResizeDivider'
import { GradeMark } from '@/components/quiz/GradeMark'
import { GuessCheckPopup } from '@/components/quiz/GuessCheckPopup'
import { TimerBadge } from '@/components/quiz/TimerBadge'
import { KatexText } from '@/components/quiz/KatexText'
import {
  getProblemsBySkillNode,
  getProblemsByEnglishType,
  type Problem,
} from '@/data/mockProblems'
import { useTasteStore } from '@/stores/tasteStore'
import { computeScore } from '@/utils/scoring'

type Subject = 'math' | 'english'

const SUBJECT_LABEL: Record<Subject, string> = {
  math: '수학 · 지수와 로그',
  english: '영어 · 빈칸 추론',
}

/**
 * 맛보기 테스트 문제풀이 화면
 * 상단 2행 (네비 + 필기 툴바) 고정 · 아래는 문제카드 (필기 캔버스) · 보기 5개.
 */
export default function TasteQuizPage() {
  const { subject, index } = useParams<{ subject: Subject; index: string }>()
  const navigate = useNavigate()
  const idx = Number(index ?? 0)

  const {
    mathSkillNodeId,
    englishTypeId,
    addResult,
    isMathComplete,
    isEnglishComplete,
  } = useTasteStore()

  const problems = useMemo(() => {
    if (subject === 'math' && mathSkillNodeId) {
      return getProblemsBySkillNode(mathSkillNodeId)
    }
    if (subject === 'english' && englishTypeId) {
      return getProblemsByEnglishType(englishTypeId)
    }
    return []
  }, [subject, mathSkillNodeId, englishTypeId])

  useEffect(() => {
    if (subject === 'math' && !mathSkillNodeId) {
      navigate('/taste', { replace: true })
    } else if (subject === 'english' && !englishTypeId) {
      navigate('/taste', { replace: true })
    }
  }, [subject, mathSkillNodeId, englishTypeId, navigate])

  const problem = problems[idx]

  // 문제별 상태
  const [selected, setSelected] = useState<number | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [peeked, setPeeked] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<'answer' | 'explanation'>('explanation')
  const [tool, setTool] = useState<StrokeTool>('pen')
  const [color, setColor] = useState('#120C0B')
  const [size, setSize] = useState(0.35) // 0.1 ~ 1.0 슬라이더 값 · 도구별 픽셀 매핑은 DrawingCanvas
  const [allowFinger, setAllowFinger] = useState(false) // 아이패드 손바닥 걸침 방지 · 기본 펜만
  // 필기 도구 활성화 여부. 모바일 진입 시 DrawingToolbar 가 자동 false 로 세팅 (툴바 접힘 + canvas disabled)
  const [drawingEnabled, setDrawingEnabled] = useState(true)
  // 해설 패널 폭 (md+ 에서만 사용) · divider 로 드래그 조절
  const [panelWidth, setPanelWidth] = useState(420)
  // 드래그 중에는 width transition 을 꺼야 매끄러움
  const [resizing, setResizing] = useState(false)
  // 채점 상태 · 문제 헤더에 ○/사선 오버레이 표시용
  // 'none' = 미채점, 'correct' = 정답, 'wrong' = 오답 (모르겠어요·peek 포함)
  const [grading, setGrading] = useState<'none' | 'correct' | 'wrong'>('none')
  // 10초 안에 정답 맞힘 → "찍은 거 같은데" 확인 팝업
  const [guessCheckOpen, setGuessCheckOpen] = useState(false)

  const canvasRef = useRef<DrawingCanvasHandle>(null)
  const startAt = useRef<number>(Date.now())
  // 채점 후 다음 문제로 자동 넘어가는 타이머 · 문제 변경 시 clear
  const advanceTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setSelected(null)
    setElapsedSec(0)
    setPeeked(false)
    setPanelOpen(false)
    setPanelTab('explanation')
    setGrading('none')
    setGuessCheckOpen(false)
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
    canvasRef.current?.clear()
    startAt.current = Date.now()
  }, [idx, subject])

  // 언마운트 시 auto-advance 타이머 정리
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    }
  }, [])

  useEffect(() => {
    // 채점 완료 후에는 시간 정지 · 팝업·다음문제 진입 시 값 고정
    if (grading !== 'none') return
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startAt.current) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [idx, subject, grading])

  // iOS Safari 콜아웃 (복사하기 · 선택 영역 찾기 …) 강제 차단
  // 실수로 텍스트가 선택되면 즉시 해제 · selectstart 도 원천 봉쇄
  useEffect(() => {
    const clearSelection = () => {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) sel.removeAllRanges()
    }
    const preventSelect = (e: Event) => e.preventDefault()
    document.addEventListener('selectionchange', clearSelection)
    document.addEventListener('selectstart', preventSelect)
    return () => {
      document.removeEventListener('selectionchange', clearSelection)
      document.removeEventListener('selectstart', preventSelect)
    }
  }, [])

  if (!problem) return null

  const overTime = elapsedSec > problem.tMaxSec

  const requestPeek = (tab: 'answer' | 'explanation') => {
    let effectivePeeked = peeked
    if (selected == null) {
      const ok = window.confirm(
        '아직 답을 선택하지 않았어요.\n지금 열면 오답 처리됩니다.\n계속할까요?',
      )
      if (!ok) return
      setPeeked(true)
      effectivePeeked = true
    }
    // 채점 마크 · peek 하면 커밋된 것으로 간주 → 정오답 확정
    // peeked 상태거나 미선택이면 오답, 그 외엔 선택값 기준
    const correct =
      selected != null && selected === problem.answer && !effectivePeeked
    setGrading(correct ? 'correct' : 'wrong')
    setPanelTab(tab)
    setPanelOpen(true)
  }

  const submitAndNext = () => {
    const correct = selected != null && selected === problem.answer
    const score = computeScore({
      points: problem.points,
      correct,
      elapsedSec,
      tRecSec: problem.tRecSec,
      tMaxSec: problem.tMaxSec,
      peekedBeforeAnswer: peeked,
    })

    addResult(subject as Subject, {
      problemId: problem.id,
      selectedChoice: selected,
      correct,
      earnedPoints: score.earnedPoints,
      timeoverFlag: score.timeoverFlag,
      peekedBeforeAnswer: peeked,
      elapsedMs: Date.now() - startAt.current,
    })

    // 채점 마크 표시 · peek 했으면 오답으로 표시
    const effectiveCorrect = correct && !peeked
    setGrading(effectiveCorrect ? 'correct' : 'wrong')

    // 10초 이내 정답 → "찍은 거 같은데" 확인 팝업 (자동 넘김 스킵)
    if (effectiveCorrect && elapsedSec < 10) {
      // 마크 draw-on 애니메이션 살짝 보여준 뒤 팝업 오픈
      advanceTimerRef.current = window.setTimeout(() => {
        setGuessCheckOpen(true)
      }, 500)
    } else {
      // 마크 잔상 시간 후 자동 다음 문제
      advanceTimerRef.current = window.setTimeout(() => {
        goNext()
      }, 1100)
    }
  }

  // 팝업 응답 · 짧게 delay 후 다음 문제로 (POC 는 결과 flag 저장 안 함 · 나중에 필요하면 추가)
  const handleGuessResponse = () => {
    setGuessCheckOpen(false)
    advanceTimerRef.current = window.setTimeout(() => {
      goNext()
    }, 250)
  }

  const goNext = () => {
    const nextIdx = idx + 1
    if (nextIdx < problems.length) {
      navigate(`/taste/quiz/${subject}/${nextIdx}`)
      return
    }
    if (subject === 'math') {
      if (isEnglishComplete()) navigate('/taste/complete')
      else navigate('/taste/quiz/english/0')
    } else {
      if (isMathComplete()) navigate('/taste/complete')
      else navigate('/taste/quiz/math/0')
    }
  }

  const handleClose = () => {
    if (window.confirm('중단하고 나가면 이 문제까지의 결과가 저장되지 않아요.')) {
      navigate('/taste')
    }
  }

  // "모르겠어요" - 선택 없이 오답 처리하고 다음 문제로 (0점 · 시간 초과 여부만 플래그)
  const handleDontKnow = () => {
    addResult(subject as Subject, {
      problemId: problem.id,
      selectedChoice: null,
      correct: false,
      earnedPoints: 0,
      timeoverFlag: overTime,
      peekedBeforeAnswer: false,
      elapsedMs: Date.now() - startAt.current,
    })
    // 채점 마크 · 모르겠어요 = 오답
    setGrading('wrong')
    advanceTimerRef.current = window.setTimeout(() => {
      goNext()
    }, 1100)
  }

  const submitDisabled = selected == null && !peeked && !overTime
  const submitLabel = overTime ? '시간초과 채점' : '채점하기'

  return (
    <div className="quiz-page flex min-h-dvh min-w-[350px] flex-col bg-[#F2F2F2]">
      <QuizTopBar
        progress={{ current: idx + 1, total: problems.length }}
        subjectLabel={SUBJECT_LABEL[subject as Subject]}
        onClose={handleClose}
        onPeekExplanation={() => requestPeek('explanation')}
        onPeekAnswer={() => requestPeek('answer')}
        onSubmit={submitAndNext}
        submitDisabled={submitDisabled}
        submitLabel={submitLabel}
      />

      <DrawingToolbar
        tool={tool}
        color={color}
        size={size}
        allowFinger={allowFinger}
        drawingEnabled={drawingEnabled}
        onToolChange={setTool}
        onColorChange={setColor}
        onSizeChange={setSize}
        onAllowFingerChange={setAllowFinger}
        onDrawingEnabledChange={setDrawingEnabled}
        onUndo={() => canvasRef.current?.undo()}
        onClear={() => canvasRef.current?.clear()}
      />

      {/* 컨텐츠 영역 · 데스크탑에서는 main + panel 이 flex row 로 나란히 · 모바일은 panel 이 fixed overlay */}
      <div className="flex flex-1 flex-row min-h-0">
        {/* main 이 relative → ResizeDivider 가 main 의 우측 끝 (= 패널 좌측 border) 에 absolute 앵커 */}
        <main className="relative flex flex-1 min-w-0 flex-col items-center">
          {/* 문제 영역 · 항상 max-w-[500px] 고정 (해설 열려도 유지)
              해설 패널은 우측에 별도 폭으로 붙음 · 문제 영역은 가독성 위한 500px 유지 */}
          <section className="relative flex w-full max-w-[500px] flex-1 flex-col overflow-hidden bg-canvas no-select">
            <div className="flex h-12 flex-none items-center justify-between border-b border-line px-lg">
              {/* 채점 마크는 "문제 N" 텍스트 위에 절대 배치 · 텍스트 클리핑 방지를 위해 wrapper 만 relative */}
              <div className="relative flex items-center">
                <h2 className="text-body font-bold text-foreground">
                  문제 {idx + 1}
                </h2>
                {grading !== 'none' && (
                  <GradeMark
                    // key 로 매 채점마다 새 인스턴스 → 애니메이션 재시작
                    key={`${idx}-${grading}`}
                    type={grading}
                  />
                )}
              </div>
              <div className="flex items-center gap-md">
                <div className="whitespace-nowrap text-body-sm tabular-nums text-muted">
                  권장 {Math.max(1, Math.round(problem.tRecSec / 60))}분 · 제한 {Math.max(1, Math.round(problem.tMaxSec / 60))}분
                </div>
                <TimerBadge
                  elapsedSec={elapsedSec}
                  tRecSec={problem.tRecSec}
                  tMaxSec={problem.tMaxSec}
                  variant="onLight"
                />
              </div>
            </div>

            {/* 캔버스 영역 · 문제 · 보기 · 빈 공간 다 필기 가능
                원형 숫자만 z-20 으로 캔버스 위에 노출 → 클릭 가능
                다른 요소 (문제 텍스트 · 답 값 · 빈 공간) 는 캔버스가 위에 덮어서 필기 통과
                min-h 없음 → 뷰포트 짧아도 컨텐츠(문제+선지) 우선 표시 · 필기 공간은 flex-1 spacer 로 남은 만큼 */}
            <div className="relative flex flex-1 flex-col">
              {/* 문제 본문 · 배경 (z-0) */}
              <div className="px-xl pt-lg no-select">
                <ProblemBody problem={problem} />
              </div>

              {/* 보기 · 원형 숫자만 z-20 · 답 값은 z-0 */}
              <div className="mt-lg px-lg">
                <div className="grid grid-cols-5">
                  {problem.choices.map((choice, i) => {
                    const choiceNo = i + 1
                    const active = selected === choiceNo
                    const answerText = choice.replace(/^[①②③④⑤]\s*/, '')
                    return (
                      <div
                        key={choiceNo}
                        className="flex min-h-11 items-center justify-center gap-sm py-md"
                      >
                        {/* 원형 숫자 (클릭 대상) · z-20 로 캔버스 위 · 클릭 가능 */}
                        <button
                          type="button"
                          onClick={() => setSelected(choiceNo)}
                          aria-pressed={active}
                          className={clsx(
                            'relative z-20 flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-bold transition-all',
                            active
                              ? 'bg-primary text-white'
                              : 'border-[1.8px] border-foreground bg-canvas text-foreground',
                          )}
                        >
                          {choiceNo}
                        </button>
                        {/* 답 값 · z-0 · 캔버스가 위에 덮으므로 클릭 안 됨 · 필기 통과 */}
                        <span className="font-batang text-body font-medium text-foreground">
                          <KatexText text={answerText} />
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 빈 필기 공간 · flex-1 로 나머지 채움 */}
              <div className="flex-1" />

              {/* 캔버스 · z-10 · 문제 · 답 값 위에 필기 가능 (원형 숫자 아래)
                  해설 패널 열려있어도 필기는 가능 · md+ 는 옆에 나란히 · 모바일은 overlay 라 시각적으로만 가려짐 */}
              <div className="absolute inset-0 z-10">
                <DrawingCanvas
                  ref={canvasRef}
                  tool={tool}
                  color={color}
                  size={size}
                  disabled={!drawingEnabled}
                  allowFinger={allowFinger}
                />
              </div>
            </div>

            {/* 모르겠어요 · 카드 최하단 */}
            <div className="border-t border-line bg-canvas/95 px-lg py-md">
              <button
                type="button"
                onClick={handleDontKnow}
                className="flex min-h-10 w-full items-center justify-center rounded-btn-md border border-dashed border-line bg-canvas px-md py-sm text-body-sm font-semibold text-muted transition-colors hover:border-muted hover:bg-surface hover:text-body"
              >
                모르겠어요 · 넘어가기
              </button>
            </div>
          </section>
          {/* 드래그 divider · main 우측 끝 (해설 패널 좌측 border) 위에 겹쳐서 표시
              해설 열림 상태에서만 노출 · 모바일은 자체적으로 hidden */}
          <ResizeDivider
            show={panelOpen}
            onStart={() => setResizing(true)}
            onDrag={(dx) =>
              setPanelWidth((w) => {
                // 우측 이동(양수 dx) → 우측 패널 폭 감소. 300~800px 범위 clamp
                const next = w - dx
                return Math.max(300, Math.min(800, next))
              })
            }
            onEnd={() => setResizing(false)}
          />
        </main>

        <ExplainPanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          tab={panelTab}
          onTabChange={setPanelTab}
          problem={problem}
          revealed={selected != null || peeked}
          width={panelWidth}
          resizing={resizing}
        />
      </div>

      {/* 10초 이내 정답 확인 팝업 · 두 버튼 다 동일 flow (다음 문제로) · POC */}
      <GuessCheckPopup
        open={guessCheckOpen}
        elapsedSec={elapsedSec}
        onSolved={handleGuessResponse}
        onGuessed={handleGuessResponse}
      />
    </div>
  )
}

function ProblemBody({ problem }: { problem: Problem }) {
  // 수능 스타일 · 문장 마지막에 [N점] 표기
  const pointsBadge = (
    <span className="ml-xs whitespace-nowrap text-body-sm font-normal text-body">
      [{problem.points}점]
    </span>
  )
  const hasConditions = !!problem.conditions && problem.conditions.length > 0
  const hasQuestion = !!problem.question

  return (
    <div className="font-batang space-y-xl text-[16px] font-medium leading-[1.85] text-foreground">
      <div>
        <KatexText text={problem.bodyText} />
        {/* 조건도 없고 별도 question 도 없으면 bodyText 마지막에 [N점] */}
        {!hasConditions && !hasQuestion && pointsBadge}
      </div>
      {hasConditions && (
        <div className="rounded-md bg-surface px-xl py-xl space-y-lg">
          {problem.conditions!.map((c, i) => (
            <div key={i}>
              <KatexText text={c} />
            </div>
          ))}
        </div>
      )}
      {hasQuestion && (
        <div>
          <KatexText text={problem.question!} />
          {pointsBadge}
        </div>
      )}
    </div>
  )
}
