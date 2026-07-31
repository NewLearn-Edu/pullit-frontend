import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { QuizTopBar } from '@/user/components/quiz/QuizTopBar'
import { DrawingCanvas, DrawingCanvasHandle, StrokeTool } from '@/user/components/quiz/DrawingCanvas'
import { DrawingToolbar } from '@/user/components/quiz/DrawingToolbar'
import { ExplainPanel } from '@/user/components/quiz/ExplainPanel'
import { ResizeDivider } from '@/user/components/quiz/ResizeDivider'
import { GradeMark } from '@/user/components/quiz/GradeMark'
import { GuessCheckPopup } from '@/user/components/quiz/GuessCheckPopup'
import { TimerBadge } from '@/user/components/quiz/TimerBadge'
import { KatexText } from '@/shared/components/KatexText'
import {
  getProblemsBySkillNode,
  getProblemsByEnglishType,
  type Problem,
} from '@/user/data/mockProblems'
import { useTasteStore } from '@/user/stores/tasteStore'
import { computeScore } from '@/user/utils/scoring'
import styles from './styles/TasteQuizPage.module.scss'

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
  const [grading, setGrading] = useState<'none' | 'correct' | 'wrong'>('none')
  // 10초 안에 정답 맞힘 → "찍은 거 같은데" 확인 팝업
  const [guessCheckOpen, setGuessCheckOpen] = useState(false)

  const canvasRef = useRef<DrawingCanvasHandle>(null)
  const startAt = useRef<number>(Date.now())
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

    const effectiveCorrect = correct && !peeked
    setGrading(effectiveCorrect ? 'correct' : 'wrong')

    if (effectiveCorrect && elapsedSec < 10) {
      advanceTimerRef.current = window.setTimeout(() => {
        setGuessCheckOpen(true)
      }, 500)
    } else {
      advanceTimerRef.current = window.setTimeout(() => {
        goNext()
      }, 1100)
    }
  }

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
    setGrading('wrong')
    advanceTimerRef.current = window.setTimeout(() => {
      goNext()
    }, 1100)
  }

  const submitDisabled = selected == null && !peeked && !overTime
  const submitLabel = overTime ? '시간초과 채점' : '채점하기'

  return (
    <div className={styles.page}>
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

      <div className={styles.content}>
        <main className={styles.main}>
          <section className={styles.problemCard}>
            {/* 진행 바 · 현재 문제 위치 / 전체 (문제 1 부터 1칸 채워짐) */}
            <div className={styles.progressWrap}>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${((idx + 1) / problems.length) * 100}%` }}
                />
              </div>
            </div>
            <div className={styles.problemHeader}>
              <div className={styles.problemTitleWrap}>
                <h2 className={styles.problemTitle}>문제 {idx + 1}</h2>
                {grading !== 'none' && (
                  <GradeMark
                    // key 로 매 채점마다 새 인스턴스 → 애니메이션 재시작
                    key={`${idx}-${grading}`}
                    type={grading}
                  />
                )}
              </div>
              <div className={styles.problemMeta}>
                <div className={styles.problemTime}>
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

            <div className={styles.canvasArea}>
              <div className={styles.bodyWrap}>
                <ProblemBody problem={problem} />
              </div>

              <div className={styles.choicesWrap}>
                <div className={styles.choicesGrid}>
                  {problem.choices.map((choice, i) => {
                    const choiceNo = i + 1
                    const active = selected === choiceNo
                    const answerText = choice.replace(/^[①②③④⑤]\s*/, '')
                    return (
                      <div key={choiceNo} className={styles.choiceCell}>
                        <button
                          type="button"
                          onClick={() => setSelected(choiceNo)}
                          aria-pressed={active}
                          className={clsx(
                            styles.choiceButton,
                            active && styles.choiceButtonActive,
                          )}
                        >
                          {choiceNo}
                        </button>
                        <span className={styles.choiceValue}>
                          <KatexText text={answerText} />
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className={styles.spacer} />

              <div className={styles.canvasOverlay}>
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

            <div className={styles.footer}>
              <button
                type="button"
                onClick={handleDontKnow}
                className={styles.dontKnowButton}
              >
                모르겠어요 · 넘어가기
              </button>
            </div>
          </section>

          <ResizeDivider
            show={panelOpen}
            onStart={() => setResizing(true)}
            onDrag={(dx) =>
              setPanelWidth((w) => {
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
  const pointsBadge = (
    <span className={styles.pointsBadge}>[{problem.points}점]</span>
  )
  const hasConditions = !!problem.conditions && problem.conditions.length > 0
  const hasQuestion = !!problem.question

  return (
    <div className={styles.problemBody}>
      <div>
        <KatexText text={problem.bodyText} />
        {!hasConditions && !hasQuestion && pointsBadge}
      </div>
      {hasConditions && (
        <div className={styles.conditionsBox}>
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
