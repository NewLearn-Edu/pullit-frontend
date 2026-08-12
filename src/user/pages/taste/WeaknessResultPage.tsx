import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import OnboardingHeader from '@/user/components/OnboardingHeader'
import { getProblemsByEnglishType, getProblemsBySkillNode, type Problem } from '@/user/data/mockProblems'
import { MOCK_SKILL_NODES } from '@/user/data/mockSkillNodes'
import { flushAttemptQueue } from '@/user/services/attemptQueue'
import { fetchSkillScores, type SkillScore } from '@/user/api/attemptApi'
import { useTasteStore, type QuizItemResult } from '@/user/stores/tasteStore'
import { useTrialProgressStore } from '@/user/stores/trialProgressStore'
import { selectIsMember, useUserStore } from '@/user/stores/userStore'
import markStyles from './styles/WeaknessResultPage.module.scss'

/** m:ss (풀이 시간 셀) */
function formatShort(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** "2분 48초" (요약 카드) */
function formatSummary(totalSec: number): string {
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

function GradeMark({ kind, delayMs }: { kind: MarkKind; delayMs: number }) {
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
  } = useTasteStore()

  // persist rehydrate 전에 판정하면 정상 완주자도 튕긴다
  const hydrated = useTasteStore.persist?.hasHydrated?.() ?? true

  // 채점하기 → 결과 직행 플로우 — 전송 실패분 회수를 여기서 수행
  useEffect(() => {
    flushAttemptQueue()
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!hasCompletedSession()) {
      navigate('/taste', { replace: true })
    }
  }, [hydrated, hasCompletedSession, navigate])

  const subject = lastSubject ?? 'math'

  const mathProblems = useMemo(
    () => (mathSkillNodeId ? getProblemsBySkillNode(mathSkillNodeId) : []),
    [mathSkillNodeId],
  )
  const englishProblems = useMemo(
    () => (englishTypeId ? getProblemsByEnglishType(englishTypeId) : []),
    [englishTypeId],
  )

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
      ? '빈칸' // POC 고정 (en-blank)
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

  useEffect(() => {
    if (!hydrated || rows.length === 0) return
    finishPendingUnit({
      score,
      weak,
      minutes: Math.max(1, Math.round(totalSec / 60)),
      correct: correctCount,
    })
  }, [hydrated, rows.length, score, weak, totalSec, correctCount, finishPendingUnit])

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
    <div className="flex min-h-dvh flex-col bg-white">
      <OnboardingHeader onClose={() => navigate('/home')} />

      <main
        className={clsx(
          'flex w-full flex-1 flex-col items-center gap-[28px] px-[40px] py-[24px] pb-[120px] max-md:gap-xl max-md:px-lg',
          stamped && markStyles.shake,
        )}
      >
        {/* 단원명 + 약점 뱃지 + 누적 점수 */}
        <div className="flex w-full max-w-[620px] items-center justify-between gap-md">
          <div className="flex min-w-0 items-center gap-sm">
            <h1 className="truncate text-[24px] font-bold text-[#171211] max-md:text-[22px]">
              {unitName}
            </h1>
            {weak && stamped && (
              <span
                className={clsx(
                  'shrink-0 rounded-full bg-primary px-[12px] py-[5px] text-[13px] font-bold text-white',
                  markStyles.stamp,
                )}
              >
                약점
              </span>
            )}
          </div>
          <p className="shrink-0 text-[32px] font-bold tabular-nums text-[#121417] max-md:text-[28px]">
            {displayScore}점
          </p>
        </div>

        {/* 정답 수 · 풀이 시간 */}
        <div className="flex w-full max-w-[620px] gap-md">
          <div className="flex flex-1 flex-col gap-md rounded-[12px] bg-[#f8f8f8] p-[20px] max-md:p-lg">
            <p className="text-[12px] font-medium text-[#80858b]">정답 수</p>
            <p className="text-[24px] font-bold tabular-nums text-[#121417] max-md:text-[22px]">
              {displayCorrect}/{rows.length}
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-md rounded-[12px] bg-[#f8f8f8] p-[20px] max-md:p-lg">
            <p className="text-[12px] font-medium text-[#80858b]">풀이 시간</p>
            <p className="text-[24px] font-bold tabular-nums text-[#121417] max-md:text-[22px]">
              {formatSummary(displayTotalSec)}
            </p>
          </div>
        </div>

        {/* 문항별 결과 */}
        <section className="flex w-full max-w-[620px] flex-col gap-lg">
          <h2 className="text-[18px] font-semibold text-[#23272b]">문항별 결과</h2>

          <div className="flex w-full flex-col overflow-hidden rounded-[12px] border border-[#f0f1f3]">
            <div className="flex w-full items-center bg-[#f8f8f8]">
              {['문항', '답안', '풀이 시간', '점수', '결과'].map((label) => (
                <div key={label} className="flex flex-1 items-center justify-center p-md">
                  <p className="whitespace-nowrap text-[13px] text-[#80858b]">{label}</p>
                </div>
              ))}
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
              const correctAnswer = problem
                ? shortAnswer
                  ? problem.answer
                  : circled(problem.answer)
                : '-'

              return (
                <div
                  key={`${result.problemId}-${i}`}
                  className="flex min-h-[76px] w-full items-center border-t border-[#f0f1f3] py-md"
                >
                  <div className="relative flex min-w-0 flex-1 items-center justify-center self-stretch px-sm">
                    <p className="whitespace-nowrap text-[16px] font-bold text-[#121417]">
                      {i + 1}번
                    </p>
                    <GradeMark
                      kind={isCorrect ? (overTime ? 'triangle' : 'circle') : 'slash'}
                      delayMs={300 + i * 350}
                    />
                  </div>

                  {/* 답안 — 내 답만 크게 · 정답 보조줄은 틀렸을 때만 */}
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] px-sm">
                    <p className="whitespace-nowrap text-[16px] font-medium text-[#121417]">
                      {/* 원기호는 글리프가 작게 그려져서 20px 로 보정 */}
                      {shortAnswer ? (
                        myAnswer
                      ) : (
                        <span className="text-[20px] leading-none">{myAnswer}</span>
                      )}
                    </p>
                    {!isCorrect && (
                      <p className="flex items-center gap-[4px] whitespace-nowrap text-[15px] font-medium text-primary">
                        정답
                        {shortAnswer ? (
                          <span className="font-semibold">{correctAnswer}</span>
                        ) : (
                          <span className="text-[20px] leading-none">{correctAnswer}</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* 풀이 시간 — 권장 보조줄은 초과했을 때만 (빨간 시간의 이유) */}
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] px-sm">
                    <p className="whitespace-nowrap text-[15px] font-semibold tabular-nums text-[#121417]">
                      {/* 요약 카드와 같은 진행률 — 모든 시간이 동시에 차오른다 */}
                      {formatShort(Math.round(elapsedSec * countProgress))}
                    </p>
                    {overTime && (
                      <p className="whitespace-nowrap text-[15px] font-medium tabular-nums text-primary">
                        권장 {formatShort(recSec)}
                      </p>
                    )}
                  </div>

                  {/* 점수 — 획득 점수만 크게 · 배점 보조줄은 만점이 아닐 때만 */}
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] px-sm">
                    <p className="whitespace-nowrap text-[15px] font-bold tabular-nums text-[#121417]">
                      {(() => {
                        // 풀이 시간이 끝난 뒤 상단 점수와 같은 진행률로 차오른다
                        const shown = Math.round(earned * scoreProgress * 10) / 10
                        return Number.isInteger(shown) ? shown : shown.toFixed(1)
                      })()}
                      점
                    </p>
                    {earned < basePoints && (
                      <p className="whitespace-nowrap text-[12px] tabular-nums text-[#a6abb1]">
                        배점 {basePoints}점
                      </p>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 items-center justify-center px-sm">
                    {problem && reviewIdx >= 0 ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/taste/review/${rowSubject}/${reviewIdx}`)}
                        className="whitespace-nowrap rounded-[8px] border border-[#e5e7ea] bg-[#f8f8f8] px-[12px] py-[7px] text-[13px] font-semibold text-[#40464c] transition-colors hover:bg-[#f0f1f3]"
                      >
                        해설
                      </button>
                    ) : (
                      <span className="text-[13px] text-[#a6abb1]">-</span>
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
          // 잠금 해제 진행 중이던 세트면 진행 페이지로 복귀 — 방금 채운 칸을 바로 보게 한다
          onClick={() => navigate(returnToRef.current ?? (isMember ? '/home' : '/signup'))}
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center rounded-[12px] bg-[#23272b] px-xl text-[16px] font-bold text-white transition-opacity hover:opacity-90 active:opacity-85"
        >
          완료
        </button>
      </footer>
    </div>
  )
}
