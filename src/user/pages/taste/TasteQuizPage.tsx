import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { QuizTopBar } from '@/user/components/quiz/QuizTopBar'
import { DrawingCanvas, DrawingCanvasHandle, StrokeTool } from '@/user/components/quiz/DrawingCanvas'
import { DrawingToolbar } from '@/user/components/quiz/DrawingToolbar'
import { TimerBadge } from '@/user/components/quiz/TimerBadge'
import { MathProblemRender } from '@/shared/components/ExamRender'
import {
  getProblemsBySkillNode,
  getProblemsByEnglishType,
  type Problem,
} from '@/user/data/mockProblems'
import { useTasteStore } from '@/user/stores/tasteStore'
import { useUserStore } from '@/user/stores/userStore'
import { useSolveStore } from '@/user/stores/solveStore'
import { submitAttempt, type AttemptSubmitRequest } from '@/user/api/attemptApi'
import { enqueueAttempt, isRetryableAttemptError } from '@/user/services/attemptQueue'
import { computeScore } from '@/user/utils/scoring'
import styles from './styles/TasteQuizPage.module.scss'

type Subject = 'math' | 'english'

const SUBJECT_LABEL: Record<Subject, string> = {
  math: '수학 · 지수와 로그',
  english: '영어 · 빈칸 추론',
}

type QuizMode = 'taste' | 'solve'

/**
 * 문제풀이 화면 (2026-08-07 플로우 변경 · 2026-08-11 solve 모드 추가)
 *
 * mode='taste' (기본, /taste/quiz/*): 맛보기 진단 — 진행바·문항 카운트 표시,
 *   결과를 tasteStore 에 쌓고 마지막 문제에서 결과 페이지(/weakness)로.
 * mode='solve' (/solve/*): 일반 문제풀이 — 진행 표시 없음, source=FREE,
 *   진단 세션을 오염시키지 않고 마지막 문제 완료 시 홈으로 (결과 화면은 후속).
 * 상단 2행 (네비 + 필기 툴바) 고정 · 아래는 문제카드 (필기 캔버스) · 보기 5개.
 *
 * 풀이 중에는 정답·해설 접근 불가 — 채점은 마지막 문제의 "채점하기"에서 일괄.
 * 보기를 선택하면 하단에서 다음/채점하기 버튼이 올라오고, 선택 해제하면 내려간다.
 * 해설은 결과 페이지(/weakness)의 문항별 "해설보기"로 확인한다.
 */
