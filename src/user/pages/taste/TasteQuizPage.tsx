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
import { submitAttempt, type AttemptSubmitRequest } from '@/user/api/attemptApi'
import { enqueueAttempt, isRetryableAttemptError } from '@/user/services/attemptQueue'
import { computeScore } from '@/user/utils/scoring'
import styles from './styles/TasteQuizPage.module.scss'

type Subject = 'math' | 'english'

const SUBJECT_LABEL: Record<Subject, string> = {
  math: '수학 · 지수와 로그',
  english: '영어 · 빈칸 추론',
}

/**
 * 맛보기 테스트 문제풀이 화면 (2026-08-07 플로우 변경)
 * 상단 2행 (네비 + 필기 툴바) 고정 · 아래는 문제카드 (필기 캔버스) · 보기 5개.
 *
 * 풀이 중에는 정답·해설 접근 불가 — 채점은 마지막 문제의 "채점하기"에서 일괄.
 * 보기를 선택하면 하단에서 다음/채점하기 버튼이 올라오고, 선택 해제하면 내려간다.
 * 해설은 결과 페이지(/weakness)의 문항별 "해설보기"로 확인한다.
 */
export default function TasteQuizPage() {
  const { subject, index } = useParams<{ subject: Subject; index: string }>()
  const navigate = useNavigate()
  const idx = Number(index ?? 0)

  const { mathSkillNodeId, englishTypeId, addResult, updateResult } = useTasteStore()
  const ensureSession = useUserStore((s) => s.ensureSession)

  // 홈에서 /taste 를 거치지 않고 직행하거나 새로고침·딥링크로 들어오는 경로 방어.
  // ensureSession 은 single-flight 라 시작 페이지에서 이미 확보했으면 요청이 나가지 않는다.
  useEffect(() => {
    ensureSession()
  }, [ensureSession])

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
  const [inputValue, setInputValue] = useState('') // 주관식(단답형) 입력값
  const [elapsedSec, setElapsedSec] = useState(0)
  const [tool, setTool] = useState<StrokeTool>('pen')
  const [color, setColor] = useState('#120C0B')
  const [size, setSize] = useState(0.35) // 0.1 ~ 1.0 슬라이더 값 · 도구별 픽셀 매핑은 DrawingCanvas
  const [allowFinger, setAllowFinger] = useState(false) // 아이패드 손바닥 걸침 방지 · 기본 펜만
  // 필기 도구 활성화 여부. 모바일 진입 시 DrawingToolbar 가 자동 false 로 세팅 (툴바 접힘 + canvas disabled)
  const [drawingEnabled, setDrawingEnabled] = useState(true)

  const canvasRef = useRef<DrawingCanvasHandle>(null)
  const startAt = useRef<number>(Date.now())

  useEffect(() => {
    setSelected(null)
    setInputValue('')
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
      source: 'TRIAL',
      // 무응답은 서버가 400(답 필수)을 던지므로 0 을 sentinel 로 보낸다.
      // 정답 번호는 1~5 라 절대 일치하지 않아 오답으로 채점된다 (skipped 플래그는 백엔드 후속)
      submittedNo: selectedChoice ?? 0,
      timeSpentMs: Math.round(elapsedMs),
    }

    submitAttempt(req)
      .then((res) =>
        updateResult(subject as Subject, problem.id, {
          attemptId: res.attemptId,
          serverCorrect: res.isCorrect,
        }),
      )
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
    addResult(subject as Subject, {
      problemId: problem.id,
      selectedChoice: answerValue,
      correct,
      earnedPoints: score.earnedPoints,
      timeoverFlag: score.timeoverFlag,
      peekedBeforeAnswer: false,
      elapsedMs,
    })
    recordAttempt(answerValue, elapsedMs)
    goNext()
  }

  // 선택한 과목의 문제만 풀고 완주 — 마지막 문제(채점하기)는 결과 페이지로 직행
  const goNext = () => {
    const nextIdx = idx + 1
    if (nextIdx < problems.length) {
      navigate(`/taste/quiz/${subject}/${nextIdx}`)
      return
    }
    navigate('/weakness')
  }

  const handleClose = () => {
    // 문항별 즉시 저장으로 바뀌어 "저장 안 됨" 안내는 더 이상 사실이 아니다
    if (window.confirm('나가면 이 진단은 여기서 끝나요. 지금까지 푼 문제는 저장돼요.')) {
      navigate('/taste')
    }
  }

  const handleDontKnow = () => {
    const elapsedMs = Date.now() - startAt.current
    addResult(subject as Subject, {
      problemId: problem.id,
      selectedChoice: null,
      correct: false,
      earnedPoints: 0,
      timeoverFlag: overTime,
      peekedBeforeAnswer: false,
      elapsedMs,
    })
    recordAttempt(null, elapsedMs)
    goNext()
  }

  return (
    <div className={styles.page}>
      <QuizTopBar
        progress={{ current: idx + 1, total: problems.length }}
        subjectLabel={SUBJECT_LABEL[subject as Subject]}
        onClose={handleClose}
        progressRatio={(idx + 1) / problems.length}
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

      {/* 하단 고정 답안 바 — 객관식 ①~⑤ / 주관식 숫자 입력 + 다음·모르겠어요 */}
      <div className={styles.answerBar}>
        {isShortAnswer ? (
          <div className={styles.answerInputRow}>
            <button
              type="button"
              aria-label="부호 전환"
              // iOS 숫자 키패드에 마이너스가 없어 별도 ± 토글 제공
              onClick={() =>
                setInputValue((v) => (v.startsWith('-') ? v.slice(1) : v ? `-${v}` : '-'))
              }
              className={clsx(styles.answerSign, inputValue.startsWith('-') && styles.answerSignActive)}
            >
              ±
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="-?[0-9]*"
              placeholder="정답 입력"
              value={inputValue}
              onChange={(e) => {
                // 숫자 + 맨 앞 마이너스만 허용
                const raw = e.target.value.replace(/[^0-9-]/g, '')
                setInputValue(raw.replace(/(?!^)-/g, ''))
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
                  {String.fromCodePoint(0x2460 + i)}
                </button>
              )
            })}
          </div>
        )}
        {answerValue != null ? (
          <button type="button" onClick={submitAndNext} className={styles.nextButton}>
            {isLast ? '채점하기' : '다음'}
          </button>
        ) : (
          <button type="button" onClick={handleDontKnow} className={styles.dontKnowButton}>
            모르겠어요 · 넘어가기
          </button>
        )}
      </div>
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
