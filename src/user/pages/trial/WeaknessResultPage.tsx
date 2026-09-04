import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import OnboardingHeader from '@/user/components/OnboardingHeader'
import { useMe } from '@/user/hooks/useMe'
import { type Problem } from '@/user/data/mockProblems'
import { MOCK_SKILL_NODES } from '@/user/data/mockSkillNodes'
import { loadQuizProblems } from '@/user/services/problemSet'
import { flushAttemptQueue, waitForPendingAttempts } from '@/user/services/attemptQueue'
import { fetchSkillScores, type SkillScore } from '@/user/api/attemptApi'
import { findSkillScore } from '@/user/services/unitScoreSnapshot'
import { useTrialStore, type QuizItemResult, type Subject } from '@/user/stores/trialStore'
import { isTrialSubject } from '@/user/services/trialRoutes'
import { useTrialProgressStore } from '@/user/stores/trialProgressStore'
import { selectIsMember, useUserStore } from '@/user/stores/userStore'
import { isEarlybird, openEarlybirdForm } from '@/user/services/earlybird'
import { CreditCelebrationContent } from '@/user/components/CreditCelebration'
import { setDiagnoseDoneFlash, setLastSolvedFlash, setUnitReopenFlash } from '@/user/pages/home/UnitSheets'
import markStyles from './styles/WeaknessResultPage.module.scss'

/** m:ss (풀이 시간 셀) — 재열람(UnitResultPage)에서도 사용 */
export function formatShort(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** "2분 48초" (요약 카드) — 재열람(UnitResultPage)에서도 사용 */
export function formatSummary(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}

/** 1~5 → ①~⑤ (U+2460) · 무응답은 '-' */
function circled(choice: number | null): string {
  if (choice == null || choice < 1 || choice > 5) return '-'
  return String.fromCodePoint(0x2460 + choice - 1)
}

/**
 * 점수 카운트업 — 채점이 끝나면 0 → 점수로 도르륵 오른다 (easeOutCubic).
 * 서버 누적 점수가 뒤늦게 도착해 target 이 바뀌면 현재 표시값에서 이어서 굴린다.
 */
function useCountUp(target: number, delay = 300, duration = 900): number {
  const [display, setDisplay] = useState(0)
  const displayRef = useRef(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      displayRef.current = target
      setDisplay(target)
      return
    }
    const from = displayRef.current
    if (from === target) return

    let raf = 0
    let startAt: number | null = null
    const tick = (now: number) => {
      if (startAt === null) startAt = now
      const t = Math.min(1, (now - startAt) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const value = Math.round(from + (target - from) * eased)
      displayRef.current = value
      setDisplay(value)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    // 첫 굴림은 채점 마크와 타이밍을 맞추고, 이후 갱신은 즉시 이어 굴린다
    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(tick)
    }, from === 0 ? delay : 0)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [target, delay, duration])

  return display
}

/**
 * 공용 카운트업 진행률 (0 → 1, easeOutCubic).
 * 문항별 풀이 시간과 요약 풀이 시간이 같은 진행률을 곱해 쓰면
 * 값이 달라도 전부 동시에 출발해 동시에 끝난다.
 */
function useCountProgress(delay: number, duration = 900): number {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(1)
      return
    }
    let raf = 0
    let startAt: number | null = null
    const tick = (now: number) => {
      if (startAt === null) startAt = now
      const t = Math.min(1, (now - startAt) / duration)
      setProgress(1 - Math.pow(1 - t, 3))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(tick)
    }, delay)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [delay, duration])

  return progress
}

/**
 * 채점 마크 — 정답 동그라미 · 시간 초과 정답 세모 · 오답 빗금이 펜으로 긋듯 그려진다.
 * 완벽한 도형 대신 살짝 삐뚤한 손그림 베지어 + 시작점을 지나치는 오버슛.
 * delayMs 로 문항 순서대로 스태거 (선생님이 위에서부터 채점하는 느낌)
 */
type MarkKind = 'circle' | 'triangle' | 'slash'

const CIRCLE_D =
  'M 27.8 4.6 C 16.2 2.6 4.9 11.4 4.2 23.6 C 3.5 36.4 13.5 47.3 25.9 47.6 ' +
  'C 38.4 47.9 47.9 37.8 47.6 25.4 C 47.3 13.4 38.9 4.9 27.9 5.3 C 23.4 5.5 19.6 7.1 16.4 9.7'
// 꼭짓점에서 왼쪽 아래 → 밑변 → 오른쪽 위로 닫는 손그림 세모
// 세 꼭짓점 모두 곡선으로 굴려 각진 느낌 제거 (끝은 꼭짓점을 살짝 지나침)
const TRIANGLE_D =
  'M 23.6 11.8 C 19.4 18.6 12.2 30.6 7.6 38.4 C 5.8 41.4 6.8 43.5 10.2 43.8 ' +
  'C 21 44.7 31.4 44.6 41 43.8 C 44.4 43.5 45.4 41.4 43.6 38.4 ' +
  'C 39 30.6 32.2 19 27.6 12 C 26.4 9.9 24.4 9.9 23.4 11.7 C 22.5 13.3 21.6 14.9 20.7 16.5'
const SLASH_D = 'M 42.8 7.4 C 35.6 16.2 21.8 30.8 8.4 43.6'

