import { useEffect, useRef, useState } from 'react'
import { useBlockNativePinch, usePinchZoom } from '@/user/hooks/usePinchZoom'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { QuizTopBar } from '@/user/components/quiz/QuizTopBar'
import { DrawingCanvasHandle, EraserMode, StrokeTool } from '@/user/components/quiz/DrawingCanvas'
import { ProblemNoteCanvas } from '@/user/components/quiz/ProblemNoteCanvas'
import { DrawingToolbar } from '@/user/components/quiz/DrawingToolbar'
import { TimerBadge } from '@/user/components/quiz/TimerBadge'
import { EnglishProblemRender, MathProblemRender } from '@/shared/components/ExamRender'
import { QuestionRender } from '@/shared/components/QuestionBlocks'
import { ExamScaleFrame } from '@/shared/components/ExamScaleFrame'
import { type Problem } from '@/user/data/mockProblems'
import { loadQuizProblems } from '@/user/services/problemSet'
import { CreditUsedToast } from '@/user/components/CreditUsedToast'
import { ConfirmDialog } from '@/user/components/ConfirmDialog'
import { useTrialStore } from '@/user/stores/trialStore'
import { useTrialProgressStore } from '@/user/stores/trialProgressStore'
import { useUserStore } from '@/user/stores/userStore'
import { useSolveStore } from '@/user/stores/solveStore'
import { useTrialFunnelGuard } from '@/user/hooks/useTrialFunnelGuard'
import { submitAttempt, type AttemptSubmitRequest } from '@/user/api/attemptApi'
import { enqueueAttempt, isRetryableAttemptError } from '@/user/services/attemptQueue'
import { computeScore } from '@/user/utils/scoring'
import styles from './styles/TrialQuizPage.module.scss'

type Subject = 'math' | 'english'

// 온보딩 맛보기 고정 영역 폴백 — 홈에서 시작한 세트는 pendingUnit.unitName 이 정본
const SUBJECT_LABEL: Record<Subject, string> = {
  math: '수학 · 지수와 로그',
  english: '영어 · 주제',
}

/** 90초 → "1분 30초" · 120초 → "2분" — DB 권장시간을 올림 없이 그대로 표기.
    해설 리뷰(TrialReviewPage)의 권장 시간 표기에서도 사용 */
export function formatKoreanDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m === 0) return `${s}초`
  return s > 0 ? `${m}분 ${s}초` : `${m}분`
}

/** 문항별 타이머 시작 시각 저장 키 — 새로고침에도 경과 시간이 이어지게 (sessionStorage) */
function quizStartKey(mode: QuizMode, subject: string | undefined, idx: number): string {
  return `pullit_quiz_start:${mode}:${subject}:${idx}`
}

export function clearQuizStart(mode: QuizMode, subject: string | undefined, idx: number): void {
  try {
    sessionStorage.removeItem(quizStartKey(mode, subject, idx))
  } catch {
    /* 무시 */
  }
}

/** 세트 새로 시작 시 잔여 타이머 스냅샷 일괄 정리 — TrialStartPage 진입에서 호출 */
export function clearAllQuizStarts(): void {
  try {
    const doomed: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key?.startsWith('pullit_quiz_start:')) doomed.push(key)
    }
    doomed.forEach((key) => sessionStorage.removeItem(key))
  } catch {
    /* 무시 */
  }
}

type QuizMode = 'trial' | 'solve'

/**
 * 문제풀이 화면 (2026-08-07 플로우 변경 · 2026-08-11 solve 모드 추가)
 *
 * mode='trial' (기본, /trial/quiz/*): 맛보기 진단 — 진행바·문항 카운트 표시,
 *   결과를 trialStore 에 쌓고 마지막 문제에서 결과 페이지(/weakness)로.
 * mode='solve' (/solve/*): 일반 문제풀이 — 진행 표시 없음, source=FREE,
 *   진단 세션을 오염시키지 않고 마지막 문제 완료 시 홈으로 (결과 화면은 후속).
 * 상단 2행 (네비 + 필기 툴바) 고정 · 아래는 문제카드 (필기 캔버스) · 보기 5개.
 *
 * 풀이 중에는 정답·해설 접근 불가 — 채점은 마지막 문제의 "채점하기"에서 일괄.
 * 보기를 선택하면 하단에서 다음/채점하기 버튼이 올라오고, 선택 해제하면 내려간다.
 * 해설은 결과 페이지(/weakness)의 문항별 "해설보기"로 확인한다.
 */
