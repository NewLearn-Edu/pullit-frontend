import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import OnboardingHeader from '@/user/components/OnboardingHeader'
import { type Problem } from '@/user/data/mockProblems'
import { MOCK_SKILL_NODES } from '@/user/data/mockSkillNodes'
import { loadQuizProblems } from '@/user/services/problemSet'
import { flushAttemptQueue } from '@/user/services/attemptQueue'
import { fetchSkillScores, type SkillScore } from '@/user/api/attemptApi'
import { useTrialStore, type QuizItemResult } from '@/user/stores/trialStore'
import { useTrialProgressStore } from '@/user/stores/trialProgressStore'
import { selectIsMember, useUserStore } from '@/user/stores/userStore'
import { isEarlybird, openEarlybirdForm } from '@/user/services/earlybird'
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

/** 서버 skill_node("지수와 로그") ↔ 표기명("지수·로그") 느슨 매칭 */
const normalize = (s: string) => s.replace(/[·\s]/g, '').replace(/와|과/g, '')

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
  const isMember = useUserStore(selectIsMember)
  const {
    mathSkillNodeId,
    englishTypeId,
    mathResults,
    englishResults,
    lastSubject,
    hasCompletedSession,
  } = useTrialStore()

  // persist rehydrate 전에 판정하면 정상 완주자도 튕긴다
  const hydrated = useTrialStore.persist?.hasHydrated?.() ?? true

  // 채점하기 → 결과 직행 플로우 — 전송 실패분 회수를 여기서 수행
  useEffect(() => {
    flushAttemptQueue()
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!hasCompletedSession()) {
      navigate('/trial', { replace: true })
    }
  }, [hydrated, hasCompletedSession, navigate])

  const subject = lastSubject ?? 'math'

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
    let alive = true
    fetchSkillScores(subject)
      .then((list) => {
        if (!alive) return
        setSkillScore(
          list.find((s) => normalize(s.skillNode) === normalize(unitName)) ?? null,
        )
      })
      .catch(() => {}) // 실패 시 세션 결과 폴백
    return () => {
      alive = false
    }
  }, [subject, unitName])

  // 세션 결과 기반 폴백 점수 (같은 공식)
  const local = useMemo(() => {
    const total = rows.reduce((s, r) => s + (r.problem?.points ?? 0), 0)
    const earned = rows.reduce(
      (s, r) => s + ((r.result.serverCorrect ?? r.result.correct) ? r.problem?.points ?? 0 : 0),
      0,
    )
    return total === 0 ? 0 : Math.round((earned * 100) / total)
  }, [rows])

  const score = skillScore?.score ?? local
  const weak = skillScore?.weak ?? score < 70
  // 시퀀스: 채점 마크 → 풀이 시간 → 점수 → 약점 도장
  const marksDoneMs = 300 + Math.max(0, rows.length - 1) * 350 + 700 // 마크 완료
  const timesDoneMs = marksDoneMs + 900 // 풀이 시간 굴림(900ms) 완료
  const displayScore = useCountUp(score, timesDoneMs)

  // 약점 계산 기준 안내 ⓘ 토글
  const [infoOpen, setInfoOpen] = useState(false)

  // 얼리버드 테스트 — "진단 완료"가 가입 유도 대신 사전예약 팝업을 연다
  const [reserveOpen, setReserveOpen] = useState(false)

  // 약점 도장 — 점수 카운트업(900ms)까지 끝난 직후 쿵 찍힌다
  const [stamped, setStamped] = useState(false)
  useEffect(() => {
    if (!weak) {
      setStamped(false)
      return
    }
    const timer = window.setTimeout(() => setStamped(true), timesDoneMs + 950)
    return () => clearTimeout(timer)
  }, [weak, timesDoneMs])

  const correctCount = rows.filter(({ result }) => result.serverCorrect ?? result.correct).length
  const totalSec = Math.round(rows.reduce((s, { result }) => s + result.elapsedMs, 0) / 1000)

  // ── 진단 진행 확정 ──────────────────────────────────────────────────────────
  // 진행 페이지에서 시작한 세트라면 여기서 그 유닛을 "진단 완료" 로 굳히고 오늘 몫을 소진한다.
  // 점수는 서버 누적 점수(skillScore)를 우선 쓰되, 첫 진단이면 세션 점수와 같은 값이라 폴백해도 무방.
  const pendingUnit = useTrialProgressStore((s) => s.pendingUnit)
  const finishPendingUnit = useTrialProgressStore((s) => s.finishPendingUnit)
  // pendingUnit 은 확정 직후 null 이 되므로, 돌아갈 경로는 미리 잡아둔다
  const returnToRef = useRef<string | null>(null)
  if (pendingUnit && !returnToRef.current) returnToRef.current = pendingUnit.returnTo

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

  // 풀이 시간 — 채점 마크가 끝난 뒤, 요약 카드와 문항별 셀이 같은 진행률로 동시에 차오른다
  const countProgress = useCountProgress(marksDoneMs)
  const displayTotalSec = Math.round(totalSec * countProgress)

  // 문항별 획득 점수 — 풀이 시간이 다 오른 뒤 상단 점수와 함께 굴린다
  const scoreProgress = useCountProgress(timesDoneMs)

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
      // 원이 거의 다 그려지는 시점(시작 300ms + 스태거 + 450ms)에 카운트
      timers.push(window.setTimeout(() => setDisplayCorrect(next), 300 + i * 350 + 450))
    })
    return () => timers.forEach(clearTimeout)
  }, [rows, correctCount])

  return (
    // 결과 화면 배경 — 상단 붉은 기운(#fff1f2)에서 흰색으로 (Figma 2824-5560)
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-[#fff1f2] to-white">
      <OnboardingHeader showLogo onClose={() => navigate(isEarlybird() ? '/earlybird' : '/home')} />

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
            {infoOpen && (
              <div className="absolute right-[16px] top-[46px] z-10 w-[230px] rounded-[12px] border border-[#e5e7ea] bg-white p-[14px] text-left shadow-[0px_8px_24px_rgba(18,20,23,0.12)]">
                <p className="text-[12px] font-semibold text-[#23272b]">점수 계산 기준</p>
                <ul className="mt-[6px] flex flex-col gap-[3px] text-[12px] leading-[1.5] text-[#5e6368]">
                  <li>· 권장 시간 내 정답 = 배점 100%</li>
                  <li>· 권장 초과 정답 = 배점 60%</li>
                  <li>· 오답·시간 초과 = 0점</li>
                  <li>· 획득률 70% 이하면 약점이에요</li>
                </ul>
              </div>
            )}

            <div className="flex flex-col items-center gap-[8px] px-[20px]">
              {/* 약점 뱃지 — 점수 카운트업 후 도장처럼 찍힌다. 슬롯을 미리 잡아 레이아웃 점프 방지 */}
              <div className="flex h-[27px] items-center">
                {weak && stamped && (
                  <span
                    className={clsx(
                      'rounded-full border border-primary bg-[#fff1f2] px-[8px] py-[4px] text-[12px] font-semibold leading-[1.4] text-primary',
                      markStyles.stamp,
                    )}
                  >
                    약점
                  </span>
                )}
              </div>
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
                      delayMs={300 + i * 350}
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
          // 그 외에는 잠금 해제 진행 중이던 세트면 진행 페이지로 복귀
          onClick={() =>
            isEarlybird()
              ? setReserveOpen(true)
              : navigate(returnToRef.current ?? (isMember ? '/home' : '/signup'))
          }
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center rounded-[12px] bg-[#23272b] px-xl text-[16px] font-bold text-white transition-opacity hover:opacity-90 active:opacity-85"
        >
          진단 완료
        </button>
      </footer>

      {reserveOpen && <EarlybirdReserveModal onClose={() => setReserveOpen(false)} />}
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