const MARK_PATH: Record<MarkKind, string> = {
  circle: CIRCLE_D,
  triangle: TRIANGLE_D,
  slash: SLASH_D,
}
const MARK_LABEL: Record<MarkKind, string> = {
  circle: '정답',
  triangle: '정답 · 권장 시간 초과',
  slash: '오답',
}

/** 채점 마크 컴포넌트 — 재열람(UnitResultPage)에서도 사용 */
export function GradeMark({ kind, delayMs }: { kind: MarkKind; delayMs: number }) {
  const style = { '--delay': `${delayMs}ms` } as React.CSSProperties
  return (
    <svg
      viewBox="0 0 51 51"
      className={markStyles.mark}
      style={style}
      role="img"
      aria-label={MARK_LABEL[kind]}
    >
      <path
        d={MARK_PATH[kind]}
        pathLength={100}
        className={clsx(markStyles.stroke, kind === 'slash' && markStyles.strokeFast)}
      />
    </svg>
  )
}

interface Row {
  result: QuizItemResult
  problem: Problem | undefined
  subject: 'math' | 'english'
  /** 해설 리뷰 라우팅용 — 과목 내 문제 인덱스 */
  reviewIdx: number
}

/**
 * 학습 결과 — 일반 (Figma 2641-10993 · 단원 평가/자유 문제 채점 결과)
 * 헤더의 점수·약점은 서버 누적 단원 점수(skill-scores) — 세션 결과는 폴백.
 * 오답 재풀이(RETRY) 결과 화면은 점수 없이 별도 변형 예정 (2661-4588).
 */