export default function TrialQuizPage({ mode = 'trial' }: { mode?: QuizMode }) {
  const isTrial = mode === 'trial'
  const { subject, index } = useParams<{ subject: Subject; index: string }>()
  const navigate = useNavigate()
  const idx = Number(index ?? 0)

  const { mathSkillNodeId, englishTypeId, addResult, updateResult } = useTrialStore()
  const solveSession = useSolveStore((s) => s.session) // 오답 다시 풀기 등 진입처가 준비한 세션
  const recordSolveResult = useSolveStore((s) => s.recordResult)

  // 맛보기를 이미 완주한 회원의 딥링크 진입 방어 — 미완 유저(게스트·신규 회원)는 통과.
  // solve 모드(오답 재풀이)는 완주 회원의 정상 경로라 가드 제외.
  // 홈에서 시작한 진단 세트(pendingUnit 존재)도 제외 — 같은 /trial/quiz 라우트를
  // 재사용하는데, 온보딩 가드가 완주 회원을 홈으로 되돌려보내면 크레딧만 차감되고
  // 문제를 못 보는 사고가 난다 (온보딩 퍼널은 진입 시 clearPendingUnit 을 하므로
  // pendingUnit 유무가 홈 진입과 온보딩 진입을 정확히 가른다).
  // 맛보기는 세션 없이 진행한다 — users 로우는 결과 화면 이후 /signup 에서
  // 건너뛰기(게스트) 또는 소셜 가입 시점에만 생성된다 (2026-08-19 확정)
  const pendingUnit = useTrialProgressStore((s) => s.pendingUnit)
  useTrialFunnelGuard(isTrial && !pendingUnit)

  // 문제 세트 — 서버(GET /api/problems) 우선, 실패·부족 시 목 폴백 (problemSet 캐시 공유)
  const [problems, setProblems] = useState<Problem[]>(() =>
    !isTrial && solveSession ? solveSession.problems : [],
  )
  useEffect(() => {
    if (!isTrial && solveSession) {
      setProblems(solveSession.problems)
      return
    }
    const nodeId = subject === 'math' ? mathSkillNodeId : englishTypeId
    if (!subject || !nodeId) return
    let alive = true
    loadQuizProblems(subject, nodeId).then((list) => {
      if (alive) setProblems(list)
    })
    return () => {
      alive = false
    }
  }, [isTrial, solveSession, subject, mathSkillNodeId, englishTypeId])

  useEffect(() => {
    if (!isTrial && solveSession) return // 진입처가 준비한 문제로 진행 — 목 선택 불필요
    const fallback = isTrial ? '/trial' : '/home'
    if (subject === 'math' && !mathSkillNodeId) {
      navigate(fallback, { replace: true })
    } else if (subject === 'english' && !englishTypeId) {
      navigate(fallback, { replace: true })
    }
  }, [subject, mathSkillNodeId, englishTypeId, navigate, isTrial, solveSession])

  const problem = problems[idx]

  // 문제별 상태
  const [selected, setSelected] = useState<number | null>(null)
  const [inputValue, setInputValue] = useState('') // 주관식(단답형) 입력값
  const [elapsedSec, setElapsedSec] = useState(0)
  const [tool, setTool] = useState<StrokeTool>('mono')
  const [color, setColor] = useState('#120C0B')
  const [size, setSize] = useState(0.2) // 0.1 ~ 1.0 슬라이더 값 · 도구별 굵기 매핑은 DrawingCanvas
  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke') // 지우개 종류 — 기본 전체 (2026-09-04, 이전 기본은 일부)
  // 복원한 필기의 세로 끝(px)만큼 캔버스 영역을 확보해 아래쪽 필기가 안 잘리게 (폰 저장 → 태블릿).
  // state 가 아니라 style 직접 — 획마다 문제 본문(KaTeX)까지 다시 그리지 않는다
  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const applyNoteHeight = (px: number) => {
    const el = canvasAreaRef.current
    if (el) el.style.minHeight = px > 0 ? `${px}px` : ''
  }
  const [allowFinger, setAllowFinger] = useState(false) // 아이패드 손바닥 걸침 방지 · 기본 펜만
  // 필기 도구 활성화 여부. 모바일 진입 시 DrawingToolbar 가 자동 false 로 세팅 (툴바 접힘 + canvas disabled)
  const [drawingEnabled, setDrawingEnabled] = useState(true)
  // 두 손가락 확대·이동 — 문제 칼럼(main) 기준
  const mainRef = useRef<HTMLElement>(null)
  const problemCardRef = useRef<HTMLElement>(null)
  const pinch = usePinchZoom(mainRef, problemCardRef, { maxBaseWidth: 500 }) // 카드 max-width 와 동일
  useBlockNativePinch() // 카드 밖(헤더·필기 도구·배경)에서는 브라우저 확대도 안 되게
  // 모르겠어요·넘어가기 확인 팝업
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false)
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false) // 나가기 확인 팝업 (브라우저 confirm 대체)

  const canvasRef = useRef<DrawingCanvasHandle>(null)
  const answerBarRef = useRef<HTMLDivElement>(null)
  const startAt = useRef<number>(Date.now())

  // 진단 중 뒤로가기(브라우저 버튼·엣지 스와이프) 차단 — 팝이 감지되면 즉시 현재
  // 문항으로 되돌리고(replace) 가드 엔트리를 재적재한다. 이탈은 X 버튼(확인 팝업)으로만.
  // (가드만 쌓는 방식은 히스토리 밑단의 이전 문항 엔트리로 라우터가 되돌아가 버린다)
  const currentQuizUrl = useRef('')
  useEffect(() => {
    currentQuizUrl.current = `/trial/quiz/${subject}/${idx}`
  }, [subject, idx])
  useEffect(() => {
    if (!isTrial) return
    window.history.pushState(null, '', window.location.href) // 첫 back 흡수용 가드
    const onPop = () => {
      navigate(currentQuizUrl.current, { replace: true }) // 팝된 엔트리를 현재 문항으로 교체
      window.history.pushState(null, '', currentQuizUrl.current) // 가드 재적재
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [isTrial, navigate])

  // 가상 키보드가 열리면 하단 답안 바를 키보드 위로 올린다.
  // iOS·iPadOS(웹앱 standalone 포함)와 안드로이드 크롬 모두 키보드가 열려도
  // position:fixed 는 레이아웃 뷰포트 기준이라 바가 키보드 뒤에 가려진다.
  //
  // ★ 입력창 포커스 중에만 보정한다 — iOS 는 스크롤로 주소창이 접히고 펴질 때도
  // visualViewport 가 계속 바뀌는데, 그때 보정이 돌면 바가 위로 날아간다
  // (모웹 스크롤 시 바텀 점프 버그, 2026-08-24)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const keyboardOpen = () => {
      const el = document.activeElement
      return el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
    }
    const onViewportChange = () => {
      const bar = answerBarRef.current
      if (!bar) return
      if (!keyboardOpen()) {
        // 키보드 상황이 아니면 항상 제자리 — 주소창 접힘·러버밴드 스크롤 무시
        bar.style.transform = 'translate(-50%, 0)'
        return
      }
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      // 가로 센터링(translateX -50%)을 유지한 채 세로만 보정
      bar.style.transform = `translate(-50%, -${overlap}px)`
    }
    vv.addEventListener('resize', onViewportChange)
    vv.addEventListener('scroll', onViewportChange)
    // 포커스가 풀리는 즉시 원위치 — 키보드 닫힘 애니메이션 중 잔여 보정 방지
    window.addEventListener('focusin', onViewportChange)
    window.addEventListener('focusout', onViewportChange)
    return () => {
      vv.removeEventListener('resize', onViewportChange)
      vv.removeEventListener('scroll', onViewportChange)
      window.removeEventListener('focusin', onViewportChange)
      window.removeEventListener('focusout', onViewportChange)
    }
  }, [])

  useEffect(() => {
    setSelected(null)
    setInputValue('')
    setSkipConfirmOpen(false)
    // 필기는 지우지 않는다 — 문제별로 저장·복원된다 (ProblemNoteCanvas 가 문제 코드 기준으로 교체)
    // 새로고침 내성 — 문항별 시작 시각을 sessionStorage 에 박아 경과 시간이 이어진다.
    // 삭제는 명시적 진행 지점(다음 문항 이동·이탈·완료)에서만 — 언마운트 cleanup 으로
    // 지우면 StrictMode 이중 마운트가 복원 직후 키를 지워 새로고침 복원이 깨진다
    const key = quizStartKey(mode, subject, idx)
    const saved = Number(sessionStorage.getItem(key))
    if (saved > 0 && saved <= Date.now()) {
      startAt.current = saved
    } else {
      startAt.current = Date.now()
      try {
        sessionStorage.setItem(key, String(startAt.current))
      } catch {
        /* 저장 불가 환경 — 메모리 시각으로만 진행 */
      }
    }
    setElapsedSec(Math.max(0, Math.floor((Date.now() - startAt.current) / 1000)))
  }, [idx, subject, mode])

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
   * 세션이 없으면(맛보기 = 가입 전) 요청 없이 큐에만 쌓는다 — 가입·게스트 생성
   * 시점(finishLogin·/signup 건너뛰기)에 일괄 전송된다. 실패분도 같은 큐로 재시도.
   */
  const recordAttempt = (selectedChoice: number | null, elapsedMs: number) => {
    const serverId = problem.serverId
    if (!serverId) return // 서버 미매핑 목 문항 (영어 창작 데이터) — 저장 스킵

    const skipped = selectedChoice == null
    const req: AttemptSubmitRequest = {
      problemId: serverId,
      source: isTrial ? 'TRIAL' : (solveSession?.source ?? 'FREE'),
      // 주관식은 원문 텍스트로 제출 — 서버가 정수 파싱해 채점한다
      submittedNo: isShortAnswer ? null : selectedChoice,
      submittedText: isShortAnswer && selectedChoice != null ? String(selectedChoice) : null,
      timeSpentMs: Math.round(elapsedMs),
      // 무응답("모르겠어요")은 skipped 로 명시 — 서버가 오답 채점 + 찍은 오답과 구분 기록
      skipped,
      // 발급 세트 연결 — 3건이 모이면 서버가 세트 DONE + 난이도 사다리 판정
      setId: isTrial ? useTrialStore.getState().activeSetId : solveSession?.setId ?? null,
    }

    // 익명(가입 전 맛보기) — 401 왕복 없이 바로 큐로. 채점은 로컬 정답으로 이미 끝났다
    if (!useUserStore.getState().me) {
      enqueueAttempt(req)
      return
    }

    // 서버 세트 문항은 로컬에 정답이 없어(answer=0) 채점 확정 시 획득 점수를 재계산해야 한다
    const elapsedSecAtSubmit = Math.round(elapsedMs / 1000)
    const { points, tRecSec, tMaxSec } = problem

    submitAttempt(req)
      .then((res) => {
        // 첫 진단 보상 지급 확정 신호 — 서버 원장 기준이라 로컬 추측 없이 축하 시트를 띄운다.
        // 잔액(me.creditBalance)도 즉시 재조회 — 캐시된 me 로 홈 배지가 낡은 잔액을 보여주지 않게
        if (res.grantedReward === 'TRIAL_FIRST_CLEAR') {
          useTrialStore.getState().markFirstRewardGranted()
          useUserStore.getState().loadMe(true)
        }
        const rescored = computeScore({
          points,
          correct: res.isCorrect,
          elapsedSec: elapsedSecAtSubmit,
          tRecSec,
          tMaxSec,
          peekedBeforeAnswer: false,
        })
        if (!isTrial) {
          // 일반 풀이 — 진단 세션이 아니라 풀이 세션(solveStore)에 채점 결과를 채운다 (세트 결과 화면용)
          recordSolveResult(problem.id, {
            pending: false,
            correct: res.isCorrect,
            answerNo: res.answerIndex ?? res.answerValue,
            explanation: res.explanation,
            translation: res.translation,
            vocabulary: res.vocabulary,
            earnedPoints: rescored.earnedPoints,
            timeoverFlag: rescored.timeoverFlag,
          })
          return
        }
        updateResult(subject as Subject, problem.id, {
          attemptId: res.attemptId,
          serverCorrect: res.isCorrect,
          serverAnswerNo: res.answerIndex ?? res.answerValue,
          serverExplanation: res.explanation,
          serverTranslation: res.translation,
          serverVocabulary: res.vocabulary,
          earnedPoints: rescored.earnedPoints,
          timeoverFlag: rescored.timeoverFlag,
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
    if (isTrial) {
      addResult(subject as Subject, {
        problemId: problem.id,
        selectedChoice: answerValue,
        correct,
        earnedPoints: score.earnedPoints,
        timeoverFlag: score.timeoverFlag,
        peekedBeforeAnswer: false,
        elapsedMs,
      })
    } else {
      recordSolveResult(problem.id, { selectedChoice: answerValue, elapsedMs, pending: true })
    }
    recordAttempt(answerValue, elapsedMs)
    goNext()
  }

  // 맛보기: 마지막 문제(채점하기) → 결과 페이지 · 일반 풀이: 완료 → 홈 (결과 화면 후속).
  // 진단(trial)은 문항 이동을 replace 로 — 이전 문항이 history 에 안 남아 뒤로가기로
  // 되돌아가 다시 풀 수 없다 (앞 문제 수정 불가, 2026-08-24 확정)
  const goNext = () => {
    clearQuizStart(mode, subject, idx) // 이 문항의 타이머 스냅샷 소진 — 재진입 시 새로 잰다
    const nextIdx = idx + 1
    if (nextIdx < problems.length) {
      navigate(`${isTrial ? '/trial/quiz' : '/solve'}/${subject}/${nextIdx}`, { replace: isTrial })
      return
    }
    // 결과 화면은 세트를 막 끝낸 직후에만 열린다 — 여기서 1회용 열람권을 발급한다
    if (isTrial) useTrialStore.getState().grantResultPass()
    if (isTrial) {
      navigate('/weakness', { replace: true })
      return
    }
    // 진단 이후의 세트 풀이(FREE·DAILY) — 세트 결과(문항별 · 3620-8224) → 점수 변동(3620-8320) 순서.
    // 오답 다시 풀기(RETRY·세트 없음)는 점수에 영향이 없다 — 결과 화면(resultTo)이 지정돼 있으면
    // 거기서 정답/오답을 보여주고, 없으면(단원 전체 다시 풀기) 진입처로 바로 돌아간다
    const returnTo = solveSession?.returnTo ?? '/home'
    if (solveSession?.resultTo) {
      navigate(solveSession.resultTo, { replace: true })
      return
    }
    if (solveSession?.setId && solveSession.unitName) {
      navigate(`/solve/result/${subject}`, { replace: true })
      return
    }
    navigate(returnTo)
  }

  /** 나가기 확정 — 문항별 즉시 저장이라 지금까지 푼 문제는 남는다 */
  const confirmExit = () => {
    setExitConfirmOpen(false)
    clearQuizStart(mode, subject, idx)
    navigate(isTrial ? '/trial' : (solveSession?.returnTo ?? '/home'))
  }

  /**
   * X — 세트 풀이(진단·자유·추천)는 "조금만 더 풀면 끝나!" 팝업(3631-13339)으로 한 번 붙잡는다.
   * 오답 다시 풀기(RETRY)는 세트도 결과 화면도 없어 붙잡을 이유가 없다 — 바로 나간다
   */
  const handleClose = () => {
    if (solveSession?.source === 'RETRY') {
      confirmExit()
      return
    }
    setExitConfirmOpen(true)
  }

  /** 모르겠어요 확정 — 무응답 오답으로 기록하고 진행 */
  const confirmDontKnow = () => {
    setSkipConfirmOpen(false)
    const elapsedMs = Date.now() - startAt.current
    if (isTrial) {
      addResult(subject as Subject, {
        problemId: problem.id,
        selectedChoice: null,
        correct: false,
        earnedPoints: 0,
        timeoverFlag: overTime,
        peekedBeforeAnswer: false,
        elapsedMs,
      })
    } else {
      recordSolveResult(problem.id, { selectedChoice: null, elapsedMs, pending: true })
    }
    recordAttempt(null, elapsedMs)
    goNext()
  }

  return (
    <div className={styles.page}>
      {/* 크레딧 사용 토스트 — 차감이 있던 첫 문제 화면에서만 1회/2초 (2857-21836) */}
      <CreditUsedToast />
      <QuizTopBar
        progress={isTrial ? { current: idx + 1, total: problems.length } : undefined}
        subjectLabel={
          pendingUnit
            ? `${subject === 'math' ? '수학' : '영어'} · ${pendingUnit.unitName}`
            : SUBJECT_LABEL[subject as Subject]
        }
        onClose={handleClose}
        progressRatio={isTrial ? (idx + 1) / problems.length : undefined}
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
        onUndo={() => canvasRef.current?.undo()}
        onRedo={() => canvasRef.current?.redo()}
        onClear={() => canvasRef.current?.clear()}
      />

      <div className={styles.content}>
        <main ref={mainRef} className={styles.main} style={pinch.scrollerStyle}>
          <section ref={problemCardRef} className={styles.problemCard} style={pinch.cardStyle}>
            <div className={styles.problemHeader}>
              <div className={styles.problemTitleWrap}>
                <h2 className={styles.problemTitle}>문제 {idx + 1}</h2>
              </div>
              <div className={styles.problemMeta}>
                {/* 제한시간은 표기하지 않는다 — 타이머 색 단계(경고·초과)로만 인지 */}
                <div className={styles.problemTime}>
                  권장 {formatKoreanDuration(problem.tRecSec)}
                </div>
                <TimerBadge
                  elapsedSec={elapsedSec}
                  tRecSec={problem.tRecSec}
                  tMaxSec={problem.tMaxSec}
                  variant="onLight"
                />
              </div>
            </div>

            {/* 어드민 미리보기와 100% 동일 조판 — 같은 공용 클래스(pv-body 계열, exam.css) 사용.
                ExamScaleFrame: 375px 기준 고정 조판을 폭에 비례해 확대 (줄바꿈 불변) */}
            <div ref={canvasAreaRef} className={clsx(styles.canvasArea, 'exam-paper')}>
              <ExamScaleFrame>
              <div className={clsx('pv-body', subject === 'english' && 'en')}>
                <div className={styles.bodyWrap}>
                  <ProblemBody problem={problem} />

                  {/* 보기 — 시험지처럼 읽기 전용 (선택은 하단 고정 바에서 · 주관식은 보기 없음).
                      bodyWrap 안에 두어 본문과 같은 좌우 패딩을 공유한다 */}
                  {!isShortAnswer && (
                    <div className="pv-choices">
                      {problem.choices.map((choice, i) => {
                        const answerText = choice.replace(/^[①②③④⑤]\s*/, '')
                        const ChoiceRender =
                          subject === 'english' ? EnglishProblemRender : MathProblemRender
                        return (
                          <span key={i} className="choice">
                            <span className="choice-num">
                              {i + 1}
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

              <div className={styles.canvasOverlay}>
                {/* 문제 필기 — 문제 코드별 problem.pnk 로 저장·복원 (문제가 바뀌면 새로 마운트) */}
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
        </main>
      </div>

      {/* 하단 고정 답안 바 — 객관식 1~5 / 주관식 숫자 입력 + 다음·모르겠어요 */}
      {/* 두 손가락 확대 중엔 카드의 보이는 구간 폭에 맞춘다 (usePinchZoom.fixedBarStyle) */}
      <div ref={answerBarRef} className={styles.answerBar} data-answer-bar style={pinch.fixedBarStyle}>
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
            {isLast ? (isTrial ? '채점하기' : '완료') : '다음'}
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
        <ConfirmDialog
          title="모르는 문제야?"
          onCancel={() => setSkipConfirmOpen(false)}
          onConfirm={confirmDontKnow}
        />
      )}

      {/* 나가기 팝업 (PI-POPUP-RESUME · 3631-13339) — 주 버튼은 "계속 풀기", 나가기는 왼쪽 보조.
          딤 클릭은 나가기가 아니라 팝업 닫기 */}
      {exitConfirmOpen && (
        <ConfirmDialog
          title="조금만 더 풀면 끝나!"
          desc="남은 문제까지 풀면 바로 결과를 확인할 수 있어."
          cancelLabel="나가기"
          confirmLabel="계속 풀기"
          onCancel={confirmExit}
          onConfirm={() => setExitConfirmOpen(false)}
          onDismiss={() => setExitConfirmOpen(false)}
        />
      )}
    </div>
  )
}

/** 상단 바 필기 토글 아이콘 — 해설 리뷰(TrialReviewPage)에서도 사용 */
export function PenToggleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )
}

function ProblemBody({ problem }: { problem: Problem }) {
  // 어드민 미리보기와 동일 — 배점은 스타일 없는 [N점] 그대로 발문 끝에
  const pointsBadge = <>[{problem.points}점]</>
  const hasConditions = !!problem.conditions && problem.conditions.length > 0
  const hasQuestion = !!problem.question
  const glossary = problem.glossary ?? []

  return (
    // 수능 지면 순서: 발문 [N점] → 지문(통합 question) → 단어 주석 (어드민 pv-body 와 동일 구조)
    <div className="pv-question">
      <QuestionRender
        question={problem.bodyText}
        subject={problem.subject}
        scoreBadge={!hasConditions && !hasQuestion ? pointsBadge : undefined}
      />
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
          <MathProblemRender text={problem.question!} /> {pointsBadge}
        </div>
      )}
      {glossary.length > 0 && (
        <div className="pv-glossary">
          {glossary
            .map((g, i) => `${'*'.repeat(i + 1)} ${g.term}: ${g.meaning}`)
            .join('   ')}
        </div>
      )}
    </div>
  )
}