export default function TasteQuizPage({ mode = 'taste' }: { mode?: QuizMode }) {
  const isTaste = mode === 'taste'
  const { subject, index } = useParams<{ subject: Subject; index: string }>()
  const navigate = useNavigate()
  const idx = Number(index ?? 0)

  const { mathSkillNodeId, englishTypeId, addResult, updateResult } = useTasteStore()
  const solveSession = useSolveStore((s) => s.session) // 오답 다시 풀기 등 진입처가 준비한 세션
  const ensureSession = useUserStore((s) => s.ensureSession)

  // 홈에서 /taste 를 거치지 않고 직행하거나 새로고침·딥링크로 들어오는 경로 방어.
  // ensureSession 은 single-flight 라 시작 페이지에서 이미 확보했으면 요청이 나가지 않는다.
  useEffect(() => {
    ensureSession()
  }, [ensureSession])

  const problems = useMemo(() => {
    if (!isTaste && solveSession) return solveSession.problems
    if (subject === 'math' && mathSkillNodeId) {
      return getProblemsBySkillNode(mathSkillNodeId)
    }
    if (subject === 'english' && englishTypeId) {
      return getProblemsByEnglishType(englishTypeId)
    }
    return []
  }, [isTaste, solveSession, subject, mathSkillNodeId, englishTypeId])

  useEffect(() => {
    if (!isTaste && solveSession) return // 진입처가 준비한 문제로 진행 — 목 선택 불필요
    const fallback = isTaste ? '/taste' : '/home'
    if (subject === 'math' && !mathSkillNodeId) {
      navigate(fallback, { replace: true })
    } else if (subject === 'english' && !englishTypeId) {
      navigate(fallback, { replace: true })
    }
  }, [subject, mathSkillNodeId, englishTypeId, navigate, isTaste, solveSession])

  const problem = problems[idx]

  // 문제별 상태
  const [selected, setSelected] = useState<number | null>(null)
  const [inputValue, setInputValue] = useState('') // 주관식(단답형) 입력값
  const [elapsedSec, setElapsedSec] = useState(0)
  const [tool, setTool] = useState<StrokeTool>('pen')
  const [color, setColor] = useState('#120C0B')
  const [size, setSize] = useState(0.35) // 0.1 ~ 1.0 슬라이더 값 · 도구별 픽셀 매핑은 DrawingCanvas
  const [allowFinger, setAllowFinger] = useState(false) // 아이패드 손바닥 걸침 방지 · 기본 펜만
  // 필기 도구 활성화 여부. 모바일 진입 시 DrawingToolbar 가 자동 false 로 세팅 (툴바 접힘 + canvas disabled)
  const [drawingEnabled, setDrawingEnabled] = useState(true)
  // 모르겠어요·넘어가기 확인 팝업
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false)

  const canvasRef = useRef<DrawingCanvasHandle>(null)
  const answerBarRef = useRef<HTMLDivElement>(null)
  const startAt = useRef<number>(Date.now())

  // 가상 키보드가 열리면 하단 답안 바를 키보드 위로 올린다.
  // iOS·iPadOS(웹앱 standalone 포함)와 안드로이드 크롬 모두 키보드가 열려도
  // position:fixed 는 레이아웃 뷰포트 기준이라 바가 키보드 뒤에 가려진다.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onViewportChange = () => {
      const bar = answerBarRef.current
      if (!bar) return
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      // 가로 센터링(translateX -50%)을 유지한 채 세로만 보정
      bar.style.transform = `translate(-50%, -${overlap}px)`
    }
    vv.addEventListener('resize', onViewportChange)
    vv.addEventListener('scroll', onViewportChange)
    return () => {
      vv.removeEventListener('resize', onViewportChange)
      vv.removeEventListener('scroll', onViewportChange)
    }
  }, [])

  useEffect(() => {
    setSelected(null)
    setInputValue('')
    setSkipConfirmOpen(false)
    setElapsedSec(0)
    canvasRef.current?.clear()
    startAt.current = Date.now()
  }, [idx, subject])

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startAt.current) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [idx, subject])

  // iOS Safari 콜아웃 (복사하기 · 선택 영역 찾기 …) 강제 차단
  // 주관식 입력창은 예외 — selectstart 를 막으면 캐럿이 못 잡혀 포커스가 즉시 풀린다
  useEffect(() => {
    const isEditable = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')
    const clearSelection = () => {
      if (isEditable(document.activeElement)) return
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) sel.removeAllRanges()
    }
    const preventSelect = (e: Event) => {
      if (isEditable(e.target)) return
      e.preventDefault()
    }
    document.addEventListener('selectionchange', clearSelection)
    document.addEventListener('selectstart', preventSelect)
    return () => {
      document.removeEventListener('selectionchange', clearSelection)
      document.removeEventListener('selectstart', preventSelect)
    }
  }, [])

  if (!problem) return null

  const overTime = elapsedSec > problem.tMaxSec
  const isLast = idx === problems.length - 1

  // 주관식(단답형) — 보기 없이 숫자 입력으로 답한다 (음수 허용)
  const isShortAnswer = problem.choices.length === 0
  const shortAnswerValue = /^-?\d+$/.test(inputValue.trim())
    ? parseInt(inputValue.trim(), 10)
    : null
  /** 현재 문제의 답 (객관식 = 선택 번호 · 주관식 = 입력값) */
  const answerValue = isShortAnswer ? shortAnswerValue : selected

  /**
   * 풀이 1건을 서버 원장에 남긴다 — 화면 진행을 절대 막지 않는다 (fire-and-forget).
   * 실패분은 큐에 넣어 세션 확보·로그인·완료 화면 시점에 재전송한다.
   */
  const recordAttempt = (selectedChoice: number | null, elapsedMs: number) => {
    const serverId = problem.serverId
    if (!serverId) return // 서버 미매핑 목 문항 (영어 창작 데이터) — 저장 스킵
    // 주관식은 서버 채점(1~5 비교)과 맞지 않아 스킵 — 단답 채점은 백엔드 후속 과제
    if (isShortAnswer) return

    const req: AttemptSubmitRequest = {
      problemId: serverId,
      source: isTaste ? 'TRIAL' : (solveSession?.source ?? 'FREE'),
      // 무응답은 서버가 400(답 필수)을 던지므로 0 을 sentinel 로 보낸다.
      // 정답 번호는 1~5 라 절대 일치하지 않아 오답으로 채점된다 (skipped 플래그는 백엔드 후속)
      submittedNo: selectedChoice ?? 0,
      timeSpentMs: Math.round(elapsedMs),
    }

    submitAttempt(req)
      .then((res) => {
        if (!isTaste) return // 일반 풀이는 진단 세션 결과를 건드리지 않는다
        updateResult(subject as Subject, problem.id, {
          attemptId: res.attemptId,
          serverCorrect: res.isCorrect,
        })
      })
      .catch((error) => {
        if (isRetryableAttemptError(error)) enqueueAttempt(req)
      })
  }

  /** 다음/채점하기 — 답을 기록하고 진행. 채점 결과는 결과 페이지에서 일괄 공개 */
  const submitAndNext = () => {
    if (answerValue == null) return
    const correct = answerValue === problem.answer
    const score = computeScore({
      points: problem.points,
      correct,
      elapsedSec,
      tRecSec: problem.tRecSec,
      tMaxSec: problem.tMaxSec,
      peekedBeforeAnswer: false,
    })

    const elapsedMs = Date.now() - startAt.current
    if (isTaste) {
      addResult(subject as Subject, {
        problemId: problem.id,
        selectedChoice: answerValue,
        correct,
        earnedPoints: score.earnedPoints,
        timeoverFlag: score.timeoverFlag,
        peekedBeforeAnswer: false,
        elapsedMs,
      })
    }
    recordAttempt(answerValue, elapsedMs)
    goNext()
  }

  // 맛보기: 마지막 문제(채점하기) → 결과 페이지 · 일반 풀이: 완료 → 홈 (결과 화면 후속)
  const goNext = () => {
    const nextIdx = idx + 1
    if (nextIdx < problems.length) {
      navigate(`${isTaste ? '/taste/quiz' : '/solve'}/${subject}/${nextIdx}`)
      return
    }
    navigate(isTaste ? '/weakness' : (solveSession?.returnTo ?? '/home'))
  }

  const handleClose = () => {
    // 문항별 즉시 저장으로 바뀌어 "저장 안 됨" 안내는 더 이상 사실이 아니다
    if (window.confirm('나가면 풀이가 여기서 끝나요. 지금까지 푼 문제는 저장돼요.')) {
      navigate(isTaste ? '/taste' : (solveSession?.returnTo ?? '/home'))
    }
  }

  /** 모르겠어요 확정 — 무응답 오답으로 기록하고 진행 */
  const confirmDontKnow = () => {
    setSkipConfirmOpen(false)
    const elapsedMs = Date.now() - startAt.current
    if (isTaste) {
      addResult(subject as Subject, {
        problemId: problem.id,
        selectedChoice: null,
        correct: false,
        earnedPoints: 0,
        timeoverFlag: overTime,
        peekedBeforeAnswer: false,
        elapsedMs,
      })
    }
    recordAttempt(null, elapsedMs)
    goNext()
  }

  return (
    <div className={styles.page}>
      <QuizTopBar
        progress={isTaste ? { current: idx + 1, total: problems.length } : undefined}
        subjectLabel={SUBJECT_LABEL[subject as Subject]}
        onClose={handleClose}
        progressRatio={isTaste ? (idx + 1) / problems.length : undefined}
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
            <div className={styles.problemHeader}>
              <div className={styles.problemTitleWrap}>
                <h2 className={styles.problemTitle}>문제 {idx + 1}</h2>
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

              {/* 보기 — 시험지처럼 읽기 전용 (선택은 하단 고정 바에서 · 주관식은 보기 없음) */}
              {!isShortAnswer && (
                <div className={styles.choicesWrap}>
                  <div className={styles.choicesGrid}>
                    {problem.choices.map((choice, i) => {
                      const answerText = choice.replace(/^[①②③④⑤]\s*/, '')
                      return (
                        <span key={i} className={styles.choiceItem}>
                          <span className={styles.choiceNum}>
                            {String.fromCodePoint(0x2460 + i)}
                          </span>
                          <span className={styles.choiceValue}>
                            <MathProblemRender text={answerText} />
                          </span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

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

          </section>
        </main>
      </div>

      {/* 하단 고정 답안 바 — 객관식 1~5 / 주관식 숫자 입력 + 다음·모르겠어요 */}
      <div ref={answerBarRef} className={styles.answerBar}>
        {isShortAnswer ? (
          <div className={styles.answerInputRow}>
            <input
              type="text"
              inputMode="numeric"
              pattern="-?[0-9]*"
              placeholder="정답 입력 (-999~999)"
              value={inputValue}
              onChange={(e) => {
                // 숫자 + 맨 앞 마이너스만 허용 · 정답 범위 -999~999 라 숫자부는 3자리까지
                const raw = e.target.value.replace(/[^0-9-]/g, '')
                const normalized = raw.replace(/(?!^)-/g, '')
                const sign = normalized.startsWith('-') ? '-' : ''
                setInputValue(sign + normalized.replace('-', '').slice(0, 3))
              }}
              className={styles.answerInput}
            />
          </div>
        ) : (
          <div className={styles.answerRow}>
            {problem.choices.map((_, i) => {
              const choiceNo = i + 1
              const active = selected === choiceNo
              return (
                <button
                  key={choiceNo}
                  type="button"
                  // 같은 번호 재탭 = 선택 해제 → 다음 버튼이 모르겠어요로 복귀
                  onClick={() => setSelected(active ? null : choiceNo)}
                  aria-pressed={active}
                  className={clsx(styles.answerNum, active && styles.answerNumActive)}
                >
                  {choiceNo}
                </button>
              )
            })}
          </div>
        )}
        {answerValue != null ? (
          <button type="button" onClick={submitAndNext} className={styles.nextButton}>
            {isLast ? (isTaste ? '채점하기' : '완료') : '다음'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSkipConfirmOpen(true)}
            className={styles.dontKnowButton}
          >
            모르겠어요 · 넘어가기
          </button>
        )}
      </div>

      {/* 모르겠어요 확인 팝업 — 무응답은 오답으로 기록되니 한 번 확인 */}
      {skipConfirmOpen && (
        <div className={styles.confirmDim} onClick={() => setSkipConfirmOpen(false)}>
          <div
            role="alertdialog"
            aria-label="모르는 문제 확인"
            className={styles.confirmCard}
            onClick={(e) => e.stopPropagation()}
          >
            <p className={styles.confirmTitle}>모르는 문제야?</p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                onClick={() => setSkipConfirmOpen(false)}
                className={styles.confirmCancel}
              >
                취소
              </button>
              <button type="button" onClick={confirmDontKnow} className={styles.confirmOk}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PenToggleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
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
        <MathProblemRender text={problem.bodyText} />
        {!hasConditions && !hasQuestion && pointsBadge}
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