export default function WeaknessResultPage() {
  const navigate = useNavigate()
  // 과목은 경로(/trial/{subject}/weakness)가 진실원 — 없거나 이상하면 마지막 진단 과목으로 폴백 (2026-09-04)
  const { subject: routeSubject } = useParams<{ subject: string }>()
  // 세션 로드 — 이 페이지는 익명 퍼널에서도 열리지만, 로그인 유저의 "진단 완료"가
  // 회원 판정(isMember) 없이 /signup 으로 새던 버그 방지 (조회 전용, 게스트 생성 없음)
  useMe()
  const isMember = useUserStore(selectIsMember)
  const {
    mathSkillNodeId,
    englishTypeId,
    mathResults,
    englishResults,
    lastSubject,
    hasCompletedSession,
  } = useTrialStore()

  const subject: Subject = isTrialSubject(routeSubject) ? routeSubject : (lastSubject ?? 'math')

  // persist rehydrate 전에 판정하면 정상 완주자도 튕긴다
  const hydrated = useTrialStore.persist?.hasHydrated?.() ?? true

  // 채점하기 → 결과 직행 플로우 — 진행 중 제출(마지막 문항)이 서버에 닿고, 전송 실패분 회수까지 끝난 뒤에
  // 누적 점수를 조회한다. 그 전에 조회하면 분모에서 마지막 문항이 빠져 점수가 틀린다 (2026-09-04)
  const [attemptsSettled, setAttemptsSettled] = useState(false)
  useEffect(() => {
    let alive = true
    ;(async () => {
      await waitForPendingAttempts()
      await flushAttemptQueue().catch(() => {})
      if (alive) setAttemptsSettled(true)
    })()
    return () => {
      alive = false
    }
  }, [])

  // 모바일 상단(시계·배터리 상태바 영역)을 페이지 그라데이션 톤으로.
  // iOS 는 이 영역을 theme-color 가 아니라 html 배경색으로 칠한다 — 랜딩(검정)과 동일 패턴.
  // 안드로이드 크롬은 theme-color 를 쓰므로 둘 다 지정, 떠날 때 원복
  useEffect(() => {
    // body 가 전역 흰 배경(bg-canvas)을 갖고 있어 html 만 칠하면 iOS 가 흰색을 샘플링한다
    document.documentElement.style.background = '#fff1f2'
    document.body.style.background = '#fff1f2'
    const meta = document.querySelector('meta[name="theme-color"]')
    const prev = meta?.getAttribute('content') ?? null
    meta?.setAttribute('content', '#fff1f2')
    return () => {
      document.documentElement.style.background = ''
      document.body.style.background = ''
      if (prev) meta?.setAttribute('content', prev)
    }
  }, [])

  /**
   * 이 화면은 "방금 끝낸 세트"의 결과 전용 (2026-08-27) — 지난 결과 재열람은
   * /unit-result 가 담당한다. 세트 완료 시 발급한 1회용 열람권(resultPass)이
   * 없으면 되돌린다. 주소창에 /trial/math/weakness 를 직접 쳐서 sessionStorage 에 남은
   * 지난 세트 결과가 계속 열리던 문제를 막는다.
   * 열람권은 새로고침·해설 왕복·소셜 로그인 왕복에는 유지되고, 결과를 다 보고
   * 홈으로 나갈 때 소비된다.
   */
  const resultPass = useTrialStore((s) => s.resultPass)
  useEffect(() => {
    if (!hydrated) return
    if (routeSubject !== undefined && !isTrialSubject(routeSubject)) {
      navigate('/trial', { replace: true }) // 과목 자리에 엉뚱한 값 — 퍼널 시작으로
      return
    }
    if (!hasCompletedSession()) {
      navigate('/trial', { replace: true })
      return
    }
    // 회원을 /trial 로 보내면 온보딩 퍼널로 새므로 홈으로 되돌린다
    if (!resultPass) navigate(isMember ? '/home' : '/trial', { replace: true })
  }, [hydrated, routeSubject, hasCompletedSession, resultPass, isMember, navigate])

  /**
   * 결과 화면에서 나간다 — 열람권을 소비하고 이동.
   * 가입(/signup)만 예외로 남겨둔다 — 소셜 로그인이 외부 도메인을 왕복한 뒤
   * postLoginRedirect 로 이 화면에 다시 돌아오기 때문이다.
   */
  const leaveResult = (to: string) => {
    if (to !== '/signup') useTrialStore.getState().consumeResultPass()
    // 소단원 시트에서 시작한 진단(pendingUnit)이면 복귀한 홈·지도에 완료 토스트 예약 (3575-7884)
    if (to !== '/signup' && pendingNameRef.current) {
      setDiagnoseDoneFlash(pendingNameRef.current, subject)
      setLastSolvedFlash(pendingNameRef.current, subject) // 홈 복귀 시 이 단원 탭·카드로 초점
      // 약점 지도에서 시작한 진단이면 돌아가서 그 단원을 선택(active) + 상세 시트 오픈 — 자유 풀이(SolveResultPage)와 같은 규칙
      if (to.startsWith('/weakness-map')) setUnitReopenFlash(pendingNameRef.current, subject)
    }
    navigate(to)
  }

  // 풀이 화면과 같은 세트를 봐야 결과 매칭이 맞는다 — problemSet 캐시 공유 (보통 즉시 resolve)
  const [mathProblems, setMathProblems] = useState<Problem[]>([])
  const [englishProblems, setEnglishProblems] = useState<Problem[]>([])
  useEffect(() => {
    if (!mathSkillNodeId) return
    let alive = true
    loadQuizProblems('math', mathSkillNodeId).then((list) => alive && setMathProblems(list))
    return () => {
      alive = false
    }
  }, [mathSkillNodeId])
  useEffect(() => {
    if (!englishTypeId) return
    let alive = true
    loadQuizProblems('english', englishTypeId).then((list) => alive && setEnglishProblems(list))
    return () => {
      alive = false
    }
  }, [englishTypeId])

  const rows: Row[] = useMemo(
    () => [
      ...mathResults.map((result) => ({
        result,
        problem: mathProblems.find((p) => p.id === result.problemId),
        subject: 'math' as const,
        reviewIdx: mathProblems.findIndex((p) => p.id === result.problemId),
      })),
      ...englishResults.map((result) => ({
        result,
        problem: englishProblems.find((p) => p.id === result.problemId),
        subject: 'english' as const,
        reviewIdx: englishProblems.findIndex((p) => p.id === result.problemId),
      })),
    ],
    [mathResults, englishResults, mathProblems, englishProblems],
  )

  /** 이번에 푼 단원 표기명 */
  const unitName =
    subject === 'english'
      ? '주제' // 맛보기 고정 영역 (en-topic)
      : MOCK_SKILL_NODES.find((n) => n.id === mathSkillNodeId)?.name ?? '수학'

  // 누적 단원 점수 (서버) — 맞춘 배점/푼 배점 ×100 · RETRY 제외 (2026-08-10 정책)
  const [skillScore, setSkillScore] = useState<SkillScore | null>(null)
  useEffect(() => {
    if (!attemptsSettled) return
    let alive = true
    fetchSkillScores(subject)
      .then((list) => {
        if (!alive) return
        // unitCode 우선 매칭 — 이름 정규화만으로는 "지수·로그함수" 가 서버 "지수함수와 로그함수" 를 못 찾는다
        setSkillScore(findSkillScore(list, unitName))
      })
      .catch(() => {}) // 실패 시 세션 결과 폴백
    return () => {
      alive = false
    }
  }, [attemptsSettled, subject, unitName])

  // 세션 결과 기반 폴백 점수 — 서버와 같은 공식(획득 배점 합 / 푼 배점 합).
  // 획득 배점은 문항별 결과 표와 같은 시간 가중값(earnedPoints · 제안시간 초과 60%·제한시간 초과 0)
  const local = useMemo(() => {
    const total = rows.reduce((s, r) => s + (r.problem?.points ?? 0), 0)
    const earned = rows.reduce(
      (s, r) => s + ((r.result.serverCorrect ?? r.result.correct) ? r.result.earnedPoints : 0),
      0,
    )
    return total === 0 ? 0 : Math.round((earned * 100) / total)
  }, [rows])

  const score = skillScore?.score ?? local
  const weak = skillScore?.weak ?? score < 70
  // 연출은 전부 동시 시작 (순차 시퀀스 제거 — 2026-08-26)
  const START_MS = 150
  const displayScore = useCountUp(score, START_MS)

  // 약점 계산 기준 안내 ⓘ 토글
  const [infoOpen, setInfoOpen] = useState(false)

  // 얼리버드 테스트 — "진단 완료"가 가입 유도 대신 사전예약 팝업을 연다
  const [reserveOpen, setReserveOpen] = useState(false)

  // 첫 진단 완료 보상(+5크레딧) 축하 — "진단 완료" 버튼을 눌렀을 때 1회만 끼어든다.
  // 실제 지급은 서버가 진단 박제 트랜잭션에서 처리(멱등) — 여기는 안내 UI 만 담당.
  const diagnosedCount = useTrialProgressStore((s) => Object.keys(s.diagnosed).length)
  const [creditOpen, setCreditOpen] = useState(false)
  // 판정 근거 (2026-08-26 재설계 — localStorage 플래그 제거):
  // - 회원: 제출 응답의 grantedReward(TRIAL_FIRST_CLEAR)가 켠 firstRewardGranted. 서버 원장이 진실원.
  // - 익명(가입 전): 유저 로우가 없어 지급 자체가 불가하므로 로컬 진단 1건 = 첫 진단으로 판정.
  // - firstCreditCelebrated 는 같은 세션 재방문 시 재노출 방지 (sessionStorage — 탭 닫으면 소멸).
  const firstRewardGranted = useTrialStore((s) => s.firstRewardGranted)
  const firstCreditCelebrated = useTrialStore((s) => s.firstCreditCelebrated)
  const shouldCelebrateFirstCredit = (): boolean => {
    if (isEarlybird()) return false // 얼리버드는 가입·크레딧 흐름이 없다
    if (firstCreditCelebrated) return false
    if (firstRewardGranted) return true
    return !isMember && diagnosedCount === 1
  }
  // 시트의 "확인" — 노출 완료를 기록하고 원래 가려던 곳(홈/가입)으로 이어간다
  const confirmCreditSheet = () => {
    useTrialStore.getState().markFirstCreditCelebrated()
    setCreditOpen(false)
    leaveResult(returnToRef.current ?? (isMember ? '/home' : '/signup'))
  }

  const pendingUnit = useTrialProgressStore((s) => s.pendingUnit)
  /**
   * 약점 도장은 "이 단원을 처음 진단한" 결과에만 (2026-09-04).
   * - 온보딩 퍼널(pendingUnit 없음): 항상 첫 진단
   * - 홈·지도에서 시작한 진단: finishPendingUnit 이 diagnosed 에 쓰기 전, 이 단원이 이미 diagnosed 에 있었는지로 판정
   *   (재진단·이미 진단한 단원을 다시 푼 경우는 도장 없이 점수만). 확정 뒤엔 diagnosed 에 들어가므로 첫 렌더에 ref 로 고정
   */
  const alreadyDiagnosed = useTrialProgressStore((s) =>
    pendingUnit ? !!s.diagnosed[pendingUnit.unitName] : false,
  )
  const firstDiagnosisRef = useRef<boolean | null>(null)
  if (firstDiagnosisRef.current === null && hydrated) {
    firstDiagnosisRef.current = !pendingUnit || !alreadyDiagnosed
  }
  const firstDiagnosis = firstDiagnosisRef.current ?? true

  // 약점 도장 — 다른 연출과 같이 바로 찍힌다. 첫 진단이 아니면(재진단·다시 풀기) 찍지 않는다
  const [stamped, setStamped] = useState(false)
  useEffect(() => {
    if (!weak || !firstDiagnosis) {
      setStamped(false)
      return
    }
    const timer = window.setTimeout(() => setStamped(true), START_MS)
    return () => clearTimeout(timer)
  }, [weak, firstDiagnosis])

  const correctCount = rows.filter(({ result }) => result.serverCorrect ?? result.correct).length
  const totalSec = Math.round(rows.reduce((s, { result }) => s + result.elapsedMs, 0) / 1000)

  // ── 진단 진행 확정 ──────────────────────────────────────────────────────────
  // 진행 페이지에서 시작한 세트라면 여기서 그 유닛을 "진단 완료" 로 굳히고 오늘 몫을 소진한다.
  // 점수는 서버 누적 점수(skillScore)를 우선 쓰되, 첫 진단이면 세션 점수와 같은 값이라 폴백해도 무방.
  const finishPendingUnit = useTrialProgressStore((s) => s.finishPendingUnit)
  // pendingUnit 은 확정 직후 null 이 되므로, 돌아갈 경로·단원명은 미리 잡아둔다
  const returnToRef = useRef<string | null>(null)
  const pendingNameRef = useRef<string | null>(null)
  if (pendingUnit && !returnToRef.current) returnToRef.current = pendingUnit.returnTo
  if (pendingUnit && !pendingNameRef.current) pendingNameRef.current = pendingUnit.unitName


  // 재열람용 문항별 결과 — 목 문제 데이터 없이도 표를 다시 그릴 수 있게 표시값을 박제
  const diagnosisItems = useMemo(
    () =>
      rows.map(({ result, problem }) => {
        const elapsedSec = Math.round(result.elapsedMs / 1000)
        const recSec = problem?.tRecSec ?? 0
        const isCorrect = result.serverCorrect ?? result.correct
        const shortAnswer = problem?.choices.length === 0
        // 서버 세트 문항은 로컬 정답이 없어(answer=0) 제출 응답의 정답 번호를 우선 사용
        const answerNo =
          result.serverAnswerNo ?? (problem && problem.answer !== 0 ? problem.answer : null)
        return {
          correct: isCorrect,
          overTime: recSec > 0 && elapsedSec > recSec,
          seconds: elapsedSec,
          earned: isCorrect ? result.earnedPoints : 0,
          points: problem?.points ?? 0,
          short: shortAnswer,
          myAnswer: shortAnswer
            ? String(result.selectedChoice ?? '-')
            : circled(result.selectedChoice),
          correctAnswer:
            answerNo == null ? '-' : shortAnswer ? String(answerNo) : circled(answerNo),
          recSec,
        }
      }),
    [rows],
  )

  useEffect(() => {
    if (!hydrated || rows.length === 0) return
    // 문제 세트가 아직 로드 전이면 로컬 점수·문항별 결과가 비어 확정하지 않는다
    if (rows.some((r) => !r.problem)) return
    finishPendingUnit({
      score,
      weak,
      minutes: Math.max(1, Math.round(totalSec / 60)),
      correct: correctCount,
      items: diagnosisItems,
    })
  }, [hydrated, rows.length, score, weak, totalSec, correctCount, diagnosisItems, finishPendingUnit])

  // 풀이 시간 — 요약 카드와 문항별 셀이 같은 진행률로 동시에 차오른다
  const countProgress = useCountProgress(START_MS)
  const displayTotalSec = Math.round(totalSec * countProgress)

  // 문항별 획득 점수 — 상단 점수와 함께 굴린다
  const scoreProgress = useCountProgress(START_MS)

  // 정답 수 — 채점 마크에서 동그라미가 쳐지는 순간마다 +1
  const [displayCorrect, setDisplayCorrect] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayCorrect(correctCount)
      return
    }
    setDisplayCorrect(0)
    const timers: number[] = []
    let counted = 0
    rows.forEach(({ result }, i) => {
      if (!(result.serverCorrect ?? result.correct)) return
      counted += 1
      const next = counted
      // 원이 거의 다 그려지는 시점(시작 + 450ms)에 카운트 — 마크는 전부 동시에 그려진다
      timers.push(window.setTimeout(() => setDisplayCorrect(next), 150 + 450 + i * 40))
    })
    return () => timers.forEach(clearTimeout)
  }, [rows, correctCount])

  return (
    // 결과 화면 배경 — 상단 붉은 기운(#fff1f2)에서 흰색으로 (Figma 2824-5560)
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-[#fff1f2] to-white">
      {/* 헤더는 상단 여백만 — 닫기 X 없음. 나가는 길은 하단 CTA(leaveResult) 하나로 (2026-09-04) */}
      <OnboardingHeader />

      <main
        className={clsx('flex w-full flex-1 flex-col items-center', stamped && markStyles.shake)}
      >
        {/* 점수 요약 카드 */}
        <div className="flex w-full justify-center px-[40px] py-[20px] max-md:px-lg">
          <div className="relative flex w-full max-w-[620px] flex-col items-center overflow-hidden rounded-[16px] border border-[#f8f8f8] bg-white pt-[20px] shadow-[0px_4px_20px_0px_rgba(113,20,39,0.08)]">
            {/* 약점 계산 기준 안내 ⓘ */}
            <button
              type="button"
              aria-label="약점 계산 기준 보기"
              aria-expanded={infoOpen}
              onClick={() => setInfoOpen((v) => !v)}
              className="absolute right-[20px] top-[20px] flex size-[20px] items-center justify-center rounded-full bg-[#d6d8db] text-[12px] font-semibold text-[#5e6368]"
            >
              i
            </button>

            {/* 약점 도장 — 점수 카운트업 후 카드 좌측에 인주 도장처럼 쿵 찍힌다 (흔들림 유지) */}
            {weak && stamped && (
              <span className="pointer-events-none absolute left-[16px] top-[14px] z-10 mix-blend-multiply md:left-[28px]">
                <span className={clsx('block', markStyles.stamp)}>
                  <WeakStampSeal />
                </span>
              </span>
            )}

            <div className="flex flex-col items-center gap-[8px] px-[20px] pt-[8px]">
              <h1 className="max-w-full truncate text-[22px] font-semibold leading-[1.4] text-[#121417]">
                {unitName}
              </h1>
              <p className="text-[#121417]">
                <span className="text-[32px] font-bold tabular-nums leading-none">
                  {displayScore}
                </span>
                <span className="text-[22px] font-semibold leading-[1.4]">점</span>
              </p>
            </div>

            {/* 정답 수 · 풀이 시간 */}
            <div className="mt-[16px] flex w-full items-center border-t border-[#e5e7ea] bg-[#f8f8f8] p-[16px]">
              <div className="flex flex-1 flex-col items-center gap-[8px]">
                <p className="text-[12px] font-semibold leading-[1.4] text-[#80858b]">정답 수</p>
                <p className="text-[20px] font-semibold tabular-nums leading-[1.4] text-[#121417]">
                  {displayCorrect}/{rows.length}개
                </p>
              </div>
              <div className="h-[32px] w-px shrink-0 bg-[#e5e7ea]" />
              <div className="flex flex-1 flex-col items-center gap-[8px]">
                <p className="text-[12px] font-semibold leading-[1.4] text-[#80858b]">풀이 시간</p>
                <p className="text-[20px] font-semibold tabular-nums leading-[1.4] text-[#121417]">
                  {formatSummary(displayTotalSec)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 문항별 결과 — 흰 배경 섹션이 그라데이션을 끊고 하단을 채운다 */}
        <section className="flex w-full flex-1 flex-col items-center gap-[16px] bg-white p-[20px] pb-[120px] max-md:px-lg">
          <h2 className="w-full max-w-[620px] text-[18px] font-bold leading-[1.4] text-[#23272b]">
            문항별 결과
          </h2>

          <div className="flex w-full max-w-[620px] flex-col overflow-hidden rounded-[12px] border border-[#e5e7ea]">
            {/* 헤더 행 — 문항·결과는 고정 폭, 나머지 균등 (Figma 2661-4619) */}
            <div className="flex w-full items-center gap-[8px] border-b border-[#e5e7ea] bg-[#f8f8f8] px-[12px] py-[16px]">
              <p className="w-[52px] shrink-0 text-center text-[12px] font-semibold text-[#80858b]">
                문항
              </p>
              <p className="min-w-0 flex-1 text-center text-[12px] font-semibold text-[#80858b]">
                답안
              </p>
              <p className="min-w-0 flex-1 text-center text-[12px] font-semibold text-[#80858b]">
                풀이 시간
              </p>
              <p className="min-w-0 flex-1 text-center text-[12px] font-semibold text-[#80858b]">
                획득 점수
              </p>
              <p className="w-[53px] shrink-0 text-center text-[12px] font-semibold text-[#80858b]">
                결과
              </p>
            </div>

            {rows.map(({ result, problem, subject: rowSubject, reviewIdx }, i) => {
              const elapsedSec = Math.round(result.elapsedMs / 1000)
              const recSec = problem?.tRecSec ?? 0
              const overTime = recSec > 0 && elapsedSec > recSec
              const isCorrect = result.serverCorrect ?? result.correct
              const basePoints = problem?.points ?? 0
              const earned = isCorrect ? result.earnedPoints : 0
              const shortAnswer = problem?.choices.length === 0
              const myAnswer = shortAnswer
                ? result.selectedChoice ?? '-'
                : circled(result.selectedChoice)
              // 서버 세트 문항은 로컬 정답이 없어(answer=0) 제출 응답의 정답 번호를 우선 사용
              const answerNo =
                result.serverAnswerNo ??
                (problem && problem.answer !== 0 ? problem.answer : null)
              const correctAnswer =
                answerNo == null ? '-' : shortAnswer ? String(answerNo) : circled(answerNo)

              return (
                <div
                  key={`${result.problemId}-${i}`}
                  className={clsx(
                    'flex w-full items-center gap-[8px] bg-white p-[12px]',
                    i < rows.length - 1 && 'border-b border-[#e5e7ea]',
                  )}
                >
                  {/* 문항 번호 + 채점 마크 */}
                  <div className="relative flex size-[52px] shrink-0 items-center justify-center">
                    <p className="whitespace-nowrap text-[16px] font-bold text-[#121417]">
                      {i + 1}번
                    </p>
                    <GradeMark
                      kind={isCorrect ? (overTime ? 'triangle' : 'circle') : 'slash'}
                      delayMs={START_MS}
                    />
                  </div>

                  {/* 답안 — 틀리면 두 줄 모두 빨강 (Figma 2662-5230) */}
                  <div
                    className={clsx(
                      'flex min-w-0 flex-1 flex-col items-center justify-center font-semibold leading-[1.4]',
                      isCorrect ? 'text-[#121417]' : 'text-primary',
                    )}
                  >
                    <p className="whitespace-nowrap text-[14px]">
                      내 답{' '}
                      {/* 원기호는 글리프가 작게 그려져서 18px 로 보정 */}
                      {shortAnswer ? (
                        myAnswer
                      ) : (
                        <span className="text-[18px] leading-none">{myAnswer}</span>
                      )}
                    </p>
                    <p
                      className={clsx(
                        'whitespace-nowrap text-[12px]',
                        isCorrect && 'text-[#a6abb1]',
                      )}
                    >
                      정답{' '}
                      {shortAnswer ? (
                        correctAnswer
                      ) : (
                        <span className="text-[15px] leading-none">{correctAnswer}</span>
                      )}
                    </p>
                  </div>

                  {/* 풀이 시간 — 권장 초과면 두 줄 모두 빨강 */}
                  <div
                    className={clsx(
                      'flex min-w-0 flex-1 flex-col items-center justify-center font-semibold leading-[1.4] tabular-nums',
                      overTime ? 'text-primary' : 'text-[#121417]',
                    )}
                  >
                    <p className="whitespace-nowrap text-[14px]">
                      {/* 요약 카드와 같은 진행률 — 모든 시간이 동시에 차오른다 */}
                      {formatShort(Math.round(elapsedSec * countProgress))}
                    </p>
                    <p
                      className={clsx(
                        'whitespace-nowrap text-[12px]',
                        !overTime && 'text-[#a6abb1]',
                      )}
                    >
                      권장 {recSec > 0 ? formatShort(recSec) : '-'}
                    </p>
                  </div>

                  {/* 획득 점수 — 항상 검정 + 배점 보조줄 */}
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center font-semibold leading-[1.4] tabular-nums">
                    <p className="whitespace-nowrap text-[14px] text-[#121417]">
                      {(() => {
                        // 풀이 시간이 끝난 뒤 상단 점수와 같은 진행률로 차오른다
                        const shown = Math.round(earned * scoreProgress * 10) / 10
                        return Number.isInteger(shown) ? shown : shown.toFixed(1)
                      })()}
                      점
                    </p>
                    <p className="whitespace-nowrap text-[12px] text-[#a6abb1]">
                      배점 {basePoints}점
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center justify-center">
                    {problem && reviewIdx >= 0 ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/trial/review/${rowSubject}/${reviewIdx}`)}
                        className="whitespace-nowrap rounded-[10px] bg-[#f0f1f3] px-[12px] py-[8px] text-[12px] font-semibold leading-[1.4] text-[#5e6368] transition-colors hover:bg-[#e5e7ea]"
                      >
                        해설
                      </button>
                    ) : (
                      <span className="w-[53px] text-center text-[13px] text-[#a6abb1]">-</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 flex min-w-[350px] justify-center bg-white px-[40px] pb-[calc(24px+env(safe-area-inset-bottom))] pt-[12px] max-md:px-lg">
        <button
          type="button"
          // 얼리버드 테스트 모드 — 가입 유도 대신 사전예약 팝업.
          // 첫 진단이면 보상 시트가 먼저 끼어들고, 그 외에는 잠금 해제 진행 중이던
          // 세트면 진행 페이지로 복귀
          onClick={() => {
            if (isEarlybird()) return setReserveOpen(true)
            if (shouldCelebrateFirstCredit()) return setCreditOpen(true)
            leaveResult(returnToRef.current ?? (isMember ? '/home' : '/signup'))
          }}
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center rounded-[12px] bg-[#23272b] px-xl text-[16px] font-bold text-white transition-opacity hover:opacity-90 active:opacity-85"
        >
          진단 완료
        </button>
      </footer>

      {reserveOpen && <EarlybirdReserveModal onClose={() => setReserveOpen(false)} />}
      {creditOpen && <FirstCreditSheet onClose={confirmCreditSheet} />}
      {infoOpen && <ScoreInfoSheet onClose={() => setInfoOpen(false)} />}
    </div>
  )
}

/**
 * 약점 인주 도장 — 이중 링 + 원호 텍스트 + 가운데 "약점" (러버 스탬프 룩).
 * 착지 회전(-6deg)은 markStyles.stamp 키프레임이 담당한다.
 */
function WeakStampSeal() {
  return (
    <svg viewBox="0 0 100 100" width="88" height="88" aria-label="약점" role="img">
      <defs>
        {/* 원호 텍스트 경로 — 위쪽 반원(왼→오) · 아래쪽 반원(왼→오, 글자가 뒤집히지 않게 역방향).
            글자는 경로(베이스라인)에서 바깥쪽(위)으로 자란다 — 위 글자는 위로, 아래 글자는 중심 쪽으로 뻗는다.
            같은 반지름을 쓰면 PULLIT 은 바깥 링에 붙고 WEAK POINT 는 중심에 붙어 어긋나 보여, 위는 안쪽(31)·
            아래는 바깥쪽(37.5) 반지름으로 두어 두 글자 띠가 같은 고리(약 31~37.5)에 놓이게 한다 (2026-09-04) */}
        <path id="stamp-arc-top" d="M 50 50 m -31 0 a 31 31 0 1 1 62 0" fill="none" />
        <path id="stamp-arc-bottom" d="M 50 50 m -37.5 0 a 37.5 37.5 0 1 0 75 0" fill="none" />
      </defs>
      <g fill="none" stroke="#ff385c" opacity="0.92">
        <circle cx="50" cy="50" r="46.5" strokeWidth="5" />
        <circle cx="50" cy="50" r="40" strokeWidth="1.6" />
      </g>
      <g fill="#ff385c" opacity="0.92" fontWeight="700" letterSpacing="2.5" fontSize="8.5">
        <text textAnchor="middle">
          <textPath href="#stamp-arc-top" startOffset="50%">PULLIT</textPath>
        </text>
        <text textAnchor="middle">
          <textPath href="#stamp-arc-bottom" startOffset="50%">WEAK POINT</textPath>
        </text>
        {/* 좌우 구분점 — 글자 띠 가운데 반지름(약 34.5)에 */}
        <circle cx="15.5" cy="50" r="1.6" />
        <circle cx="84.5" cy="50" r="1.6" />
      </g>
      <text
        x="50"
        y="59"
        textAnchor="middle"
        fontSize="24"
        fontWeight="800"
        fill="#ff385c"
        opacity="0.94"
      >
        약점
      </text>
    </svg>
  )
}

/**
 * 진단 결과 계산 안내 (Figma 2886-29391 · PI-POPUP-RESULT_01).
 * ⓘ 버튼 → 모바일 바텀시트 · 패드/웹 중앙 다이얼로그.
 */
function ScoreInfoSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="score-info-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-[20px] max-md:items-end max-md:p-0"
    >
      <style>{`
        @keyframes pi-info-fade { from { opacity: 0 } }
        @keyframes pi-info-pop { from { opacity: 0; transform: scale(0.94) translateY(10px) } }
        @keyframes pi-info-rise { from { transform: translateY(100%) } }
      `}</style>
      {/* 배경 딤 — 탭하면 닫힘 */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 animate-[pi-info-fade_200ms_ease] bg-[rgba(21,17,18,0.38)]"
      />

      <div className="relative w-full max-w-[480px] animate-[pi-info-pop_260ms_cubic-bezier(0.22,0.9,0.3,1)] rounded-[24px] bg-white p-[20px] shadow-[0px_-16px_25px_rgba(0,0,0,0.12)] max-md:max-w-none max-md:animate-[pi-info-rise_300ms_cubic-bezier(0.22,0.9,0.3,1)] max-md:rounded-b-none max-md:rounded-t-[32px] max-md:pb-[calc(20px+env(safe-area-inset-bottom))]">
        {/* 핸들 바 — 모바일만 */}
        <div className="mb-[16px] hidden justify-center max-md:flex">
          <span className="h-[5px] w-[42px] rounded-full bg-[#d6d8db]" />
        </div>

        <h2 id="score-info-title" className="text-[20px] font-semibold leading-[1.4] text-[#121417]">
          진단 결과
        </h2>

        <p className="mt-[8px] text-[14px] font-medium leading-[1.4] text-[#5e6368]">
          문제마다 배점과 풀이 시간을 함께 반영해서 점수를 계산해,
          <br />- 권장 시간 안에 맞히면 배점 100%
          <br />- 권장 시간을 넘겨서 맞히면 60%
          <br />- 권장 시간의 3배를 넘기면 0점이야
        </p>

        {/* 총 점수 공식 — 분수 표기 */}
        <div className="mt-[24px] flex items-center justify-center rounded-[8px] bg-[#f8f8f8] p-[20px]">
          <div className="flex items-center gap-[6px] text-[14px] font-bold text-[#5e6368]">
            <span>총 점수 =</span>
            <span className="flex flex-col items-center gap-[2px] px-[4px] leading-[1.4]">
              <span>획득 점수</span>
              <span className="h-[1.5px] w-full bg-[#5e6368]" />
              <span>총 배점</span>
            </span>
            <span>× 100</span>
          </div>
        </div>

        <p className="mt-[24px] text-[14px] font-medium leading-[1.4] text-[#5e6368]">
          단원 점수는 이번에 푼 문제만 보는 게 아니라
          <br />
          지금까지 이 단원에서 푼 모든 문제를 합쳐서 계산해, 3문제 이상 푼 뒤 단원 점수가 70점
          이하면 약점이야
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-[20px] flex h-[56px] w-full items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90 active:opacity-85"
        >
          확인
        </button>
      </div>
    </div>
  )
}

/**
 * 첫 진단 완료 보상 시트 (Figma 2824-5720 · PI-SHEET-FIRST_CREDIT).
 * 웹(1281+)은 중앙 팝업, 패드·폰은 바텀시트로 뜬다.
 * 지급 자체는 서버(진단 박제 트랜잭션 +5, 멱등) — 이 컴포넌트는 축하 안내만.
 * 카드 안 콘텐츠(코인·콘페티·텍스트)는 가입 완료 뷰와 공용(CreditCelebrationContent).
 */
function FirstCreditSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-credit-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-[20px] max-xl:items-end max-xl:p-0"
    >
      <div className="absolute inset-0 animate-[fc-fade_200ms_ease] bg-black/45" aria-hidden />
      <div className="relative flex w-full max-w-[400px] animate-[fc-card_560ms_cubic-bezier(0.22,0.9,0.3,1)_both] flex-col items-center gap-[16px] rounded-[24px] bg-white px-[20px] py-[34px] max-xl:max-w-none max-xl:animate-[fc-rise_340ms_cubic-bezier(0.22,0.9,0.3,1)] max-xl:rounded-b-none max-xl:rounded-t-[32px] max-xl:pb-[calc(34px+env(safe-area-inset-bottom))]">
        <CreditCelebrationContent
          title="첫 진단 완료 선물 도착!"
          titleId="first-credit-title"
          onConfirm={onClose}
        />
      </div>
    </div>
  )
}

/**
 * 오픈 전 사전신청 팝업 (얼리버드 테스트 전용).
 * 신청 정보는 구글폼으로 받는다 — 버튼이 폼을 새 탭으로 연다.
 */
function EarlybirdReserveModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="earlybird-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-[20px] max-md:items-end max-md:p-0"
    >
      <style>{`
        @keyframes eb-fade { from { opacity: 0 } }
        @keyframes eb-pop { from { opacity: 0; transform: scale(0.94) translateY(10px) } }
        @keyframes eb-rise { from { transform: translateY(100%) } }
      `}</style>
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 animate-[eb-fade_200ms_ease] bg-black/45"
      />
      <div className="relative w-full max-w-[400px] animate-[eb-pop_260ms_cubic-bezier(0.22,0.9,0.3,1)] rounded-[20px] bg-white px-[24px] pb-[20px] pt-[28px] max-md:max-w-none max-md:animate-[eb-rise_300ms_cubic-bezier(0.22,0.9,0.3,1)] max-md:rounded-b-none max-md:rounded-t-[24px] max-md:pb-[calc(20px+env(safe-area-inset-bottom))]">
        <h2 id="earlybird-title" className="break-keep text-center text-[20px] font-bold text-[#121417]">
          풀잇은 곧 오픈 예정이야
        </h2>
        <p className="mt-[10px] break-keep text-center text-[15px] leading-[1.6] text-[#6f686a]">
          사전 예약하면 약점 문제를 더 많이 풀 수 있게
          <br />
          <b className="font-semibold text-[#ff385c]">크레딧을 줄게</b>
        </p>

        <div className="mt-[20px] flex flex-col gap-[8px]">
          <button
            type="button"
            onClick={openEarlybirdForm}
            className="h-[54px] w-full rounded-[12px] bg-[#ff385c] text-[16px] font-bold text-white transition-colors hover:bg-[#e6203f]"
          >
            사전 신청하기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-[46px] w-full rounded-[12px] text-[15px] font-medium text-[#80858b] transition-colors hover:bg-[#f7f8f9]"
          >
            다음에 할게
          </button>
        </div>
      </div>
    </div>
  )
}
